import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bot, Plus } from "lucide-react";
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

function EntradaAssistente() {
  const navigate = useNavigate();
  const buscarConversas = useServerFn(listarConversas);
  const criar = useServerFn(criarConversa);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    buscarConversas()
      .then((conversas) => {
        if (cancelado) return;
        if (conversas.length > 0) {
          navigate({
            to: "/assistente/$conversaId",
            params: { conversaId: conversas[0].id },
            replace: true,
          });
        } else {
          setCarregando(false);
        }
      })
      .catch(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [buscarConversas, navigate]);

  async function novaConversa() {
    try {
      const res = await criar();
      navigate({ to: "/assistente/$conversaId", params: { conversaId: res.id } });
    } catch {
      toast.error("Não foi possível iniciar uma nova conversa");
    }
  }

  if (carregando) {
    return (
      <div className="grid h-full place-items-center">
        <Shimmer>Preparando o assistente...</Shimmer>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-12 text-center">
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
  );
}
