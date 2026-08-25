import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  streamText,
  type UIMessage,
} from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createAiProvider } from "./ai-gateway.server";
import { buscarContexto, montarPromptAgente, type Fonte } from "./assistente-rag.server";
import { criarFerramentasAssistente } from "./assistente-tools.server";

type AiConfig = { apiKey: string; baseURL: string; model: string; embeddingModel?: string };
type Sessao = { supabase: SupabaseClient<Database>; userId: string };

const LIMITE_KB = 0.62;
const LIMITE_HISTORICO = 0.72;
const MAX_HISTORICO = 8;

export type DecisaoInteligencia = "regra" | "base_conhecimento" | "historico" | "ia";
export type ResultadoOrquestrador = {
  response?: Response;
  decisao: DecisaoInteligencia;
  fontes: Fonte[];
  confianca: number;
};

function texto(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";
  return mensagem.parts.filter((p) => p.type === "text").map((p) => p.text).join(" ").trim();
}

function perguntaComContexto(mensagens: UIMessage[]): string {
  const atual = texto(mensagens.at(-1));
  const anterior = mensagens.slice(0, -1).slice(-MAX_HISTORICO).map((m) => {
    const t = texto(m);
    return t ? `${m.role === "assistant" ? "Assistente" : "Usuário"}: ${t}` : "";
  }).filter(Boolean).join("\n");
  return anterior ? `PERGUNTA ATUAL:\n${atual}\n\nCONTEXTO DA CONVERSA:\n${anterior}` : atual;
}

function direta(mensagens: UIMessage[], text: string, fontes: Fonte[] = [], confianca = 0) {
  const stream = createUIMessageStream({
    originalMessages: mensagens,
    execute: ({ writer }) => {
      const id = generateId();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
    messageMetadata: () => ({ fontes, confianca }),
  });
  return createUIMessageStreamResponse({ stream });
}

function saudacao(p: string) { return /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|tudo bem)[!.? ]*$/i.test(p); }
function abrir(p: string) { return /\b(abrir|criar|registrar|cadastrar)\b.*\b(chamado|ticket|solicita[cç][aã]o)\b/i.test(p) || /\b(chamado|ticket)\b.*\b(abrir|criar|registrar)\b/i.test(p); }
function listar(p: string) { return /\b(meus chamados|meus tickets|chamados em aberto|chamados abertos|listar chamados|quais chamados|chamados que abri)\b/i.test(p); }
function numero(p: string) { const m = p.match(/\b(SD[- ]?\d{3,})\b/i); return m?.[1]?.replace(/\s+/g, "-").toUpperCase() ?? null; }

async function salvar(supabase: SupabaseClient<Database>, conversationId: string, userId: string, text: string, fontes: Fonte[] = [], confianca = 0) {
  await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: text, fontes: fontes as never, confianca });
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

export async function executarInteligencia({ sessao, mensagens, conversationId, ai, nomeUsuario }: { sessao: Sessao; mensagens: UIMessage[]; conversationId: string; ai: AiConfig; nomeUsuario: string | null }): Promise<ResultadoOrquestrador> {
  const { supabase, userId } = sessao;
  const pergunta = texto(mensagens.at(-1));
  const fontes: Fonte[] = [];
  let confianca = 0;
  const registrar = (novas: Fonte[]) => { for (const f of novas) { if (!fontes.some((x) => x.ref_id === f.ref_id)) fontes.push(f); confianca = Math.max(confianca, f.similaridade); } };

  // CAMADA 1 — regras determinísticas. Nenhuma chamada de IA.
  if (saudacao(pergunta)) {
    const r = "Boa tarde! Como posso ajudar com seu atendimento no Service Desk?";
    await salvar(supabase, conversationId, userId, r);
    return { response: direta(mensagens, r), decisao: "regra", fontes, confianca };
  }
  if (abrir(pergunta)) {
    const r = "Claro. Vamos abrir seu chamado. Qual é o problema ou solicitação que você precisa registrar?";
    await salvar(supabase, conversationId, userId, r);
    return { response: direta(mensagens, r), decisao: "regra", fontes, confianca };
  }
  if (listar(pergunta)) {
    const { data, error } = await supabase.from("chamados").select("numero, titulo, status, prioridade, aberto_em").eq("solicitante_id", userId).order("aberto_em", { ascending: false }).limit(15);
    const r = error ? "Não consegui consultar seus chamados agora. Tente novamente em instantes." : data?.length ? `Seus chamados recentes:\n\n${data.map((c) => `- **${c.numero}** — ${c.titulo} — ${c.status} — prioridade ${c.prioridade}`).join("\n")}` : "Você não possui chamados registrados.";
    await salvar(supabase, conversationId, userId, r);
    return { response: direta(mensagens, r), decisao: "regra", fontes, confianca };
  }
  const n = numero(pergunta);
  if (n) {
    const { data, error } = await supabase.from("chamados").select("numero, titulo, status, prioridade, aberto_em, prazo_resolucao").eq("numero", n).eq("solicitante_id", userId).maybeSingle();
    const r = error ? "Não consegui consultar esse chamado agora." : !data ? `Não encontrei o chamado **${n}** entre os seus chamados.` : `**${data.numero}** — ${data.titulo}\n\n- Status: ${data.status}\n- Prioridade: ${data.prioridade}\n- Aberto em: ${data.aberto_em}${data.prazo_resolucao ? `\n- Prazo de resolução: ${data.prazo_resolucao}` : ""}`;
    await salvar(supabase, conversationId, userId, r);
    return { response: direta(mensagens, r), decisao: "regra", fontes, confianca };
  }

  // CAMADA 2/3 — recuperação semântica. A busca é feita antes da IA.
  try {
    const contexto = await buscarContexto(supabase, perguntaComContexto(mensagens), ai);
    registrar(contexto.fontes);
    const oficial = contexto.fontes.filter((f) => f.origem === "base_conhecimento" || f.origem === "documento").some((f) => f.similaridade >= LIMITE_KB);
    const historico = contexto.fontes.filter((f) => f.origem === "chamado").some((f) => f.similaridade >= LIMITE_HISTORICO);
    if (contexto.bloco && (oficial || historico)) {
      const origem = oficial ? "Encontrei uma orientação na Base de Conhecimento/documentação interna:" : "Encontrei um caso semelhante no histórico de chamados resolvidos. Ele é uma referência histórica, não uma regra oficial:";
      const r = `${origem}\n\n${contexto.bloco}`;
      await salvar(supabase, conversationId, userId, r, fontes, confianca);
      return { response: direta(mensagens, r, fontes, confianca), decisao: oficial ? "base_conhecimento" : "historico", fontes, confianca };
    }
  } catch (e) { console.error("[assistente] recuperação falhou; fallback para IA", e); }

  // CAMADA 4 — IA. É o último recurso. O provider recebe somente texto controlado.
  const historicoTextual = mensagens.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: texto(m) })).filter((m) => m.content);
  const gateway = createAiProvider({ apiKey: ai.apiKey, baseURL: ai.baseURL, name: "ai-provider" });
  const ferramentas = criarFerramentasAssistente({ supabase, userId, ai, registrarFontes: registrar });
  const resultado = streamText({
    model: gateway(ai.model),
    system: montarPromptAgente(nomeUsuario),
    messages: historicoTextual,
    tools: ferramentas,
  });
  return {
    response: resultado.toUIMessageStreamResponse({
      originalMessages: mensagens,
      messageMetadata: ({ part }) => part.type === "finish" ? { fontes, confianca, decisao: "ia" } : undefined,
      onError: (erro) => { console.error("[assistente] erro IA", erro); return "Ocorreu um erro ao gerar a resposta."; },
    }),
    decisao: "ia",
    fontes,
    confianca,
  };
}
