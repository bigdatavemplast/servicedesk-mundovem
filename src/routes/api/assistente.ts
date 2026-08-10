```ts
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import {
  createLovableAiGatewayProvider,
  MODELO_CHAT,
} from "@/lib/ai-gateway.server";
import {
  montarPromptAgente,
  type Fonte,
} from "@/lib/assistente-rag.server";
import { criarFerramentasAssistente } from "@/lib/assistente-tools.server";
import { autenticarRequisicao } from "@/lib/supabase-request.server";

type CorpoRequisicao = {
  messages?: UIMessage[];
  conversationId?: string;
};

const CONFIANCA_MINIMA = 0.62;

function textoDaMensagem(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";

  return mensagem.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export const Route = createFileRoute("/api/assistente")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];

        if (!apiKey) {
          return new Response(
            JSON.stringify({
              error: "IA não configurada no servidor.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const sessao = await autenticarRequisicao(request);

        if (!sessao) {
          return new Response(
            JSON.stringify({
              error: "Sessão expirada. Entre novamente.",
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const { supabase, userId } = sessao;

        const corpo = (await request.json()) as CorpoRequisicao;
        const mensagens = Array.isArray(corpo.messages)
          ? corpo.messages
          : [];
        const conversationId = corpo.conversationId;

        if (!mensagens.length || !conversationId) {
          return new Response(
            JSON.stringify({
              error: "Requisição inválida.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        // A conversa precisa pertencer ao usuário.
        const { data: conversa, error: erroConversa } = await supabase
          .from("ai_conversations")
          .select("id, title, user_id")
          .eq("id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();

        if (erroConversa) {
          console.error(
            "[assistente] erro ao buscar conversa",
            erroConversa,
          );
        }

        if (!conversa) {
          return new Response(
            JSON.stringify({
              error: "Conversa não encontrada.",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const pergunta = textoDaMensagem(
          mensagens[mensagens.length - 1],
        );

        const { data: perfil } = await supabase
          .from("profiles")
          .select("nome")
          .eq("id", userId)
          .maybeSingle();

        // Persiste a pergunta do colaborador.
        const { error: erroUsuario } = await supabase
          .from("ai_messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            content: pergunta,
          });

        if (erroUsuario) {
          console.error(
            "[assistente] erro ao salvar pergunta",
            erroUsuario,
          );
        }

        /*
         * Gera o título somente quando a conversa ainda não possui título.
         * Usa o mesmo Lovable AI Gateway já utilizado pelo assistente.
         */
        const gateway = createLovableAiGatewayProvider(apiKey);

        if (!conversa.title) {
          let titulo = "";

          try {
            const tituloPrompt = `
Gere um título curto e profissional para esta solicitação de suporte.

Regras:
- Máximo de 6 palavras
- Não faça uma pergunta
- Não use aspas
- Não use ponto final
- Seja objetivo
- Descreva somente o assunto principal
- Responda somente com o título

Solicitação do usuário:
${pergunta}
`;

            const resultadoTitulo = await generateText({
              model: gateway(MODELO_CHAT),
              system:
                "Você gera títulos curtos e profissionais para solicitações de suporte.",
              prompt: tituloPrompt,
              providerOptions: {
                lovable: {
                  reasoningEffort: "none",
                },
              },
            });

            titulo = resultadoTitulo.text
              .trim()
              .replace(/^["']|["']$/g, "")
              .replace(/[.!?]+$/, "")
              .trim();
          } catch (erro) {
            console.error(
              "[assistente] erro ao gerar título com IA",
              erro,
            );
          }

          // Fallback: usa a própria pergunta se a IA falhar.
          if (!titulo) {
            titulo = pergunta
              .replace(/\s+/g, " ")
              .trim()
              .replace(/[.!?]+$/, "");

            if (titulo.length > 60) {
              titulo = `${titulo.slice(0, 57).trim()}…`;
            }
          }

          if (titulo) {
            console.log("[assistente] salvando título", {
              conversationId,
              titulo,
            });

            const { error: erroTitulo } = await supabase
              .from("ai_conversations")
              .update({ title: titulo })
              .eq("id", conversationId)
              .eq("user_id", userId);

            if (erroTitulo) {
              console.error(
                "[assistente] erro ao salvar título",
                erroTitulo,
              );
            } else {
              console.log(
                "[assistente] título salvo com sucesso",
              );
            }
          }
        }

        // Fontes coletadas pelas ferramentas durante o raciocínio do agente.
        const fontesUsadas: Fonte[] = [];
        let confianca = 0;

        const ferramentas = criarFerramentasAssistente({
          supabase,
          userId,
          apiKey,
          registrarFontes: (fontes) => {
            for (const f of fontes) {
              if (
                !fontesUsadas.some(
                  (x) => x.ref_id === f.ref_id,
                )
              ) {
                fontesUsadas.push(f);
              }

              confianca = Math.max(
                confianca,
                f.similaridade,
              );
            }
          },
        });

        let resultado;

        try {
          resultado = streamText({
            model: gateway(MODELO_CHAT),
            system: montarPromptAgente(
              perfil?.nome ?? null,
            ),
            messages: await convertToModelMessages(
              mensagens,
            ),
            tools: ferramentas,
            stopWhen: stepCountIs(50),
            providerOptions: {
              lovable: {
                reasoningEffort: "none",
              },
            },
            onFinish: async ({ text }) => {
              const { error } = await supabase
                .from("ai_messages")
                .insert({
                  conversation_id: conversationId,
                  user_id: userId,
                  role: "assistant",
                  content: text,
                  fontes:
                    fontesUsadas as unknown as never,
                  confianca,
                });

              if (error) {
                console.error(
                  "[assistente] erro ao salvar resposta",
                  error,
                );
              }

              await supabase
                .from("ai_conversations")
                .update({
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conversationId);

              if (confianca < CONFIANCA_MINIMA) {
                const { error: erroPergunta } =
                  await supabase
                    .from("perguntas_sem_resposta")
                    .insert({
                      pergunta,
                      contexto:
                        fontesUsadas
                          .map((f) => f.titulo)
                          .join(" | ") || null,
                      conversation_id:
                        conversationId,
                      user_id: userId,
                      confianca,
                    });

                if (erroPergunta) {
                  console.error(
                    "[assistente] erro ao registrar lacuna",
                    erroPergunta,
                  );
                }
              }
            },
          });
        } catch (erro) {
          console.error(
            "[assistente] falha no gateway",
            erro,
          );

          return new Response(
            JSON.stringify({
              error:
                "Não foi possível falar com a IA agora.",
            }),
            {
              status: 502,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        return resultado.toUIMessageStreamResponse({
          originalMessages: mensagens,
          messageMetadata: ({ part }) =>
            part.type === "finish"
              ? {
                  fontes: fontesUsadas,
                  confianca,
                }
              : undefined,
          onError: (erro) => {
            console.error(
              "[assistente] erro de streaming",
              erro,
            );

            const mensagem =
              erro instanceof Error
                ? erro.message
                : String(erro);

            if (mensagem.includes("429")) {
              return "Muitas solicitações agora. Tente em instantes.";
            }

            if (mensagem.includes("402")) {
              return "Os créditos de IA do workspace acabaram.";
            }

            return "Ocorreu um erro ao gerar a resposta.";
          },
        });
      },
    },
  },
});
```
