import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Clock3, Gauge, Headphones, ShieldCheck, Star, TrendingUp, Users, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

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

type Chamado = { id: string; status: string; prioridade: string; criado_em: string; resolvido_em: string | null; sla_resolucao_violado: boolean; prazo_resolucao: string | null; categoria_id: string | null; atendente_id: string | null };
const CLOSED = ["resolvido", "fechado", "cancelado"];
const sinceDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };
const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : null;
const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000);
const formatHours = (v: number | null) => v == null ? "—" : v < 1 ? `${Math.round(v * 60)} min` : `${v.toFixed(1)} h`;

function Kpi({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: any }) {
  return <Card><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

function GestaoPage() {
  const [dias, setDias] = useState("30");
  const days = Number(dias);
  const { data: chamados = [], isLoading, error } = useQuery({
    queryKey: ["gestao-chamados", days],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamados").select("id,status,prioridade,criado_em,resolvido_em,sla_resolucao_violado,prazo_resolucao,categoria_id,atendente_id").gte("criado_em", sinceDate(days)).order("criado_em", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Chamado[];
    },
  });
  const { data: categorias = [] } = useQuery({ queryKey: ["gestao-categorias"], queryFn: async () => { const { data, error } = await supabase.from("categorias").select("id,nome").eq("ativo", true).order("ordem").order("nome"); return error ? [] : data ?? []; } });
  const catMap = useMemo(() => Object.fromEntries(categorias.map((c: any) => [c.id, c.nome])), [categorias]);
  const metrics = useMemo(() => {
    const resolved = chamados.filter((c) => c.resolvido_em && CLOSED.includes(c.status));
    const violados = chamados.filter((c) => c.sla_resolucao_violado || (c.prazo_resolucao && !CLOSED.includes(c.status) && new Date(c.prazo_resolucao).getTime() < Date.now()));
    const tempos = resolved.map((c) => hoursBetween(c.criado_em, c.resolvido_em!));
    return { volume: chamados.length, resolved: resolved.length, backlog: chamados.filter((c) => !CLOSED.includes(c.status)).length, sla: pct(chamados.length - violados.length, chamados.length), tma: tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null };
  }, [chamados]);
  const trend = useMemo(() => { const map = new Map<string, { periodo: string; abertos: number; resolvidos: number; backlog: number }>(); for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); map.set(key, { periodo: key.slice(5), abertos: 0, resolvidos: 0, backlog: 0 }); } chamados.forEach((c) => { const a = map.get(c.criado_em.slice(0, 10)); if (a) a.abertos++; if (c.resolvido_em) { const r = map.get(c.resolvido_em.slice(0, 10)); if (r) r.resolvidos++; } }); let b = 0; return Array.from(map.values()).map((p) => { b += p.abertos - p.resolvidos; return { ...p, backlog: b }; }); }, [chamados, days]);
  const priority = useMemo(() => ["baixa", "media", "alta", "critica"].map((p) => ({ prioridade: p, total: chamados.filter((c) => c.prioridade === p).length })), [chamados]);
  const agents = useMemo(() => { const map = new Map<string, { agente: string; total: number; resolvidos: number }>(); chamados.filter((c) => c.atendente_id).forEach((c) => { const key = c.atendente_id!; const row = map.get(key) ?? { agente: key.slice(0, 8), total: 0, resolvidos: 0 }; row.total++; if (CLOSED.includes(c.status)) row.resolvidos++; map.set(key, row); }); return Array.from(map.values()).sort((a, b) => b.resolvidos - a.resolvidos).slice(0, 10); }, [chamados]);
  const categories = useMemo(() => { const map = new Map<string, number>(); chamados.forEach((c) => { const n = c.categoria_id ? catMap[c.categoria_id] ?? "Sem categoria" : "Sem categoria"; map.set(n, (map.get(n) ?? 0) + 1); }); return Array.from(map, ([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total).slice(0, 8); }, [chamados, catMap]);
  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando indicadores de gestão…</div>;
  if (error) return <div className="p-8"><Card><CardHeader><CardTitle>Não foi possível carregar a Gestão</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">A consulta dos chamados falhou. Verifique as permissões e o schema do Supabase.</p></CardContent></Card></div>;
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Gestão do Service Desk</h1><p className="text-sm text-muted-foreground">Indicadores baseados nos dados efetivamente disponíveis.</p></div><Select value={dias} onValueChange={setDias}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="15">Últimos 15 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent></Select></div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Kpi title="Volume de chamados" value={String(metrics.volume)} hint={`${metrics.resolved} resolvidos`} icon={Headphones} /><Kpi title="FCR · 1ª chamada" value="—" hint="Sem campo disponível no schema" icon={Zap} /><Kpi title="TMA" value={formatHours(metrics.tma)} hint="tempo médio até resolução" icon={Clock3} /><Kpi title="Conformidade SLA" value={metrics.sla == null ? "—" : `${metrics.sla}%`} hint="SLA registrado no chamado" icon={ShieldCheck} /><Kpi title="CSAT" value="—" hint="Sem fonte de avaliações disponível" icon={Star} /><Kpi title="Escalonamento" value="—" hint="Sem campo disponível no schema" icon={TrendingUp} /><Kpi title="Abandono" value="—" hint="Sem campo disponível no schema" icon={Activity} /><Kpi title="Backlog" value={String(metrics.backlog)} hint="não encerrados" icon={Gauge} /></div>
  <Card><CardHeader><CardTitle>Indicadores adicionais</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><div className="rounded-lg border p-4"><p className="font-medium">Custo por chamado</p><p className="mt-1 text-xl font-bold">—</p><p className="text-xs text-muted-foreground">Não há custo parametrizado.</p></div><div className="rounded-lg border p-4"><p className="font-medium">Satisfação da equipe</p><p className="mt-1 text-xl font-bold">—</p><p className="text-xs text-muted-foreground">Pesquisa interna não configurada.</p></div><div className="rounded-lg border p-4"><p className="font-medium">Utilização do agente</p><p className="mt-1 text-xl font-bold">—</p><p className="text-xs text-muted-foreground">Tempo produtivo/capacidade não disponível.</p></div></CardContent></Card>
  <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Abertura x resolução</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="abertos" name="Abertos" strokeWidth={2} /><Line type="monotone" dataKey="resolvidos" name="Resolvidos" strokeWidth={2} /></LineChart></ResponsiveContainer></div></CardContent></Card><Card><CardHeader><CardTitle>Volume por prioridade</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={priority}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="prioridade" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="total" name="Chamados" /></BarChart></ResponsiveContainer></div></CardContent></Card></div>
  <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Produtividade por atendente</CardTitle></CardHeader><CardContent>{agents.length ? <div className="space-y-2">{agents.map((a) => <div key={a.agente} className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{a.agente}</span></div><Badge variant="outline">{a.resolvidos} resolvidos / {a.total} total</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum chamado atribuído no período.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Volume por categoria</CardTitle></CardHeader><CardContent>{categories.length ? <div className="space-y-2">{categories.map((c) => <div key={c.categoria} className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">{c.categoria}</span><Badge>{c.total}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum dado de categoria no período.</p>}</CardContent></Card></div></div>;
}
