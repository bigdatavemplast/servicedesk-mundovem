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

type Chamado = { id: string; status: string; prioridade: string; criado_em: string; resolvido_em: string | null; sla_resolucao_violado: boolean; prazo_resolucao: string | null; primeira_chamada_resolvida: boolean | null; escalonado: boolean; atendimento_abandonado: boolean; tempo_atendimento_minutos: number | null; custo_atendimento: number | null; categoria_id: string | null; atendente_id: string | null; segmento_id: string | null };
type Avaliacao = { chamado_id: string; nota: number; criado_em: string };
type Capacidade = { usuario_id: string | null; grupo_atendimento_id: string | null; horas_disponiveis_semana: number; custo_hora: number; ativo: boolean };
type EquipeSatisfacao = { nota: number; criado_em: string };
type Segmento = { id: string; nome: string };

const CLOSED = ["resolvido", "fechado"];
const sinceDate = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };
const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : null;
const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3600000);
const formatHours = (v: number | null) => v == null ? "—" : v < 1 ? `${Math.round(v * 60)} min` : `${v.toFixed(1)} h`;
const money = (v: number | null) => v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const getStoredArea = () => { try { const value = JSON.parse(localStorage.getItem("service_desk_segmento") ?? "null"); return value?.id ? { id: String(value.id), nome: String(value.nome ?? "") } : null; } catch { return null; } };

function Kpi({ title, value, hint, icon: Icon }: { title: string; value: string; hint: string; icon: any }) {
  return <Card><CardContent className="flex items-start justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div></CardContent></Card>;
}

function GestaoPage() {
  const storedArea = getStoredArea();
  const [dias, setDias] = useState("30");
  const [segmentoId, setSegmentoId] = useState(storedArea?.id ?? "");
  const days = Number(dias);
  const { data: segmentos = [] } = useQuery({ queryKey: ["gestao-segmentos"], queryFn: async () => { const { data, error } = await supabase.from("segmentos").select("id,nome").eq("ativo", true).order("ordem").order("nome"); if (error) throw error; return (data ?? []) as Segmento[]; } });
  const segmentoValido = segmentos.some((s) => s.id === segmentoId) ? segmentoId : (segmentos[0]?.id ?? "");
  const { data: chamados = [], isLoading, error } = useQuery({ queryKey: ["gestao-chamados", days, segmentoValido], enabled: !!segmentoValido, queryFn: async () => {
    const { data, error } = await (supabase as any).from("chamados").select("id,status,prioridade,criado_em,resolvido_em,sla_resolucao_violado,prazo_resolucao,primeira_chamada_resolvida,escalonado,atendimento_abandonado,tempo_atendimento_minutos,custo_atendimento,categoria_id,atendente_id,segmento_id").eq("segmento_id", segmentoValido).gte("criado_em", sinceDate(days)).order("criado_em", { ascending: true });
    if (error) throw error; return (data ?? []) as Chamado[];
  }});
  const chamadoIds = useMemo(() => chamados.map((c) => c.id), [chamados]);
  const { data: avaliacoes = [] } = useQuery({ queryKey: ["gestao-csat", days, segmentoValido, chamadoIds.join(",")], enabled: !!segmentoValido, queryFn: async () => { if (!chamadoIds.length) return []; const { data, error } = await (supabase as any).from("avaliacoes_atendimento").select("chamado_id,nota,criado_em").in("chamado_id", chamadoIds).gte("criado_em", sinceDate(days)); return error ? [] : (data ?? []) as Avaliacao[]; } });
  const agentIds = useMemo(() => Array.from(new Set(chamados.map((c) => c.atendente_id).filter(Boolean))) as string[], [chamados]);
  const { data: profiles = [] } = useQuery({ queryKey: ["gestao-agent-profiles", agentIds.join(",")], enabled: agentIds.length > 0, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("id,nome,email").in("id", agentIds); if (error) return []; return data ?? []; } });
  const profileMap = useMemo(() => Object.fromEntries((profiles as any[]).map((p) => [p.id, p.nome || p.email || p.id])), [profiles]);
  const { data: capacidade = [] } = useQuery({ queryKey: ["gestao-capacidade", segmentoValido, agentIds.join(",")], enabled: agentIds.length > 0, queryFn: async () => { const { data, error } = await (supabase as any).from("gestao_capacidade").select("usuario_id,grupo_atendimento_id,horas_disponiveis_semana,custo_hora,ativo").eq("ativo", true).in("usuario_id", agentIds); return error ? [] : (data ?? []) as Capacidade[]; } });
  const { data: satisfacaoEquipe = [] } = useQuery({ queryKey: ["gestao-satisfacao-equipe", days, segmentoValido], enabled: false, queryFn: async () => [] as EquipeSatisfacao[] });
  const { data: categorias = [] } = useQuery({ queryKey: ["gestao-categorias", segmentoValido], enabled: !!segmentoValido, queryFn: async () => { const { data, error } = await supabase.from("categorias").select("id,nome").eq("ativo", true).order("ordem").order("nome"); return error ? [] : data ?? []; } });
  const catMap = useMemo(() => Object.fromEntries(categorias.map((c: any) => [c.id, c.nome])), [categorias]);
  const areaNome = segmentos.find((s) => s.id === segmentoValido)?.nome ?? storedArea?.nome ?? "Área";

  const metrics = useMemo(() => {
    const resolved = chamados.filter((c) => c.resolvido_em && CLOSED.includes(c.status));
    const answered = chamados.filter((c) => c.primeira_chamada_resolvida !== null);
    const fcr = pct(answered.filter((c) => c.primeira_chamada_resolvida === true).length, answered.length);
    const times = resolved.map((c) => hoursBetween(c.criado_em, c.resolvido_em!));
    const tma = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const slaEligible = resolved.filter((c) => c.prazo_resolucao || c.sla_resolucao_violado);
    const sla = pct(slaEligible.filter((c) => !c.sla_resolucao_violado && !!c.resolvido_em && (!c.prazo_resolucao || new Date(c.resolvido_em) <= new Date(c.prazo_resolucao))).length, slaEligible.length);
    const avgCsat = avaliacoes.length ? avaliacoes.reduce((a, b) => a + Number(b.nota), 0) / avaliacoes.length : null;
    const avgTeam = satisfacaoEquipe.length ? satisfacaoEquipe.reduce((a, b) => a + Number(b.nota), 0) / satisfacaoEquipe.length : null;
    const costs = chamados.map((c) => c.custo_atendimento).filter((v): v is number => v != null);
    const costTotal = costs.length ? costs.reduce((a, b) => a + b, 0) : null;
    const costPer = costTotal != null && resolved.length ? costTotal / resolved.length : null;
    const productiveMinutes = chamados.reduce((sum, c) => sum + Number(c.tempo_atendimento_minutos ?? 0), 0);
    const capacityHours = capacidade.reduce((sum, c) => sum + Number(c.horas_disponiveis_semana), 0) * days / 7;
    const utilization = capacityHours > 0 ? (productiveMinutes / 60 / capacityHours) * 100 : null;
    return { total: chamados.length, resolved: resolved.length, backlog: chamados.filter((c) => !CLOSED.includes(c.status) && c.status !== "cancelado").length, fcr, tma, sla, avgCsat, avgTeam, escal: pct(chamados.filter((c) => c.escalonado).length, chamados.length), abandon: pct(chamados.filter((c) => c.atendimento_abandonado).length, chamados.length), costTotal, costPer, utilization };
  }, [avaliacoes, capacidade, chamados, days, satisfacaoEquipe]);
  const trend = useMemo(() => { const map = new Map<string, { periodo: string; abertos: number; resolvidos: number; backlog: number }>(); for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const key = d.toISOString().slice(0, 10); map.set(key, { periodo: key.slice(5), abertos: 0, resolvidos: 0, backlog: 0 }); } chamados.forEach((c) => { const a = map.get(c.criado_em.slice(0, 10)); if (a) a.abertos++; if (c.resolvido_em) { const r = map.get(c.resolvido_em.slice(0, 10)); if (r) r.resolvidos++; } }); let backlog = 0; return Array.from(map.values()).map((p) => { backlog = Math.max(0, backlog + p.abertos - p.resolvidos); return { ...p, backlog }; }); }, [chamados, days]);
  const priority = useMemo(() => ["baixa", "media", "alta", "critica"].map((p) => ({ prioridade: p, total: chamados.filter((c) => c.prioridade === p).length })), [chamados]);
  const agents = useMemo(() => { const map = new Map<string, { agente: string; total: number; resolvidos: number }>(); chamados.filter((c) => c.atendente_id).forEach((c) => { const key = c.atendente_id!; const row = map.get(key) ?? { agente: profileMap[key] ?? "Atendente", total: 0, resolvidos: 0 }; row.total++; if (CLOSED.includes(c.status)) row.resolvidos++; map.set(key, row); }); return Array.from(map.values()).sort((a, b) => b.resolvidos - a.resolvidos).slice(0, 10); }, [chamados, profileMap]);
  const categories = useMemo(() => { const map = new Map<string, number>(); chamados.forEach((c) => { const n = c.categoria_id ? catMap[c.categoria_id] ?? "Sem categoria" : "Sem categoria"; map.set(n, (map.get(n) ?? 0) + 1); }); return Array.from(map, ([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total).slice(0, 8); }, [chamados, catMap]);

  if (!segmentoValido) return <div className="p-8"><Card><CardHeader><CardTitle>Selecione uma área</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Nenhum segmento ativo está disponível para exibir os indicadores de Gestão.</p></CardContent></Card></div>;
  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando indicadores de gestão…</div>;
  if (error) return <div className="p-8"><Card><CardHeader><CardTitle>Erro ao carregar Gestão</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Não foi possível consultar os chamados. Verifique as permissões do Supabase.</p></CardContent></Card></div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Gestão do Service Desk</h1><p className="text-sm text-muted-foreground">Indicadores exclusivamente da área <strong>{areaNome}</strong>.</p></div><div className="flex flex-wrap gap-2"><Select value={segmentoValido} onValueChange={(v) => { setSegmentoId(v); const s = segmentos.find((item) => item.id === v); if (s) localStorage.setItem("service_desk_segmento", JSON.stringify(s)); }}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Área" /></SelectTrigger><SelectContent>{segmentos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select><Select value={dias} onValueChange={setDias}><SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Últimos 7 dias</SelectItem><SelectItem value="15">Últimos 15 dias</SelectItem><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem></SelectContent></Select></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Kpi title="Volume" value={String(metrics.total)} hint={`${metrics.resolved} resolvidos · ${areaNome}`} icon={Headphones} /><Kpi title="FCR" value={metrics.fcr == null ? "—" : `${metrics.fcr}%`} hint="resolução na primeira chamada" icon={Zap} /><Kpi title="TMA" value={formatHours(metrics.tma)} hint="tempo médio até resolução" icon={Clock3} /><Kpi title="SLA" value={metrics.sla == null ? "—" : `${metrics.sla}%`} hint="conformidade em encerrados" icon={ShieldCheck} /><Kpi title="CSAT" value={metrics.avgCsat == null ? "—" : `${metrics.avgCsat.toFixed(1)}/5`} hint={`${avaliacoes.length} avaliações da área`} icon={Star} /><Kpi title="Escalonamento" value={metrics.escal == null ? "—" : `${metrics.escal}%`} hint="chamados escalonados" icon={TrendingUp} /><Kpi title="Abandono" value={metrics.abandon == null ? "—" : `${metrics.abandon}%`} hint="atendimentos abandonados" icon={Activity} /><Kpi title="Backlog" value={String(metrics.backlog)} hint="não encerrados" icon={Gauge} /></div>
    <div className="grid gap-4 lg:grid-cols-4"><Card><CardHeader><CardTitle>Custos</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Total registrado</p><p className="text-xl font-bold">{money(metrics.costTotal)}</p><p className="mt-2 text-sm text-muted-foreground">Por resolvido</p><p className="text-lg font-semibold">{money(metrics.costPer)}</p></CardContent></Card><Card><CardHeader><CardTitle>Capacidade</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Utilização</p><p className="text-xl font-bold">{metrics.utilization == null ? "—" : `${metrics.utilization.toFixed(1)}%`}</p><Badge variant="outline">{capacidade.length} parâmetros da área</Badge></CardContent></Card><Card><CardHeader><CardTitle>Satisfação da equipe</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Média</p><p className="text-xl font-bold">—</p><p className="text-xs text-muted-foreground">Sem fonte segmentada disponível</p></CardContent></Card><Card><CardHeader><CardTitle>Qualidade</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">CSAT + FCR</p><p className="text-xl font-bold">{metrics.avgCsat == null ? "—" : `${metrics.avgCsat.toFixed(1)}/5`}</p><p className="text-xs text-muted-foreground">FCR: {metrics.fcr == null ? "—" : `${metrics.fcr}%`}</p></CardContent></Card></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Abertura x resolução</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="abertos" name="Abertos" strokeWidth={2} /><Line type="monotone" dataKey="resolvidos" name="Resolvidos" strokeWidth={2} /></LineChart></ResponsiveContainer></div></CardContent></Card><Card><CardHeader><CardTitle>Backlog acumulado</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="backlog" name="Backlog" strokeWidth={2} /></LineChart></ResponsiveContainer></div></CardContent></Card></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Volume por prioridade</CardTitle></CardHeader><CardContent><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={priority}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="prioridade" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="total" name="Chamados" /></BarChart></ResponsiveContainer></div></CardContent></Card><Card><CardHeader><CardTitle>Produtividade por atendente</CardTitle></CardHeader><CardContent>{agents.length ? <div className="space-y-2">{agents.map((a) => <div key={a.agente} className="flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{a.agente}</span></div><Badge variant="outline">{a.resolvidos} resolvidos / {a.total} total</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum chamado atribuído no período.</p>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Volume por categoria</CardTitle></CardHeader><CardContent>{categories.length ? <div className="grid gap-2 sm:grid-cols-2">{categories.map((c) => <div key={c.categoria} className="flex items-center justify-between rounded-lg border p-3"><span className="text-sm">{c.categoria}</span><Badge>{c.total}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum dado de categoria no período.</p>}</CardContent></Card>
  </div>;
}
