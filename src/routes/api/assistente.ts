import { createFileRoute } from "@tanstack/react-router";
import { type UIMessage } from "ai";
import { AI_BASE_URL_PADRAO, MODELO_CHAT_PADRAO } from "@/lib/ai-gateway.server";
import { tituloEhPadrao } from "@/lib/assistente-titulo.server";
import { executarInteligencia } from "@/lib/assistente-orchestrator.server";
import { autenticarRequisicao } from "@/lib/supabase-request.server";

type CorpoRequisicao = { messages?: UIMessage[]; conversationId?: string };

function valorEnv(env: unknown, chave: string): string | undefined {
  if (env && typeof env === "object" && chave in env) {
    const valor = (env as Record<string, unknown>)[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return (typeof process !== "undefined" ? process.env?.[chave] : undefined)?.trim() || undefined;
}

export const Route = createFileRoute("/api/assistente")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (request as Request & { env?: unknown }).env;
        const apiKey = valorEnv(env, "AI_API_KEY");
        if (!apiKey) return new Response(JSON.stringify({ error: "IA não configurada no servidor. Defina AI_API_KEY." }), { status: 503, headers: { "Content-Type": "application/json" } });
        const sessao = await autenticarRequisicao(request);
        if (!sessao) return new Response(JSON.stringify({ error: "Sessão expirada. Entre novamente." }), { status: 401, headers: { "Content-Type": "application/json" } });
        const corpo = (await request.json()) as CorpoRequisicao;
        const mensagens = Array.isArray(corpo.messages) ? corpo.messages : [];
        const conversationId = corpo.conversationId;
        if (!mensagens.length || !conversationId) return new Response(JSON.stringify({ error: "Requisição inválida." }), { status: 400, headers: { "Content-Type": "application/json" } });
        const { supabase, userId } = sessao;
        const { data: conversa } = await supabase.from("ai_conversations").select("id, title, user_id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
        if (!conversa) return new Response(JSON.stringify({ error: "Conversa não encontrada." }), { status: 404, headers: { "Content-Type": "application/json" } });
        const pergunta = mensagens.at(-1)?.parts.filter((p) => p.type === "text").map((p) => p.text).join(" ").trim() ?? "";
        await supabase.from("ai_messages").insert({ conversation_id: conversationId, user_id: userId, role: "user", content: pergunta });
        const { data: perfil } = await supabase.from("profiles").select("nome").eq("id", userId).maybeSingle();
        const ai = { apiKey, baseURL: valorEnv(env, "AI_BASE_URL") || AI_BASE_URL_PADRAO, model: valorEnv(env, "AI_MODEL") || MODELO_CHAT_PADRAO, embeddingModel: valorEnv(env, "AI_EMBEDDING_MODEL") };
        try {
          const resultado = await executarInteligencia({ sessao, mensagens, conversationId, ai, nomeUsuario: perfil?.nome ?? null });
          if (tituloEhPadrao(conversa.title)) {
            const fallback = pergunta.replace(/\s+/g, " ").trim().slice(0, 60).trimEnd() || "Nova conversa";
            await supabase.from("ai_conversations").update({ title: fallback }).eq("id", conversationId).or('title.is.null,title.in.("Nova conversa","Nova conversa IA")');
          }
          return resultado.response ?? new Response(JSON.stringify({ error: "Nenhuma resposta gerada." }), { status: 500 });
        } catch (erro) {
          console.error("[assistente] falha no orquestrador", erro);
          return new Response(JSON.stringify({ error: "Não foi possível processar sua solicitação agora." }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
