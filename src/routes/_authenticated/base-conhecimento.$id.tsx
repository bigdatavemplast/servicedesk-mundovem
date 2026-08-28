import { createFileRoute, Link, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, ThumbsUp, ThumbsDown } from "lucide-react";
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
    const descricao = loaderData?.resumo && loaderData.resumo.length >= 50 ? loaderData.resumo : `Procedimento "${nome}" publicado pela equipe do Service Desk da Mundo Vem.`;
    return { meta: [{ title: titulo }, { name: "description", content: descricao }, { property: "og:title", content: titulo }, { property: "og:description", content: descricao }, { property: "og:type", content: "article" }, { name: "robots", content: "noindex, follow" }] };
  },
  component: DetalhePage,
});

function DetalhePage() {
  const { id } = Route.useParams(); const { user } = Route.useRouteContext(); const navigate = useNavigate(); const location = useLocation(); const queryClient = useQueryClient();
  const [votando, setVotando] = useState(false); const registrouVisualizacao = useRef(false);
  if (location.pathname.endsWith("/editar")) return <Outlet />;
  const { data: roles = [] } = useQuery({ queryKey: ["my-roles", user.id], queryFn: async () => { const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id); return (data ?? []).map((r) => r.role as string); } });
  const podeEditar = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));
  const { data: artigo, isLoading } = useQuery({ queryKey: ["bc-artigo", id], queryFn: async () => { const { data, error } = await supabase.from("base_conhecimento").select("*").eq("id", id).maybeSingle(); if (error) console.error("Erro ao carregar artigo:", error); return data; } });
  const { data: feedback } = useQuery({
    queryKey: ["bc-feedback", id, user.id],
    enabled: !!artigo?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("obter_feedback_artigo_base_conhecimento", { p_artigo_id: artigo!.id });
      if (error) { console.error("Erro ao carregar avaliação:", error); return { util_sim: 0, util_nao: 0, total: 0, percentual: 0, meu_voto: null }; }
      return data as { util_sim: number; util_nao: number; total: number; percentual: number; meu_voto: "sim" | "nao" | null };
    },
  });
  useEffect(() => {
    if (!artigo?.id || registrouVisualizacao.current) return;
    registrouVisualizacao.current = true;
    supabase.rpc("incrementar_visualizacao_base_conhecimento", { p_artigo_id: artigo.id }).then(({ error }) => { if (error) { registrouVisualizacao.current = false; console.error("Erro ao registrar visualização:", error); } });
  }, [artigo?.id]);
  const avaliar = async (valor: "sim" | "nao") => {
    if (!artigo?.id || votando) return;
    setVotando(true);
    const { error } = await supabase.rpc("avaliar_artigo_base_conhecimento", { p_artigo_id: artigo.id, p_util: valor === "sim" });
    if (error) console.error("Erro ao registrar satisfação:", error);
    else await queryClient.invalidateQueries({ queryKey: ["bc-feedback", id, user.id] });
    setVotando(false);
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!artigo) return <p className="text-sm text-muted-foreground">Artigo não encontrado.</p>;
  const voto = feedback?.meu_voto ?? null;
  return <div className="mx-auto max-w-3xl space-y-4">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd({ "@context": "https://schema.org", "@type": "Article", headline: artigo.titulo, datePublished: artigo.criado_em, dateModified: (artigo as any).atualizado_em ?? artigo.criado_em, inLanguage: "pt-BR", author: { "@type": "Person", name: (artigo.autor as any)?.nome ?? "Mundo Vem" }, publisher: { "@type": "Organization", name: "Mundo Vem" } }) }} />
    <div className="flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => navigate({ to: "/base-conhecimento" })}><ArrowLeft className="mr-2 h-4 w-4" />Base de conhecimento</Button>{podeEditar && <Link to="/base-conhecimento/$id/editar" params={{ id: artigo.id }}><Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" />Editar</Button></Link>}</div>
    <div><div className="text-[10px] font-semibold uppercase tracking-wider text-primary">{(artigo.categoria as any)?.nome ?? "Geral"}</div><h1 className="text-3xl font-bold">{artigo.titulo}</h1><div className="mt-1 text-xs text-muted-foreground">Por {(artigo.autor as any)?.nome ?? "—"} · {new Date(artigo.criado_em).toLocaleDateString("pt-BR")} · {artigo.visualizacoes ?? 0} visualizações</div></div>
    <Card><CardContent className="prose max-w-none whitespace-pre-wrap p-6 text-sm leading-relaxed">{artigo.conteudo}</CardContent></Card>
    <Card><CardContent className="space-y-4 p-6"><div className="text-center font-medium">Este artigo foi útil?</div><div className="flex justify-center gap-3"><Button variant={voto === "sim" ? "default" : "outline"} disabled={votando || !!voto} onClick={() => avaliar("sim")}><ThumbsUp className="mr-2 h-4 w-4"/>Foi útil</Button><Button variant={voto === "nao" ? "default" : "outline"} disabled={votando || !!voto} onClick={() => avaliar("nao")}><ThumbsDown className="mr-2 h-4 w-4"/>Não foi útil</Button></div>{feedback && feedback.total > 0 && <div className="text-center text-xs text-muted-foreground">{feedback.util_sim} {feedback.util_sim === 1 ? "pessoa achou útil" : "pessoas acharam útil"} · {feedback.util_nao} {feedback.util_nao === 1 ? "avaliação negativa" : "avaliações negativas"} · {feedback.percentual}% de utilidade</div>}{voto && <p className="text-center text-sm text-muted-foreground">Obrigado pela avaliação.</p>}</CardContent></Card>
  </div>;
}
