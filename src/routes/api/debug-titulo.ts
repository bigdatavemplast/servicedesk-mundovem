import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider, MODELO_CHAT } from "@/lib/ai-gateway.server";
import { autenticarRequisicao } from "@/lib/supabase-request.server";

// ROTA TEMPORÁRIA DE DIAGNÓSTICO — remover após o teste.
export const Route = createFileRoute("/api/debug-titulo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sessao = await autenticarRequisicao(request);
        if (!sessao) return new Response("unauthorized", { status: 401 });
        const apiKey = process.env["LOVABLE_API_KEY"] ?? "";
        const gateway = createLovableAiGatewayProvider(apiKey);
        try {
          const r = await generateText({
            model: gateway(MODELO_CHAT),
            system:
              "Você gera títulos para conversas de um service desk corporativo. " +
              "A partir da primeira mensagem do usuário, responda APENAS com um título curto e descritivo " +
              "em português, de 3 a 8 palavras, que resuma o assunto da conversa. " +
              "Sem aspas, sem pontuação final, sem prefixos como 'Título:'. " +
              "Não inclua nomes de pessoas, e-mails, senhas ou dados sensíveis.",
            prompt:
              "Estou com problema para acessar minha conta desde ontem, aparece erro de senha inválida.",
            maxOutputTokens: 400,
            providerOptions: { lovable: { reasoningEffort: "none" } },
          });
          return Response.json({
            text: r.text,
            finishReason: r.finishReason,
            usage: r.usage,
          });
        } catch (e) {
          const err = e as Record<string, unknown>;
          return Response.json({
            erro: e instanceof Error ? e.message : String(e),
            nome: e instanceof Error ? e.name : null,
            status: err?.statusCode ?? err?.status ?? null,
            corpo: typeof err?.responseBody === "string" ? err.responseBody.slice(0, 500) : null,
          });
        }
      },
    },
  },
});
