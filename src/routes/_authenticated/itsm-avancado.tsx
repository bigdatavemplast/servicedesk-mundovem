import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, GitBranch, Monitor, Network, BookOpen, ShieldCheck, Scale, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-avancado")({
  beforeLoad: async ({ context }) => {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if ((roles ?? []).some((r) => r.role === "admin")) return;
    const { data: perms } = await supabase.from("itsm_permissoes_usuario").select("modulo").eq("user_id", context.user.id).eq("visualizar", true);
    if (!perms?.length) throw redirect({ to: "/dashboard" });
  },
  component: ItsmAvancado,
});

const modules = [
  ["Problemas", "Gerencie problemas e causas raiz.", AlertTriangle, "/itsm-problemas", "problemas"],
  ["Mudanças", "Planeje, aprove e acompanhe mudanças.", GitBranch, "/itsm-mudancas", "mudancas"],
  ["Ativos / CMDB", "Controle ativos e itens de configuração.", Monitor, "/itsm-ativos", "ativos"],
  ["Serviços", "Gerencie serviços de TI e negócio e seu ciclo de vida.", Network, "/itsm-servicos", "servicos"],
  ["Relacionamentos", "Visualize e mantenha dependências entre serviços e entidades ITSM.", Network, "/itsm-relacionamentos", "relacionamentos"],
  ["Catálogo", "Estruture a oferta de atendimento: categorias, subcategorias, tipos e regras.", ClipboardList, "/admin/catalogo", "catalogo"],
  ["Gestão de Conhecimento", "Administre artigos e conhecimento operacional.", BookOpen, "/itsm-conhecimento", "conhecimento"],
  ["Auditoria", "Acompanhe alterações e trilhas de auditoria.", ShieldCheck, "/itsm-auditoria", "auditoria"],
  ["Governança", "Controle políticas, revisões e evidências.", Scale, "/itsm-governanca", "governanca"],
] as const;

function ItsmAvancado() {
  const navigate = useNavigate();
  const { data: roles = [] } = useQuery({ queryKey: ["my-roles"], queryFn: async () => { const { data } = await supabase.from("user_roles").select("role"); return data ?? []; } });
  const isAdmin = roles.some((r: any) => r.role === "admin");
  const { data: perms = [] } = useQuery({ queryKey: ["my-itsm-module-permissions"], enabled: !isAdmin, queryFn: async () => { const { data, error } = await supabase.from("itsm_permissoes_usuario").select("modulo").eq("user_id", (await supabase.auth.getUser()).data.user?.id).eq("visualizar", true); if (error) throw error; return data ?? []; } });
  const allowed = new Set(perms.map((p: any) => p.modulo));
  const visibleModules = isAdmin ? modules : modules.map((m) => m[4] === "catalogo" ? [m[0], m[1], m[2], "/catalogo", m[4]] as const : m).filter((m) => allowed.has(m[4]));
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">ITSM Avançado</h1><p className="text-sm text-muted-foreground">Central de gestão dos processos avançados de ITSM.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleModules.map(([title, description, Icon, path]) => <Card key={title} className="cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30" onClick={() => navigate({ to: path })} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate({ to: path }); } }}><CardHeader className="flex flex-row items-center gap-3 space-y-0"><div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{description}</CardContent></Card> )}</div>
  </div>;
}
