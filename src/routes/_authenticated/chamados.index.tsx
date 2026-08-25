import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, Clock3, CheckCircle2, MessageCircle, Ticket, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chamados/")({
  head: () => ({ meta: [
    { title: "Meus chamados | Mundo Vem Service Desk" },
    { name: "description", content: "Consulte e acompanhe seus chamados de TI e demais áreas." },
    { name: "robots", content: "noindex, follow" },
  ] }),
  component: ChamadosPage,
});

const statusLabel: Record<string, string> = { aberto: "Aberto", em_andamento: "Em andamento", aguardando_usuario: "Aguardando você", aguardando_terceiro: "Aguardando terceiro", resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado" };
const prioLabel: Record<string, string> = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };

function ChamadosPage() {
  const { user } = Route.useRouteContext();
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const { data: chamados = [], isLoading } = useQuery({
    queryKey: ["meus-chamados", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamados").select("id, numero, titulo, status, prioridade, aberto_em").order("aberto_em", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = chamados.length;
  const abertos = chamados.filter((c) => ["aberto", "em_andamento", "aguardando_terceiro"].includes(c.status)).length;
  const aguardando = chamados.filter((c) => c.status === "aguardando_usuario").length;
  const resolvidos = chamados.filter((c) => ["resolvido", "fechado"].includes(c.status)).length;
  const chamadosVisiveis = mostrarTodos ? chamados : chamados.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold">Olá! 👋</h1><p className="text-sm text-muted-foreground">Acompanhe seus chamados ou abra um novo atendimento.</p></div>
        <Link to="/chamados/novo"><Button><PlusCircle className="mr-2 h-4 w-4" />Abrir chamado</Button></Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<Ticket className="h-4 w-4" />} label="Meus chamados" value={total} />
        <SummaryCard icon={<Clock3 className="h-4 w-4" />} label="Em andamento" value={abertos} />
        <SummaryCard icon={<MessageCircle className="h-4 w-4" />} label="Aguardando minha resposta" value={aguardando} />
        <SummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Resolvidos" value={resolvidos} />
      </div>

      <Card><CardContent className="p-0">
        <div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Chamados recentes</h2><p className="text-xs text-muted-foreground">Os últimos atendimentos abertos por você.</p></div>{chamados.length > 8 && <Button variant="ghost" size="sm" onClick={() => setMostrarTodos((v) => !v)}>{mostrarTodos ? <><ChevronUp className="mr-2 h-4 w-4" />Mostrar recentes</> : <>Ver todos</>}</Button>}</div>
        {isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div> : !chamados.length ? <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Você ainda não possui chamados.</p><Link to="/chamados/novo"><Button className="mt-4"><PlusCircle className="mr-2 h-4 w-4" />Abrir meu primeiro chamado</Button></Link></div> : <div className="divide-y">{chamadosVisiveis.map((c) => <Link key={c.id} to="/chamados/$id" params={{ id: c.id }} className="flex items-center justify-between gap-4 p-4 hover:bg-muted/40"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{c.numero}</span><Badge variant="secondary">{prioLabel[c.prioridade] ?? c.prioridade}</Badge></div><div className="truncate font-medium">{c.titulo}</div><div className="text-xs text-muted-foreground">Aberto em {new Date(c.aberto_em).toLocaleString("pt-BR")}</div></div><Badge>{statusLabel[c.status] ?? c.status}</Badge></Link>)}</div>}
      </CardContent></Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-md bg-muted p-2">{icon}</div><div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div></CardContent></Card>; }
