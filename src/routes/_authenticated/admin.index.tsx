import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderTree, ShieldCheck, Users, Ticket, BookOpen, Tag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administração | Mundo Vem Service Desk" },
      { name: "description", content: "Painel administrativo do Service Desk com acesso à gestão de usuários, categorias e conteúdos internos." },
      { property: "og:title", content: "Administração | Mundo Vem Service Desk" },
      { property: "og:description", content: "Painel administrativo do Service Desk com acesso à gestão de usuários, categorias e conteúdos internos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Administração | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Painel administrativo do Service Desk com acesso à gestão de usuários, categorias e conteúdos internos." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (!(data ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const { data: stats } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [u, c, s, ch, kb] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("categorias").select("id", { count: "exact", head: true }),
        supabase.from("subcategorias").select("id", { count: "exact", head: true }),
        supabase.from("chamados").select("id", { count: "exact", head: true }),
        supabase.from("base_conhecimento").select("id", { count: "exact", head: true }),
      ]);
      return {
        usuarios: u.count ?? 0,
        categorias: c.count ?? 0,
        subcategorias: s.count ?? 0,
        chamados: ch.count ?? 0,
        artigos: kb.count ?? 0,
      };
    },
  });

  const kpis = [
    { label: "Usuários", value: stats?.usuarios ?? "—", icon: Users, color: "text-blue-500" },
    { label: "Categorias", value: stats?.categorias ?? "—", icon: FolderTree, color: "text-orange-500" },
    { label: "Subcategorias", value: stats?.subcategorias ?? "—", icon: Tag, color: "text-amber-500" },
    { label: "Chamados", value: stats?.chamados ?? "—", icon: Ticket, color: "text-emerald-500" },
    { label: "Artigos KB", value: stats?.artigos ?? "—", icon: BookOpen, color: "text-purple-500" },
  ];

  const tools = [
    { to: "/admin/categorias", title: "Categorias e Subcategorias", desc: "Organize os tipos de chamado disponíveis para abertura.", icon: FolderTree },
    { to: "/admin/usuarios", title: "Usuários e Permissões", desc: "Gerencie papéis (colaborador, atendente, gestor, admin) e ative/desative contas.", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Painel administrativo</h1>
          <p className="text-sm text-muted-foreground">Configurações e gestão da plataforma</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-2xl font-bold">{k.value}</div>
              </div>
              <k.icon className={`h-8 w-8 ${k.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.to} to={t.to} className="block">
            <Card className="h-full transition-colors hover:border-primary hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{t.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
