import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { Bot, X, Plus, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ChatAssistente } from "@/components/assistente/ChatAssistente";
import {
  listarConversas,
  carregarMensagens,
  criarConversa,
} from "@/lib/assistente.functions";

/**
 * Atalho flutuante para o mesmo Assistente Inteligente da rota /assistente.
 * Reutiliza os server functions e o componente ChatAssistente existentes.
 */
export function AssistenteFlutuante() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<UIMessage[]>([]);

  const queryClient = useQueryClient();
  const buscarConversas = useServerFn(listarConversas);
  const buscarMensagens = useServerFn(carregarMensagens);
  const criar = useServerFn(criarConversa);

  useEffect(() => {
    if (!aberto || conversaId) return;
    let cancelado = false;
    setCarregando(true);
    buscarConversas()
      .then(async (conversas) => {
        if (cancelado) return;
        if (conversas.length === 0) {
          setCarregando(false);
          return;
        }
        const id = conversas[0].id;
        const hist = await buscarMensagens({ data: { conversationId: id } });
        if (cancelado) return;
        setConversaId(id);
        setMensagens(
          (hist?.mensagens ?? []).map((m) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "user",
            parts: [{ type: "text" as const, text: m.content }],
            metadata: { fontes: m.fontes, confianca: m.confianca },
          })),
        );
        setCarregando(false);
      })
      .catch(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [aberto, conversaId, buscarConversas, buscarMensagens]);

  async function novaConversa() {
    try {
      setCarregando(true);
      const res = await criar();
      await queryClient.invalidateQueries({ queryKey: ["assistente", "conversas"] });
      setConversaId(res.id);
      setMensagens([]);
    } catch {
      toast.error("Não foi possível iniciar uma nova conversa");
    } finally {
      setCarregando(false);
    }
  }

  // Evita duplicar o assistente quando o usuário já está na página dele.
  if (pathname.startsWith("/assistente")) return null;

  return (
    <>
      {aberto && (
        <div className="fixed bottom-36 right-4 z-50 flex h-[min(70vh,560px)] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl sm:bottom-40 sm:right-6">

          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-semibold">Assistente Mundo Vem</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Nova conversa"
                onClick={novaConversa}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {conversaId && (
                <a
                  href={`/assistente/${conversaId}`}
                  aria-label="Abrir assistente em tela cheia"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                >
                  <Maximize2 className="h-4 w-4" />
                </a>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Fechar assistente"
                onClick={() => setAberto(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {carregando ? (
              <div className="grid flex-1 place-items-center">
                <Shimmer>Preparando o assistente...</Shimmer>
              </div>
            ) : conversaId ? (
              <ChatAssistente
                key={conversaId}
                conversationId={conversaId}
                mensagensIniciais={mensagens}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhuma conversa encontrada. Inicie uma nova para falar com o assistente.
                </p>
                <Button onClick={novaConversa} className="gap-2">
                  <Plus className="h-4 w-4" /> Nova conversa
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar assistente" : "Abrir assistente"}
        className="fixed bottom-4 right-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90 sm:bottom-6 sm:right-6"
      >
        {aberto ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </>
  );
}
