import { createFileRoute } from "@tanstack/react-router";
import { EditorArtigo } from "@/components/base-conhecimento/EditorArtigo";

export const Route = createFileRoute("/_authenticated/base-conhecimento/$id/editar")({
  head: () => ({
    meta: [
      { title: "Editar artigo da base | Mundo Vem Service Desk" },
      { name: "description", content: "Atualize o conteúdo de um artigo da base de conhecimento interna do Service Desk da Mundo Vem." },
      { property: "og:title", content: "Editar artigo da base | Mundo Vem Service Desk" },
      { property: "og:description", content: "Atualize o conteúdo de um artigo da base de conhecimento interna do Service Desk da Mundo Vem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Editar artigo da base | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Atualize o conteúdo de um artigo da base de conhecimento interna do Service Desk da Mundo Vem." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: EditarPage,
});

function EditarPage() {
  const { id } = Route.useParams();
  return <EditorArtigo id={id} />;
}
