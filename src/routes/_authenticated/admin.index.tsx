import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  FileText,
  FolderTree,
  Layers3,
  ListChecks,
  Route as RouteIcon,
  Settings2,
  ShieldCheck,
  Ticket,
  Users,
  UsersRound,
  Workflow,
  ArrowRight,
  Database,
} from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Administração | Mundo Vem Service Desk" },
      { name: "description", content: "Painel administrativo do Service Desk." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) {
      throw redirect({ to: "/dashboard" });
    }
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
    {
      to: "/admin/usuarios",
      label: "Usuários",
      value: stats?.usuarios ?? "—",
      icon: Users,
      description: "Contas cadastradas",
    },
    {
      to: "/fila",
      label: "Chamados",
      value: stats?.chamados ?? "—",
      icon: Ticket,
      description: "Registros no Service Desk",
    },
    {
      to: "/admin/categorias",
      label: "Categorias",
      value: stats?.categorias ?? "—",
      icon: FolderTree,
      description: "Classificações principais",
    },
    {
      to: "/admin/categorias",
      label: "Subcategorias",
      value: stats?.subcategorias ?? "—",
      icon: ListChecks,
      description: "Classificações detalhadas",
    },
    {
      to: "/base-conhecimento",
      label: "Base de conhecimento",
      value: stats?.artigos ?? "—",
      icon: BookOpen,
      description: "Artigos disponíveis",
    },
  ];

  const sections = [
    {
      title: "Pessoas e acesso",
      description: "Controle quem utiliza a plataforma e o que cada usuário pode fazer.",
      icon: Users,
      items: [
        {
          to: "/admin/usuarios",
          title: "Usuários e permissões",
          desc: "Gerencie contas, papéis e permissões individuais.",
          icon: Users,
        },
        {
          to: "/admin/itsm-permissoes",
          title: "Permissões ITSM",
          desc: "Controle acesso aos módulos ITSM por usuário.",
          icon: Settings2,
        },
      ],
    },
    {
      title: "Catálogo e classificação",
      description: "Defina como os chamados são classificados e direcionados.",
      icon: ListChecks,
      items: [
        {
          to: "/admin/catalogo",
          title: "Catálogo",
          desc: "Estrutura de serviços e opções disponíveis ao solicitante.",
          icon: ListChecks,
        },
        {
          to: "/admin/categorias",
          title: "Categorias e subcategorias",
          desc: "Organize a classificação dos chamados.",
          icon: FolderTree,
        },
        {
          to: "/admin/tipos-chamado",
          title: "Tipos de chamado",
          desc: "Defina a natureza de cada atendimento.",
          icon: ListChecks,
        },
      ],
    },
    {
      title: "Operação e distribuição",
      description: "Configure segmentos, filas, atribuição e automações do atendimento.",
      icon: Workflow,
      items: [
        {
          to: "/admin/segmentos",
          title: "Segmentos",
          desc: "Defina as áreas responsáveis pelo atendimento.",
          icon: Layers3,
        },
        {
          to: "/admin/grupos",
          title: "Grupos de atendimento",
          desc: "Organize filas e associe os atendentes responsáveis.",
          icon: UsersRound,
        },
        {
          to: "/admin/regras-atribuicao",
          title: "Regras de atribuição",
          desc: "Configure a distribuição automática dos chamados.",
          icon: RouteIcon,
        },
        {
          to: "/admin/automacoes",
          title: "Automações",
          desc: "Configure eventos, condições e ações operacionais.",
          icon: Workflow,
        },
      ],
    },
    {
      title: "Governança e conhecimento",
      description: "Mantenha documentação, conhecimento e operação sob controle.",
      icon: ShieldCheck,
      items: [
        {
          to: "/admin/documentacao",
          title: "Documentação do sistema",
          desc: "Registre a documentação técnica e a evolução do Service Desk.",
          icon: FileText,
        },
        {
          to: "/base-conhecimento",
          title: "Base de conhecimento",
          desc: "Consulte e mantenha os artigos utilizados pelo atendimento.",
          icon: BookOpen,
        },
        {
          to: "/fila",
          title: "Fila de chamados",
          desc: "Acompanhe os chamados disponíveis para atendimento.",
          icon: Ticket,
        },
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Painel administrativo</h1>
              <Badge variant="secondary">Admin</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Central de configuração, governança e operação do Service Desk.
            </p>
          </div>
        </div>
        <Link
          to="/fila"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Ticket className="h-4 w-4" />
          Ver fila de chamados
        </Link>
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Visão geral</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => (
            <Link key={k.label} to={k.to} className="group block">
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                      <p className="mt-1 text-2xl font-bold tracking-tight">{k.value}</p>
                    </div>
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                      <k.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{k.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Configuração da plataforma</h2>
          <p className="text-sm text-muted-foreground">
            Acesse cada área administrativa sem sobrecarregar o painel com dezenas de atalhos iguais.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.title} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <div className="divide-y">
                  {section.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="group flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-background text-muted-foreground group-hover:border-primary/30 group-hover:text-primary">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{item.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
