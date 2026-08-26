import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Clock3, DollarSign, Gauge, Headphones, ShieldCheck, Star, TrendingUp, Users, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/gestao")({
  head: () => ({ meta: [{ title: "Gestão | Mundo Vem Service Desk" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => ["gestor", "admin"].includes(String(r.role)))) throw redirect({ to: "/dashboard" });
  },
  component: GestaoPage,
});

type Chamado = {
  id: string; status: string; criado_em: string; resolvido_em: string | null; prazo_resolucao: string | null;
  sla_resolucao_violado: boolean; primeira_chamada_resolvida: boolean | null; escalonado: boolean;
  atendimento_abandonado: boolean; tempo_atendimento_minutos: number | null; custo_atendimento: number | null;
  atendente_id: string | null;
};

type Avaliacao = { chamado_id: string; nota: number; criado_em: string };
type Capacidade = { usuario_id: string | null; grupo_atendimento_id: string | null; horas_disponiveis_semana: number; custo_hora: number; ativo: boolean };

const CLOSED = ["resolvido", "fechado", "cancelado"];
const sinceDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };
const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000);
const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : null;

function Kpi({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: any }) {
  return <Card><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

function formatHours(value: number | null) { return value == null ? "—" : value < 1 ? `${Math.round(value * 60)} min` : `${value.toFixed(1)} h`; }
function formatMoney(value: number | null) { return value == null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function GestaoPage() {
  const [dias, setDias] = useState("30");
  const days = Number(dias);
  const { data: chamados = [], isLoading } = useQuery({
    queryKey: ["gestao-chamados", days],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chamados")
        .select("id,status,criado_em,resolvido_em,prazo_resolucao,sla_resolucao_violado,primeira_chamada_resolvida,escalonado,atendimento_abandonado,tempo_atendimento_minutos,custo_atendimento,atendente_id")
        .gte("criado_em", sinceDate(days)).order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chamado[];
    },
  });
  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["gestao-csat", days],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("avaliacoes_atendimento").select("chamado_id,nota,criado_em").gte("criado_em", sinceDate(days));
      if (error) return [];
      return (data ?? []) as Avaliacao[];
    },
  });
  const { data: capacidade = [] } = useQuery({
    queryKey: ["gestao-capacidade"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("gestao_capacidade").select("usuario_id,grupo_atendimento_id,horas_disponiveis_semana,custo_hora,ativo").eq("ativo", true);
      if (error) return [];
      return (data ?? []) as Capacidade[];
    },
  });

  const metrics = useMemo(() => {
    const resolved = chamados.filter((c) => CLOSED.includes(c.status));
    const withFirst = chamados.filter((c) => c.primeira_chamada_resolvida !== null);
    const fcr = pct(withFirst.filter((c) => c.primeira_chamada_resolvida).length, withFirst.length);
    const times = resolved.filter((c) => c.resolvido_em).map((c) => hoursBetween(c.criado_em, c.resolvido_em!));
    const tma = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const slaEligible = chamados.filter((c) => c.prazo_resolucao || c.sla_resolucao_violado);
    const sla = pct(slaEligible.filter((c) => !c.sla_resolucao_violado && (!c.prazo_resolucao || !c.resolvido_em || new Date(c.resolvido_em) <= new Date(c.prazo_resolucao))).length, slaEligible.length);
    const avgCsat = avaliacoes.length ? avaliacoes.reduce((a, b) => a + b.nota, 0) / avaliacoes.length : null;
    const escal = pct(chamados.filter((c) => c.escalonado).length, chamados.length);
    const abandon = pct(chamados.filter((c) => c.atendimento_abandonado).length, chamados.length);
    const costs = chamados.map((c) => c.custo_atendimento).filter((v): v is number => v != null);
    const costTotal = costs.length ? costs.reduce((a, b) => a + b, 0) : null;
    const costPer = costTotal != null && resolved.length ? costTotal / resolved.length : null;
    const active = chamados.filter((c) => !CLOSED.includes(c.status)).length;
    const productiveMinutes = chamados.reduce((sum, c) => sum + (c.tempo_atendimento_minutos ?? 0), 0);
    const capacityHours = capacidade.reduce((sum, c) => sum + Number(c.horas_disponiveis_semana), 0) * (days / 7);
    const utilization = capacityHours ? Math.min(999, (productiveMinutes / 60 / capacityHours) * 100) : null;
    return { total: chamados.length, resolved: resolved.length, active, fcr, tma, sla, avgCsat, escal, abandon, costTotal, costPer, utilization };
  }, [avaliacoes, capacidade, chamados, days]);

  const trend = useMemo(() => {
    const map = new Map<string, { periodo: string; abertos: number; resolvidos: number; backlog: number }>();
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); map.set(key, { periodo: key.slice(5), abertos: 0, resolvidos: 0, backlog: 0 }); }
    chamados.forEach((c) => { const a = map.get(c.criado_em.slice(0, 10)); if (a) a.abertos++; if (c.resolvido_em) { const r = map.get(c.resolvido_em.slice(0, 10)); if (r) r.resolvidos++; } });
    let backlog = 0; return Array.from(map.values()).map((p) => { backlog += p.abertos - p.resolvidos; return { ...p, backlog }; });
  }, [chamados, days]);

  const agentRows = useMemo(() => {
    const map = new Map<string, { agente: string; total: number; resolvidos: number; minutos: number; escalados: number }>();
    chamados.filter((c) => c.atendente_id).forEach((c) => { const key = c.atendente_id!; const row = map.get(key) ?? { agente: key.slice(0, 8), total: 0, resolvidos: 0, minutos: 0, escalados: 0 }; row.total++; if (CLOSED.includes(c.status)) row.resolvidos++; row.minutos += c.tempo_atendimento_minutos ?? 0; if (c.escalonado) row.escalados++; map.set(key, row); });
    return Array.from(map.values()).sort((a, b) => b.resolvidos - a.resolvidos).slice(0, 8);
  }, [chamados]);

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando indicadores de gestão…</div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Gestão do Service Desk</h1><p className="text-sm text-muted-foreground">KPIs operacionais, produtividade, SLA, qualidade, custos, capacidade e tendências.</p></div>
      <Select value={dias} onValueChange={setDias}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="15">Últimos 15 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent></Select>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi title="Volume de chamados" value={String(metrics.total)} hint={`${metrics.resolved} resolvidos no período`} icon={Headphones} />
      <Kpi title="FCR · 1ª chamada" value={metrics.fcr == null ? "—" : `${metrics.fcr}%`} hint={metrics.fcr == null ? "Sem dados marcados" : "quanto maior, melhor"} icon={Zap} />
      <Kpi title="TMA · resolução" value={formatHours(metrics.tma)} hint="tempo médio do chamado" icon={Clock3} />
      <Kpi title="Conformidade SLA" value={metrics.sla == null ? "—" : `${metrics.sla}%`} hint={metrics.sla == null ? "Sem SLA mensurável" : "dentro do prazo"} icon={ShieldCheck} />
      <Kpi title="CSAT" value={metrics.avgCsat == null ? "—" : `${metrics.avgCsat.toFixed(1)}/5`} hint={avaliacoes.length ? `${avaliacoes.length} avaliações` : "Sem avaliações no período"} icon={Star} />
      <Kpi title="Escalonamento" value={metrics.escal == null ? "—" : `${metrics.escal}%`} hint="chamados escalonados" icon={TrendingUp} />
      <Kpi title="Abandono" value={metrics.abandon == null ? "—" : `${metrics.abandon}%`} hint="atendimentos marcados como abandonados" icon={Activity} />
      <Kpi title="Backlog atual" value={String(metrics.active)} hint="chamados não encerrados" icon={Gauge} />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Tendência de volume e resolução</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="abertos" name="Abertos" strokeWidth={2} /><Line type="monotone" dataKey="resolvidos" name="Resolvidos" strokeWidth={2} /></LineChart></ResponsiveContainer></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Backlog acumulado</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="backlog" name="Backlog" strokeWidth={2} /></LineChart></ResponsiveContainer></div></CardContent></Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card><CardHeader><CardTitle>Custos</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Custo registrado</span><strong>{formatMoney(metrics.costTotal)}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Custo por chamado resolvido</span><strong>{formatMoney(metrics.costPer)}</strong></div><p className="text-xs text-muted-foreground">Calculado somente sobre chamados com custo informado.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Capacidade e utilização</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Utilização</span><strong>{metrics.utilization == null ? "—" : `${metrics.utilization.toFixed(1)}%`}</strong></div><Badge variant="outline">{capacidade.length ? `${capacidade.length} parâmetros ativos` : "Capacidade não parametrizada"}</Badge><p className="text-xs text-muted-foreground">Usa o tempo de atendimento informado e a capacidade semanal cadastrada.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Qualidade</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">CSAT</span><strong>{metrics.avgCsat == null ? "—" : `${metrics.avgCsat.toFixed(1)} / 5`}</strong></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">FCR</span><strong>{metrics.fcr == null ? "—" : `${metrics.fcr}%`}</strong></div><p className="text-xs text-muted-foreground">FCR exige que o atendimento marque explicitamente a resolução na primeira chamada.</p></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Produtividade por atendente</CardTitle></CardHeader><CardContent><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={agentRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="agente" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="resolvidos" name="Resolvidos" /><Bar dataKey="total" name="Total" /></BarChart></ResponsiveContainer></div>{!agentRows.length && <p className="text-sm text-muted-foreground">Nenhum chamado atribuído a atendente no período.</p>}</CardContent></Card>

    <Card><CardHeader><CardTitle>Indicadores complementares</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">Chamados encerrados</p><p className="text-xl font-semibold">{metrics.resolved}</p></div><div><p className="text-xs text-muted-foreground">Chamados ativos</p><p className="text-xl font-semibold">{metrics.active}</p></div><div><p className="text-xs text-muted-foreground">CSAT respondido</p><p className="text-xl font-semibold">{avaliacoes.length}</p></div><div><p className="text-xs text-muted-foreground">Capacidade cadastrada</p><p className="text-xl font-semibold">{capacidade.reduce((a, c) => a + Number(c.horas_disponiveis_semana), 0).toFixed(1)} h/sem</p></div></CardContent></Card>
  </div>;
}
