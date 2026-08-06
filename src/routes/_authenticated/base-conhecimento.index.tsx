import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Eye, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/base-conhecimento/")({
  head: () => ({
    meta: [
      { title: "Base de conhecimento | Mundo Vem Service Desk" },
      { name: "description", content: "Pesquise artigos e procedimentos internos para resolver dúvidas de TI e das demais áreas por conta própria." },
      { property: "og:title", content: "Base de conhecimento | Mundo Vem Service Desk" },
      { property: "og:description", content: "Pesquise artigos e procedimentos internos para resolver dúvidas de TI e das demais áreas por conta própria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Base de conhecimento | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Pesquise artigos e procedimentos internos para resolver dúvidas de TI e das demais áreas por conta própria." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: BasePage,
});

function BasePage() {
  const { user } = Route.useRouteContext();
  const [busca, setBusca] = useState("");

  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });
  const podeCriar = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));

  const { data: artigos = [], isLoading } = useQuery({
    queryKey: ["bc-artigos"],
    queryFn: async () => {
      const { data } = await supabase.from("base_conhecimento")
        .select("id,titulo,visualizacoes,publicado,criado_em,categoria:categorias(nome)")
        .eq("publicado", true)
        .order("criado_em", { ascending: false });
      return data ?? [];
    },
  });

  const filtrados = useMemo(() =>
    artigos.filter((a: any) => a.titulo?.toLowerCase().includes(busca.toLowerCase())),
    [artigos, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Base de conhecimento</h1>
          <p className="text-sm text-muted-foreground">Soluções, tutoriais e procedimentos.</p>
        </div>
        {podeCriar && (
          <Link to="/base-conhecimento/novo">
            <Button><PlusCircle className="mr-2 h-4 w-4" /> Novo artigo</Button>
          </Link>
        )}
      </div>

      <Input placeholder="Buscar por título (ex: VPN, Wi-Fi, impressora)…" value={busca} onChange={(e) => setBusca(e.target.value)} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtrados.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Nenhum artigo encontrado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((a: any) => (
            <Link key={a.id} to="/base-conhecimento/$id" params={{ id: a.id }}>
              <Card className="h-full border-t-4 border-primary/70 transition hover:shadow-md">
                <CardContent className="p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {a.categoria?.nome ?? "Geral"}
                  </div>
                  <div className="mt-1 flex items-start gap-2 font-semibold">
                    <BookOpen className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    {a.titulo}
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" /> {a.visualizacoes ?? 0} visualizações
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
