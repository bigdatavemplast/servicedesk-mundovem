import { createFileRoute } from "@tanstack/react-router";
import { EditorArtigo } from "@/components/base-conhecimento/EditorArtigo";

export const Route = createFileRoute("/_authenticated/base-conhecimento/novo")({
  head: () => ({
    meta: [
      { title: "Novo artigo da base | Mundo Vem Service Desk" },
      { name: "description", content: "Crie um novo artigo de procedimento para a base de conhecimento interna do Service Desk." },
      { property: "og:title", content: "Novo artigo da base | Mundo Vem Service Desk" },
      { property: "og:description", content: "Crie um novo artigo de procedimento para a base de conhecimento interna do Service Desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Novo artigo da base | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Crie um novo artigo de procedimento para a base de conhecimento interna do Service Desk." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: () => <EditorArtigo />,
});
