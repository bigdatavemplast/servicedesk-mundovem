import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { criarConversa } from "@/lib/assistente.functions";
import { Shimmer } from "@/components/ai-elements/shimmer";

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
  component: NovaConversa,
});

function NovaConversa() {
  const navigate = useNavigate();
  const criar = useServerFn(criarConversa);

  useEffect(() => {
    let cancelado = false;
    criar()
      .then((res) => {
        if (!cancelado) {
          navigate({ to: "/assistente/$conversaId", params: { conversaId: res.id }, replace: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [criar, navigate]);

  return (
    <div className="grid h-full place-items-center">
      <Shimmer>Preparando o assistente...</Shimmer>
    </div>
  );
}
