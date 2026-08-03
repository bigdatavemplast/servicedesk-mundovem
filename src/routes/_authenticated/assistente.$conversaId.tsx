import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChatAssistente } from "@/components/assistente/ChatAssistente";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  listarConversas,
  carregarMensagens,
  criarConversa,
  excluirConversa,
} from "@/lib/assistente.functions";

export const Route = createFileRoute("/_authenticated/assistente/$conversaId")({
  head: () => ({
    meta: [
      { title: "Assistente Inteligente | Mundo Vem Service Desk" },
      {
        name: "description",
        content:
          "Converse com o Assistente Inteligente do Mundo Vem: respostas baseadas na base de conhecimento, chamados e documentos internos.",
      },
      { property: "og:title", content: "Assistente Inteligente | Mundo Vem Service Desk" },
      {
        property: "og:description",
        content: "Colaborador virtual do Service Desk da Vemplast com fontes citadas e histórico de conversas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaginaAssistente,
});

function PaginaAssistente() {
  const { conversaId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const buscarConversas = useServerFn(listarConversas);
  const buscarMensagens = useServerFn(carregarMensagens);
  const criar = useServerFn(criarConversa);
  const excluir = useServerFn(excluirConversa);

  const { data: conversas = [] } = useQuery({
    queryKey: ["assistente", "conversas"],
    queryFn: () => buscarConversas(),
  });

  const { data: historico, isLoading } = useQuery({
    queryKey: ["assistente", "mensagens", conversaId],
    queryFn: () => buscarMensagens({ data: { conversationId: conversaId } }),
  });

  const mensagensIniciais: UIMessage[] = (historico?.mensagens ?? []).map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? "assistant" : "user",
    parts: [{ type: "text" as const, text: m.content }],
    metadata: { fontes: m.fontes, confianca: m.confianca },
  }));

  async function novaConversa() {
    try {
      const res = await criar();
      await queryClient.invalidateQueries({ queryKey: ["assistente", "conversas"] });
      navigate({ to: "/assistente/$conversaId", params: { conversaId: res.id } });
    } catch {
      toast.error("Não foi possível iniciar uma nova conversa");
    }
  }

  async function removerConversa(id: string) {
    try {
      await excluir({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["assistente", "conversas"] });
      if (id === conversaId) navigate({ to: "/assistente" });
    } catch {
      toast.error("Não foi possível excluir a conversa");
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="p-3">
          <Button onClick={novaConversa} className="w-full gap-2">
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversas.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                c.id === conversaId ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/assistente/$conversaId", params: { conversaId: c.id } })
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{c.title ?? "Nova conversa"}</span>
              </button>
              <button
                type="button"
                aria-label="Excluir conversa"
                onClick={() => removerConversa(c.id)}
                className="opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Shimmer>Carregando conversa...</Shimmer>
          </div>
        ) : (
          <ChatAssistente
            key={conversaId}
            conversationId={conversaId}
            mensagensIniciais={mensagensIniciais}
          />
        )}
      </main>
    </div>
  );
}
