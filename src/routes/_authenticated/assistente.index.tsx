import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, MessageSquare } from "lucide-react";
import { listarConversas, criarConversa } from "@/lib/assistente.functions";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assistente/")({
  head: () => ({
    meta: [
      { title: "Assistente Inteligente | Mundo Vem Service Desk" },
      {
        name: "description",
        content:
          "Converse com o Assistente Inteligente do Mundo Vem para tirar dúvidas sobre processos, ERP Senior e chamados.",
      },
      { property: "og:title", content: "Assistente Inteligente | Mundo Vem Service Desk" },
      {
        property: "og:description",
        content: "Colaborador virtual do Service Desk da Vemplast com respostas baseadas na base interna.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EntradaAssistente,
});

/**
 * Entrada do Assistente: NUNCA cria conversa automaticamente.
 * Apenas lista o histórico do usuário logado (RLS garante que ele só vê as
 * próprias conversas) e deixa a criação exclusivamente no botão "Nova conversa".
 */
function EntradaAssistente() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const buscarConversas = useServerFn(listarConversas);
  const criar = useServerFn(criarConversa);

  const { data: conversas = [], isLoading } = useQuery({
    queryKey: ["assistente", "conversas"],
    queryFn: () => buscarConversas(),
  });

  async function novaConversa() {
    try {
      const res = await criar();
      await queryClient.invalidateQueries({ queryKey: ["assistente", "conversas"] });
      navigate({ to: "/assistente/$conversaId", params: { conversaId: res.id } });
    } catch {
      toast.error("Não foi possível iniciar uma nova conversa");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Bot className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Assistente Inteligente Mundo Vem</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Tire dúvidas sobre processos internos, ERP Senior, seus chamados e a base de conhecimento.
          </p>
        </div>
        <Button onClick={novaConversa} className="gap-2">
          <Plus className="h-4 w-4" /> Nova conversa
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-6">
          <Shimmer>Carregando seu histórico...</Shimmer>
        </div>
      ) : conversas.length > 0 ? (
        <section aria-label="Histórico de conversas">
          <h3 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
            Suas conversas anteriores
          </h3>
          <div className="divide-y overflow-hidden rounded-lg border bg-background">
            {conversas.map((c) => {
              const dataRef = c.updated_at ?? c.created_at;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    navigate({ to: "/assistente/$conversaId", params: { conversaId: c.id } })
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.title ?? "Nova conversa"}</span>
                  {dataRef && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(dataRef).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Você ainda não tem conversas salvas. Clique em "Nova conversa" para começar.
        </p>
      )}
    </div>
  );
}
