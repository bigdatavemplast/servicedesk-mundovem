import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { AI_BASE_URL_PADRAO, MODELO_CHAT_PADRAO, createAiProvider } from "@/lib/ai-gateway.server";
import { tituloEhPadrao } from "@/lib/assistente-titulo.server";
import { montarPromptAgente, type Fonte } from "@/lib/assistente-rag.server";
import { criarFerramentasAssistente } from "@/lib/assistente-tools.server";
import { autenticarRequisicao } from "@/lib/supabase-request.server";

type CorpoRequisicao = { messages?: UIMessage[]; conversationId?: string };
const CONFIANCA_MINIMA = 0.62;

function textoDaMensagem(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";
  return mensagem.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
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
  if (!apiKey) return null;
  return { apiKey, baseURL, model };
}

export const Route = createFileRoute("/api/assistente")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (request as Request & { env?: unknown }).env;
        const ai = configAi(env);
        if (!ai) {
          return new Response(JSON.stringify({ error: "IA não configurada no servidor. Defina AI_API_KEY." }), { status: 503, headers: { "Content-Type": "application/json" } });
        }

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
        const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", userId).maybeSingle();
        const { error: erroUsuario } = await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "user", content: pergunta });
        if (erroUsuario) console.error("[assistente] erro ao salvar pergunta", erroUsuario);

        const precisaTitulo = tituloEhPadrao(conversa.title);
        const fontesUsadas: Fonte[] = [];
        let confianca = 0;
        const ferramentas = criarFerramentasAssistente({ supabase, userId, ai, registrarFontes: (fontes) => { for (const f of fontes) { if (!fontesUsadas.some((x) => x.ref_id === f.ref_id)) fontesUsadas.push(f); confianca = Math.max(confianca, f.similaridade); } } });
        const gateway = createAiProvider({ apiKey: ai.apiKey, baseURL: ai.baseURL, name: "ai-provider" });

        let resultado;
        try {
          const modelMessages = await convertToModelMessages(mensagens, {
            tools: ferramentas,
            ignoreIncompleteToolCalls: true,
          });

          resultado = streamText({
            model: gateway(ai.model),
            system: montarPromptAgente(perfil?.nome ?? null),
            messages: modelMessages,
            tools: ferramentas,
            stopWhen: stepCountIs(10),
            onFinish: async ({ text }) => {
              const { error } = await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content: text, fontes: fontesUsadas as unknown as never, confianca });
              if (error) console.error("[assistente] erro ao salvar resposta", error);
              await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
              if (precisaTitulo) {
                const fallback = pergunta.replace(/\s+/g, " ").trim().slice(0, 60).trimEnd() || "Nova conversa";
                const { error: erroTitulo } = await supabase.from("ai_conversations").update({ title: fallback }).eq("id", conversationId).or('title.is.null,title.in.("Nova conversa","Nova conversa IA")');
                if (erroTitulo) console.error("[assistente] erro ao salvar título", erroTitulo);
              }
              if (confianca < CONFIANCA_MINIMA) {
                const { error: erroPergunta } = await supabase.from("perguntas_sem_resposta").insert({ pergunta, contexto: fontesUsadas.map((f) => f.titulo).join(" | ") || null, conversation_id: conversationId, user_id: userId, confianca });
                if (erroPergunta) console.error("[assistente] erro ao registrar lacuna", erroPergunta);
              }
            },
          });
        } catch (erro) {
          console.error("[assistente] falha ao preparar/executar provider de IA", erro);
          return new Response(JSON.stringify({ error: "Não foi possível falar com a IA agora." }), { status: 502, headers: { "Content-Type": "application/json" } });
        }

        return resultado.toUIMessageStreamResponse({ originalMessages: mensagens, messageMetadata: ({ part }) => part.type === "finish" ? { fontes: fontesUsadas, confianca } : undefined, onError: (erro) => { console.error("[assistente] erro de streaming", erro); const mensagem = erro instanceof Error ? erro.message : String(erro); if (mensagem.includes("429")) return "Muitas solicitações agora. Tente em instantes."; if (mensagem.includes("402")) return "O provedor de IA informou falta de créditos."; return "Ocorreu um erro ao gerar a resposta."; } });
      },
    },
  },
});
