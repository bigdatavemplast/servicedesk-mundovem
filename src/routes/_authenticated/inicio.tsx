import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useModoAtendimento } from "@/hooks/use-modo-atendimento";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, ChartNoAxesCombined, ClipboardList, PlusCircle, Ticket, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início | Mundo Vem Service Desk" }, { name: "description", content: "Acesse rapidamente os serviços e chamados da sua área." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async () => {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem("service_desk_segmento") : null;
      if (!raw || !JSON.parse(raw)?.id) throw redirect({ to: "/areas" });
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/areas" });
    }
  },
  component: InicioPage,
});

function lerArea() {
  try {
    const raw = localStorage.getItem("service_desk_segmento");
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value?.id ? { id: String(value.id), nome: String(value.nome ?? "") } : null;
  } catch {
    return null;
  }
}

function InicioPage() {
  const { user } = Route.useRouteContext();
  const area = lerArea();
  const { data: roles = [] } = useQuery({
    queryKey: ["inicio-roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((item) => String(item.role));
    },
  });
  const isAtendente = roles.includes("atendente");
  const { modo } = useModoAtendimento(user.id, isAtendente);
  const isColaborador = roles.includes("colaborador") || roles.includes("gestor") || roles.includes("admin") || (isAtendente && modo === "colaborador");
  const isStaff = isAtendente || roles.includes("admin");
  const primeiroNome = user.user_metadata?.nome?.trim?.()?.split(/\s+/)[0] || user.email?.split("@")[0] || "Olá";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">{area?.nome ? `Área: ${area.nome}` : "Service Desk Vemplast"}</p>
        <h1 className="text-3xl font-bold tracking-tight">Como podemos ajudar{primeiroNome !== "Olá" ? `, ${primeiroNome}` : ""}?</h1>
        <p className="max-w-2xl text-muted-foreground">Escolha uma opção para continuar. Você pode acompanhar suas solicitações ou acessar as ferramentas da sua equipe.</p>
      </div>

      {isColaborador && (
        <section className="space-y-3" aria-labelledby="acoes-colaborador">
          <h2 id="acoes-colaborador" className="text-lg font-semibold">Minhas solicitações</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex flex-col transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><PlusCircle className="h-6 w-6" /></div>
                <CardTitle>Abrir chamado</CardTitle>
                <CardDescription>Solicite suporte ou registre uma necessidade da sua área.</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link to="/chamados/novo" className="block"><Button className="w-full justify-between">Criar solicitação <ArrowRight className="h-4 w-4" /></Button></Link>
              </CardContent>
            </Card>
            <Card className="flex flex-col transition-colors hover:border-primary/50">
              <CardHeader>
                <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-muted text-foreground"><ClipboardList className="h-6 w-6" /></div>
                <CardTitle>Meus chamados</CardTitle>
                <CardDescription>Consulte o andamento, as atualizações e os chamados concluídos.</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Link to="/chamados/" className="block"><Button variant="outline" className="w-full justify-between">Consultar chamados <ArrowRight className="h-4 w-4" /></Button></Link>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {isStaff && (
        <section className="space-y-3" aria-labelledby="acoes-atendimento">
          <h2 id="acoes-atendimento" className="text-lg font-semibold">Atendimento</h2>
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Users className="h-6 w-6" /></div>
                <div><h3 className="font-semibold">Fila de atendimento</h3><p className="text-sm text-muted-foreground">Localize chamados novos, pendentes e aguardando atribuição.</p></div>
              </div>
              <Link to="/fila"><Button variant="outline" className="w-full sm:w-auto">Abrir fila <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="mais-acessos">
        <h2 id="mais-acessos" className="text-lg font-semibold">Outros acessos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/dashboard" className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><ChartNoAxesCombined className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><h3 className="font-medium">Dashboard</h3><p className="text-sm text-muted-foreground">Indicadores e gráficos de atendimento.</p></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
          <Link to="/base-conhecimento/" className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><BookOpen className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><h3 className="font-medium">Base de conhecimento</h3><p className="text-sm text-muted-foreground">Encontre orientações e soluções úteis.</p></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Ticket className="mr-2 inline h-4 w-4" />Dica: para acompanhar uma solicitação, acesse “Meus chamados” e pesquise pelo número ou título.
      </div>
    </div>
  );
}
