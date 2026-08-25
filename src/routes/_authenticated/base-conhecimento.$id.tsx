import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { serializarJsonLd } from "@/lib/json-ld";

export const Route = createFileRoute("/_authenticated/base-conhecimento/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase.from("base_conhecimento").select("titulo,conteudo").eq("id", params.id).maybeSingle();
    const titulo = data?.titulo ?? null;
    const resumo = (data?.conteudo ?? "").replace(/\s+/g, " ").trim().slice(0, 155);
    return { titulo, resumo };
  },
  head: ({ params, loaderData }) => {
    const nome = loaderData?.titulo ?? `Artigo ${String(params.id).slice(0, 8)}`;
    const titulo = `${nome} | Base de conhecimento Mundo Vem`;
    const descricao = loaderData?.resumo && loaderData.resumo.length >= 50 ? loaderData.resumo : `Procedimento "${nome}" publicado pela equipe do Service Desk da Mundo Vem, com passo a passo para resolver a solicitação.`;
    return { meta: [{ title: titulo }, { name: "description", content: descricao }, { property: "og:title", content: titulo }, { property: "og:description", content: descricao }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" }, { name: "twitter:title", content: titulo }, { name: "twitter:description", content: descricao }, { name: "robots", content: "noindex, follow" }] };
  },
  component: DetalhePage,
});

function DetalhePage() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data: roles = [] } = useQuery({ queryKey: ["my-roles", user.id], queryFn: async () => { const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id); return (data ?? []).map((r) => r.role as string); } });
  const podeEditar = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));

  const { data: artigo, isLoading, error } = useQuery({ queryKey: ["bc-artigo", id], queryFn: async () => { const { data, error } = await supabase.from("base_conhecimento").select("id,titulo,conteudo,visualizacoes,publicado,criado_em,atualizado_em,categoria:categorias(nome)").eq("id", id).eq("publicado", true).maybeSingle(); if (error) throw error; return data; } });

  const { data: meuFeedback } = useQuery({ queryKey: ["bc-feedback", id, user.id], queryFn: async () => { const { data, error } = await supabase.from("base_conhecimento_feedback").select("util").eq("artigo_id", id).eq("usuario_id", user.id).maybeSingle(); if (error) throw error; return data; } });

  useEffect(() => { if (artigo?.id) { supabase.from("base_conhecimento").update({ visualizacoes: (artigo.visualizacoes ?? 0) + 1 } as never).eq("id", artigo.id).then(() => {}); } }, [artigo?.id]);

  const enviarFeedback = async (util: boolean) => {
    const { error: upsertError } = await supabase.from("base_conhecimento_feedback").upsert({ artigo_id: id, usuario_id: user.id, util }, { onConflict: "artigo_id,usuario_id" });
    if (upsertError) return;
    window.location.reload();
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="text-sm text-destructive">Não foi possível carregar este artigo.</p>;
  if (!artigo) return <p className="text-sm text-muted-foreground">Artigo não encontrado.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd({ "@context": "https://schema.org", "@type": "Article", headline: artigo.titulo, datePublished: artigo.criado_em, dateModified: artigo.atualizado_em ?? artigo.criado_em, inLanguage: "pt-BR", publisher: { "@type": "Organization", name: "Mundo Vem" } }) }} />
      <div className="flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => navigate({ to: "/base-conhecimento" })}><ArrowLeft className="mr-2 h-4 w-4" /> Base de conhecimento</Button>{podeEditar && <Link to="/base-conhecimento/$id/editar" params={{ id: artigo.id }}><Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" /> Editar</Button></Link>}</div>
      <div><div className="text-[10px] font-semibold uppercase tracking-wider text-primary">{(artigo.categoria as any)?.nome ?? "Geral"}</div><h1 className="text-3xl font-bold">{artigo.titulo}</h1><div className="mt-1 text-xs text-muted-foreground">{new Date(artigo.criado_em).toLocaleDateString("pt-BR")} · {artigo.visualizacoes ?? 0} visualizações</div></div>
      <Card><CardContent className="prose max-w-none whitespace-pre-wrap p-6 text-sm leading-relaxed">{artigo.conteudo}</CardContent></Card>
      <Card><CardContent className="p-5 text-center"><p className="font-medium">Este artigo foi útil?</p><p className="mt-1 text-xs text-muted-foreground">Seu feedback ajuda a melhorar a Base de Conhecimento.</p><div className="mt-4 flex justify-center gap-2"><Button variant={meuFeedback?.util === true ? "default" : "outline"} onClick={() => enviarFeedback(true)}><ThumbsUp className="mr-2 h-4 w-4" />Foi útil</Button><Button variant={meuFeedback?.util === false ? "default" : "outline"} onClick={() => enviarFeedback(false)}><ThumbsDown className="mr-2 h-4 w-4" />Não foi útil</Button></div></CardContent></Card>
    </div>
  );
}
