import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gestao")({
  head: () => ({ meta: [{ title: "Gestão do atendimento | Mundo Vem Service Desk" }, { name: "description", content: "Indicadores de volume, tempo médio de atendimento, SLA e satisfação do Service Desk da Mundo Vem." }, { property: "og:title", content: "Gestão do atendimento | Mundo Vem Service Desk" }, { property: "og:description", content: "Indicadores de volume, tempo médio de atendimento, SLA e satisfação do Service Desk da Mundo Vem." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => ["gestor", "admin"].includes(String(r.role)))) throw redirect({ to: "/dashboard" });
  },
  component: GestaoLayout,
});

function GestaoLayout() {
  return <Outlet />;
}
