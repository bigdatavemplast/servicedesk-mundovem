import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Ticket, PlusCircle, BookOpen, LogOut, Users, FolderTree, ShieldCheck, Bot, MessageSquare } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";
import { AssistenteFlutuante } from "@/components/assistente/AssistenteFlutuante";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

function AppShell() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });
  const isStaff = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));
  const canDashboard = roles.some((r) => ["gestor", "admin"].includes(r));
  const isAdmin = roles.includes("admin");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sections: { title: string; items: { to: string; icon: any; label: string }[] }[] = [
    {
      title: "PRINCIPAL",
      items: [
        ...(canDashboard ? [{ to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }] : []),
        { to: "/assistente", icon: Bot, label: "Assistente" },
        { to: "/chamados/novo", icon: PlusCircle, label: "Novo chamado" },
        { to: "/chamados", icon: Ticket, label: "Meus chamados" },
        { to: "/base-conhecimento", icon: BookOpen, label: "Base de conhecimento" },
      ],
    },
    ...(isStaff
      ? [{
          title: "ATENDIMENTO",
          items: [{ to: "/fila", icon: Users, label: "Fila de atendimento" }],
        }]
      : []),
    ...(isAdmin
      ? [{
          title: "ADMIN",
          items: [
            { to: "/admin", icon: ShieldCheck, label: "Painel admin" },
            { to: "/admin/categorias", icon: FolderTree, label: "Categorias" },
            { to: "/admin/usuarios", icon: Users, label: "Usuários" },
            { to: "/admin/assistente", icon: MessageSquare, label: "Conversas IA" },
          ],
        }]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="hidden w-64 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Ticket className="h-4 w-4" />
          </div>
          <span>Mundo Vem SD</span>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map(({ to, icon: Icon, label }) => {
                  const active = pathname === to || (to !== "/dashboard" && to !== "/admin" && pathname.startsWith(to)) || (to === "/admin" && pathname === "/admin");
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{user.email}</div>
          {isAdmin && <div className="mb-2 px-2 text-[10px] font-semibold uppercase text-primary">Admin</div>}
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden">
        <header className="flex h-16 items-center justify-between border-b bg-background px-6">
          <span className="font-semibold md:hidden">Vemplast SD</span>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <NotificationBell userId={user.id} />
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={handleSignOut}
              aria-label="Sair do portal"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>

      <AssistenteFlutuante />

    </div>
  );
}
