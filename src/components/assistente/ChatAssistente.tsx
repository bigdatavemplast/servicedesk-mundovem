import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";
import { BookOpen, FileText, Ticket } from "lucide-react";
import assistenteLogo from "@/assets/assistente-mundovem.png";

export type Fonte = {
  origem: string;
  ref_id: string;
  titulo: string;
  similaridade: number;
};

type MetadadosMensagem = { fontes?: Fonte[]; confianca?: number };

const SUGESTOES = [
  "Como solicito acesso a um novo sistema?",
  "Como emitir um relatório no ERP Senior?",
  "Minha impressora não imprime, o que faço?",
  "Qual o prazo de atendimento de um chamado crítico?",
];

function iconeFonte(origem: string) {
  if (origem === "chamado") return Ticket;
  if (origem === "documento") return FileText;
  return BookOpen;
}

function linkFonte(fonte: Fonte) {
  if (fonte.origem === "chamado") return `/chamados/${fonte.ref_id}`;
  if (fonte.origem === "base_conhecimento") return `/base-conhecimento/${fonte.ref_id}`;
  return null;
}

function FontesCitadas({ fontes }: { fontes: Fonte[] }) {
  if (!fontes.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
      <span className="text-xs font-medium text-muted-foreground">Fontes:</span>
      {fontes.slice(0, 5).map((fonte, i) => {
        const Icone = iconeFonte(fonte.origem);
        const destino = linkFonte(fonte);
        const conteudo = (
          <Badge variant="secondary" className="gap-1 font-normal">
            <Icone className="h-3 w-3" />
            <span className="max-w-[220px] truncate">
              [{i + 1}] {fonte.titulo}
            </span>
          </Badge>
        );
        return destino ? (
          <Link key={`${fonte.ref_id}-${i}`} to={destino} className="hover:opacity-80">
            {conteudo}
          </Link>
        ) : (
          <span key={`${fonte.ref_id}-${i}`}>{conteudo}</span>
        );
      })}
    </div>
  );
}

export function ChatAssistente({
  conversationId,
  mensagensIniciais,
}: {
  conversationId: string;
  mensagensIniciais: UIMessage[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const queryClient = useQueryClient();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistente",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;
          return {
            headers,
            body: { ...body, messages, conversationId },
          };
        },
      }),
    [conversationId],
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    messages: mensagensIniciais,
    transport,
    onError: (erro) => toast.error(erro.message || "Erro ao falar com o assistente"),
    onFinish: () => {
      // Recarrega o histórico para exibir o título gerado na primeira mensagem.
      void queryClient.invalidateQueries({ queryKey: ["assistente", "conversas"] });
    },
  });

  const carregando = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!carregando) textareaRef.current?.focus();
  }, [carregando, conversationId]);

  function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || carregando) return;
    void sendMessage({ text: limpo });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <img
                src={assistenteLogo}
                alt="Assistente Mundo Vem"
                className="h-20 w-20 rounded-2xl object-cover shadow-sm"
              />
              <div>
                <h2 className="text-lg font-semibold">Olá! Sou o Assistente Mundo Vem</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Tire dúvidas sobre processos internos, ERP Senior, seus chamados e a base de
                  conhecimento antes de abrir um novo chamado.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const texto = message.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("");
              const meta = message.metadata as MetadadosMensagem | undefined;
              return (
                <Message key={message.id} from={message.role}>
                  <MessageContent>
                    <MessageResponse>{texto}</MessageResponse>
                    {message.role === "assistant" && (
                      <FontesCitadas fontes={meta?.fontes ?? []} />
                    )}
                  </MessageContent>
                </Message>
              );
            })
          )}

          {status === "submitted" && (
            <div className="px-2 py-3">
              <Shimmer>Consultando a base interna...</Shimmer>
            </div>
          )}

          {error && (
            <p className="px-2 py-3 text-sm text-destructive">
              {error.message || "Não foi possível concluir a resposta."}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t bg-background p-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            onSubmit={(message) => {
              enviar(message.text ?? "");
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              autoFocus
              placeholder="Pergunte sobre processos, ERP Senior, chamados..."
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={carregando && status !== "streaming"} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            As respostas usam a base interna do Mundo Vem. Se algo não for encontrado,{" "}
            <Link to="/chamados/novo" className="underline">
              abra um chamado
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
