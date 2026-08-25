import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  streamText,
  stepCountIs,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { AI_BASE_URL_PADRAO, MODELO_CHAT_PADRAO, createAiProvider } from "@/lib/ai-gateway.server";
import { tituloEhPadrao } from "@/lib/assistente-titulo.server";
import { buscarContexto, montarPromptAgente, type Fonte } from "@/lib/assistente-rag.server";
import { criarFerramentasAssistente } from "@/lib/assistente-tools.server";
import { autenticarRequisicao } from "@/lib/supabase-request.server";

type CorpoRequisicao = { messages?: UIMessage[]; conversationId?: string };
const CONFIANCA_MINIMA = 0.62;
const MAX_CONTEXTO_RECUPERACAO = 6;

type SessaoContexto = Awaited<ReturnType<typeof autenticarRequisicao>>;

function textoDaMensagem(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";
  return mensagem.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
}

function textoDaConversa(mensagens: UIMessage[]): string {
  return mensagens
    .slice(-MAX_CONTEXTO_RECUPERACAO)
    .map((mensagem) => {
      const texto = textoDaMensagem(mensagem);
      if (!texto) return "";
      return `${mensagem.role === "assistant" ? "Assistente" : "Usuário"}: ${texto}`;
    })
    .filter(Boolean)
    .join("\n");
}

function consultaParaRecuperacao(mensagens: UIMessage[]): string {
  const atual = textoDaMensagem(mensagens[mensagens.length - 1]);
  const anterior = mensagens.length > 1 ? textoDaConversa(mensagens.slice(0, -1)) : "";
  if (!anterior) return atual;
  return `PERGUNTA ATUAL:\n${atual}\n\nCONTEXTO RECENTE DA CONVERSA:\n${anterior}`;
}

function valorEnv(env: unknown, chave: string): string | undefined {
  if (env && typeof env === "object" && chave in env) {
    const valor = (env as Record<string, unknown>)[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  const valorProcess = typeof process !== "undefined" ? process.env?.[chave] : undefined;
  return valorProcess?.trim() || undefined;
}

function configAi(env: unknown) {
  const apiKey = valorEnv(env, "AI_API_KEY");
  const baseURL = valorEnv(env, "AI_BASE_URL") || AI_BASE_URL_PADRAO;
  const model = valorEnv(env, "AI_MODEL") || MODELO_CHAT_PADRAO;
  const embeddingModel = valorEnv(env, "AI_EMBEDDING_MODEL");
  if (!apiKey) return null;
  return { apiKey, baseURL, model, embeddingModel };
}

function sanitizarHistoricoUI(mensagens: UIMessage[]): UIMessage[] {
  return mensagens.map((mensagem) => ({
    ...mensagem,
    parts: mensagem.parts
      .filter((part) => {
        const tipo = (part as { type?: string }).type;
        return tipo !== "reasoning" && tipo !== "reasoning-part" && tipo !== "reasoning-delta";
      })
      .map((part) => {
        const copia = { ...(part as Record<string, unknown>) };
        delete copia.reasoning_content;
        delete copia.reasoningContent;
        delete copia.providerMetadata;
        delete copia.providerOptions;
        return copia as typeof part;
      }),
  }));
}

function removerMetadadosProvedor(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(removerMetadadosProvedor);
  if (!valor || typeof valor !== "object") return valor;

  const origem = valor as Record<string, unknown>;
  const destino: Record<string, unknown> = {};
  for (const [chave, item] of Object.entries(origem)) {
    if (
      chave === "reasoning_content" ||
      chave === "reasoningContent" ||
      chave === "providerMetadata" ||
      chave === "providerOptions" ||
      chave === "provider_metadata" ||
      chave === "provider_options"
    ) continue;
    destino[chave] = removerMetadadosProvedor(item);
  }
  return destino;
}

function sanitizarModelMessages(mensagens: ModelMessage[]): ModelMessage[] {
  return mensagens.map((mensagem) => {
    const limpa = removerMetadadosProvedor(mensagem) as ModelMessage;
    if (limpa.role === "assistant" && Array.isArray(limpa.content)) {
      limpa.content = limpa.content.filter((part) => {
        const tipo = (part as { type?: string }).type;
        return tipo !== "reasoning" && tipo !== "reasoning-part" && tipo !== "reasoning-delta";
      });
    }
    return limpa;
  });
}

function ehSaudacao(texto: string): boolean {
  return /^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|olá, tudo bem|tudo bem)\s*[!.?]*$/i.test(texto.trim());
}

function querAbrirChamado(texto: string): boolean {
  return /\b(abrir|criar|registrar|cadastrar)\b.*\b(chamado|ticket|solicita[cç][aã]o)\b/i.test(texto)
    || /\b(chamado|ticket)\b.*\b(abrir|criar|registrar)\b/i.test(texto);
}

function querListarChamados(texto: string): boolean {
  return /\b(meus chamados|meus tickets|chamados em aberto|chamados abertos|listar chamados|quais chamados|chamados que abri)\b/i.test(texto);
}

function numeroChamado(texto: string): string | null {
  const match = texto.match(/\b(SD[- ]?\d{3,})\b/i);
  return match?.[1]?.replace(/\s+/g, "-").toUpperCase() ?? null;
}

async function salvarResposta(supabase: NonNullable<SessaoContexto>["supabase"], conversationId: string, userId: string, text: string, fontes: Fonte[] = [], confianca = 0) {
  const { error } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "assistant",
    content: text,
    fontes: fontes as unknown as never,
    confianca,
  });
  if (error) console.error("[assistente] erro ao salvar resposta", error);
  await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

function respostaDireta(mensagens: UIMessage[], text: string, metadata?: { fontes?: Fonte[]; confianca?: number }) {
  const stream = createUIMessageStream({
    originalMessages: mensagens,
    execute: ({ writer }) => {
      const id = generateId();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
    messageMetadata: () => metadata,
  });
  return createUIMessageStreamResponse({ stream });
}

export const Route = createFileRoute("/api/assistente")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (request as Request & { env?: unknown }).env;
        const ai = configAi(env);
        if (!ai) return new Response(JSON.stringify({ error: "IA não configurada no servidor. Defina AI_API_KEY." }), { status: 503, headers: { "Content-Type": "application/json" } });

        const sessao = await autenticarRequisicao(request);
        if (!sessao) return new Response(JSON.stringify({ error: "Sessão expirada. Entre novamente." }), { status: 401, headers: { "Content-Type": "application/json" } });
        const { supabase, userId } = sessao;
        const corpo = (await request.json()) as CorpoRequisicao;
        const mensagens = Array.isArray(corpo.messages) ? corpo.messages : [];
        const conversationId = corpo.conversationId;
        if (!mensagens.length || !conversationId) return new Response(JSON.stringify({ error: "Requisição inválida." }), { status: 400, headers: { "Content-Type": "application/json" } });

        const { data: conversa } = await supabase.from("ai_conversations").select("id, title, user_id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
        if (!conversa) return new Response(JSON.stringify({ error: "Conversa não encontrada." }), { status: 404, headers: { "Content-Type": "application/json" } });

        const pergunta = textoDaMensagem(mensagens[mensagens.length - 1]);
        const consultaRecuperacao = consultaParaRecuperacao(mensagens);
        const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", userId).maybeSingle();
        await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "user", content: pergunta });

        const precisaTitulo = tituloEhPadrao(conversa.title);
        const fontesUsadas: Fonte[] = [];
        let confianca = 0;
        const registrarFontes = (fontes: Fonte[]) => {
          for (const fonte of fontes) {
            if (!fontesUsadas.some((f) => f.ref_id === fonte.ref_id)) fontesUsadas.push(fonte);
            confianca = Math.max(confianca, fonte.similaridade);
          }
        };

        if (ehSaudacao(pergunta)) {
          const text = "Boa tarde! Como posso ajudar com seu atendimento no Service Desk?";
          await salvarResposta(supabase, conversationId, userId, text);
          return respostaDireta(mensagens, text);
        }

        if (querAbrirChamado(pergunta)) {
          const text = "Claro. Vamos abrir seu chamado. Qual é o problema ou solicitação que você precisa registrar?";
          await salvarResposta(supabase, conversationId, userId, text);
          return respostaDireta(mensagens, text);
        }

        if (querListarChamados(pergunta)) {
          const { data, error } = await supabase.from("chamados").select("numero, titulo, status, prioridade, aberto_em").eq("solicitante_id", userId).order("aberto_em", { ascending: false }).limit(15);
          const text = error ? "Não consegui consultar seus chamados agora. Tente novamente em instantes." : data?.length ? `Seus chamados recentes:\n\n${data.map((c) => `- **${c.numero}** — ${c.titulo} — ${c.status} — prioridade ${c.prioridade}`).join("\n")}` : "Você não possui chamados registrados.";
          await salvarResposta(supabase, conversationId, userId, text);
          return respostaDireta(mensagens, text);
        }

        const numero = numeroChamado(pergunta);
        if (numero) {
          const { data, error } = await supabase.from("chamados").select("numero, titulo, descricao, status, prioridade, aberto_em, respondido_em, resolvido_em, prazo_resolucao").eq("numero", numero).eq("solicitante_id", userId).maybeSingle();
          const text = error ? "Não consegui consultar esse chamado agora." : !data ? `Não encontrei o chamado **${numero}** entre os seus chamados.` : `**${data.numero}** — ${data.titulo}\n\n- Status: ${data.status}\n- Prioridade: ${data.prioridade}\n- Aberto em: ${data.aberto_em}${data.prazo_resolucao ? `\n- Prazo de resolução: ${data.prazo_resolucao}` : ""}`;
          await salvarResposta(supabase, conversationId, userId, text);
          return respostaDireta(mensagens, text);
        }

        try {
          const contexto = await buscarContexto(supabase, consultaRecuperacao, ai);
          registrarFontes(contexto.fontes);
          if (contexto.confianca >= 0.62 && contexto.bloco) {
            const rotulo = contexto.origemPrioritaria === "chamado" ? "Encontrei um caso semelhante no histórico de chamados resolvidos. Ele é uma referência histórica, não uma regra oficial." : "Encontrei uma orientação na base de conhecimento/documentação interna:";
            const text = `${rotulo}\n\n${contexto.bloco}`;
            await salvarResposta(supabase, conversationId, userId, text, fontesUsadas, confianca);
            return respostaDireta(mensagens, text, { fontes: fontesUsadas, confianca });
          }
        } catch (erro) {
          console.error("[assistente] recuperação pré-IA falhou", erro);
        }

        const ferramentas = criarFerramentasAssistente({ supabase, userId, ai, registrarFontes });
        const gateway = createAiProvider({ apiKey: ai.apiKey, baseURL: ai.baseURL, name: "ai-provider" });

        try {
          const mensagensSemReasoning = sanitizarHistoricoUI(mensagens);
          const convertidas = await convertToModelMessages(mensagensSemReasoning, { tools: ferramentas, ignoreIncompleteToolCalls: true });
          const modelMessages = sanitizarModelMessages(convertidas);
          const resultado = streamText({
            model: gateway(ai.model),
            system: montarPromptAgente(perfil?.nome ?? null),
            messages: modelMessages,
            tools: ferramentas,
            stopWhen: stepCountIs(10),
            onFinish: async ({ text }) => {
              await salvarResposta(supabase, conversationId, userId, text, fontesUsadas, confianca);
              if (precisaTitulo) {
                const fallback = pergunta.replace(/\s+/g, " ").trim().slice(0, 60).trimEnd() || "Nova conversa";
                await supabase.from("ai_conversations").update({ title: fallback }).eq("id", conversationId).or('title.is.null,title.in.("Nova conversa","Nova conversa IA")');
              }
              if (confianca < CONFIANCA_MINIMA) {
                await supabase.from("perguntas_sem_resposta").insert({ pergunta, contexto: fontesUsadas.map((f) => f.titulo).join(" | ") || null, conversation_id: conversationId, user_id: userId, confianca });
              }
            },
          });
          return resultado.toUIMessageStreamResponse({
            originalMessages: mensagens,
            messageMetadata: ({ part }) => part.type === "finish" ? { fontes: fontesUsadas, confianca } : undefined,
            onError: (erro) => {
              console.error("[assistente] erro de streaming", erro);
              const mensagem = erro instanceof Error ? erro.message : String(erro);
              if (mensagem.includes("429")) return "Muitas solicitações agora. Tente em instantes.";
              if (mensagem.includes("402")) return "O provedor de IA informou falta de créditos.";
              return "Ocorreu um erro ao gerar a resposta.";
            },
          });
        } catch (erro) {
          console.error("[assistente] falha ao preparar/executar provider de IA", erro);
          return new Response(JSON.stringify({ error: "Não foi possível falar com a IA agora." }), { status: 502, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
