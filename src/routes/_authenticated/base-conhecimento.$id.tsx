import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil } from "lucide-react";
import { serializarJsonLd } from "@/lib/json-ld";

export const Route = createFileRoute("/_authenticated/base-conhecimento/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("base_conhecimento")
      .select("titulo,conteudo")
      .eq("id", params.id)
      .maybeSingle();
    const titulo = data?.titulo ?? null;
    const resumo = (data?.conteudo ?? "").replace(/\s+/g, " ").trim().slice(0, 155);
    return { titulo, resumo };
  },
  head: ({ params, loaderData }) => {
    const nome = loaderData?.titulo ?? `Artigo ${String(params.id).slice(0, 8)}`;
    const titulo = `${nome} | Base de conhecimento Mundo Vem`;
    const descricao =
      loaderData?.resumo && loaderData.resumo.length >= 50
        ? loaderData.resumo
        : `Procedimento "${nome}" publicado pela equipe do Service Desk da Mundo Vem, com passo a passo para resolver a solicitação.`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descricao },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descricao },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: titulo },
        { name: "twitter:description", content: descricao },
        { name: "robots", content: "noindex, follow" },
      ],
    };
  },
  component: DetalhePage,
});

function DetalhePage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });
  const podeEditar = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));

  const { data: artigo, isLoading } = useQuery({
    queryKey: ["bc-artigo", id],
    queryFn: async () => {
      const { data } = await supabase.from("base_conhecimento")
        .select("*, categoria:categorias(nome), autor:profiles(nome)")
        .eq("id", id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (artigo?.id) {
      supabase.rpc as any; // noop
      supabase.from("base_conhecimento").update({ visualizacoes: (artigo.visualizacoes ?? 0) + 1 } as never).eq("id", artigo.id).then(() => {});
    }
  }, [artigo?.id]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!artigo) return <p className="text-sm text-muted-foreground">Artigo não encontrado.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializarJsonLd({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: artigo.titulo,
            datePublished: artigo.criado_em,
            dateModified: (artigo as any).atualizado_em ?? artigo.criado_em,
            inLanguage: "pt-BR",
            author: { "@type": "Person", name: (artigo.autor as any)?.nome ?? "Mundo Vem" },
            publisher: { "@type": "Organization", name: "Mundo Vem" },
          }),
        }}
      />

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/base-conhecimento" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Base de conhecimento
        </Button>
        {podeEditar && (
          <Link to="/base-conhecimento/$id/editar" params={{ id: artigo.id }}>
            <Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" /> Editar</Button>
          </Link>
        )}
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          {(artigo.categoria as any)?.nome ?? "Geral"}
        </div>
        <h1 className="text-3xl font-bold">{artigo.titulo}</h1>
        <div className="mt-1 text-xs text-muted-foreground">
          Por {(artigo.autor as any)?.nome ?? "—"} · {new Date(artigo.criado_em).toLocaleDateString("pt-BR")} · {artigo.visualizacoes ?? 0} visualizações
        </div>
      </div>

      <Card>
        <CardContent className="prose max-w-none whitespace-pre-wrap p-6 text-sm leading-relaxed">
          {artigo.conteudo}
        </CardContent>
      </Card>
    </div>
  );
}
