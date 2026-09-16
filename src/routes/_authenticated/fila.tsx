import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/fila")({
  head: () => ({ meta: [
    { title: "Fila de atendimento | Mundo Vem Service Desk" },
    { name: "description", content: "Fila dos técnicos com chamados pendentes, prioridade e sinalização de risco de estouro de SLA." },
  ] }),
  component: FilaPage,
});

const STATUS = [
  { v: "__all_status__", l: "Todos" }, { v: "aberto", l: "Abertos" }, { v: "em_andamento", l: "Em andamento" },
  { v: "aguardando_usuario", l: "Aguardando usuário" }, { v: "aguardando_terceiro", l: "Aguardando terceiro" }, { v: "resolvido", l: "Resolvidos" },
];
const PRIOS = [
  { v: "__all__", l: "Todas as prioridades" }, { v: "critica", l: "Crítica" }, { v: "alta", l: "Alta" },
  { v: "media", l: "Média" }, { v: "baixa", l: "Baixa" },
];
type Role = "colaborador" | "atendente" | "gestor" | "admin";
type Segmento = { id: string; nome: string; ativo: boolean };
type Horario = { calendario_id: string; dia_semana: number; hora_inicio: string; hora_fim: string };
type Regra = { id: string; calendario_id: string | null; usa_sla_resolucao: boolean };

function statusStyle(s: string) {
  if (s === "aberto") return "bg-sky-100 text-sky-700 border border-sky-200";
  if (s === "em_andamento") return "bg-violet-100 text-violet-700 border border-violet-200";
  if (s === "aguardando_usuario") return "bg-orange-100 text-orange-700 border border-orange-200";
  if (s === "aguardando_terceiro") return "bg-amber-100 text-amber-800 border border-amber-200";
  if (s === "resolvido") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (s === "fechado") return "bg-slate-100 text-slate-700 border border-slate-200";
  if (s === "cancelado") return "bg-red-100 text-red-700 border border-red-200";
  return "bg-muted text-muted-foreground border border-border";
}
function statusLabel(s: string) {
  if (s === "aberto") return "Aberto";
  if (s === "em_andamento") return "Em andamento";
  if (s === "aguardando_usuario") return "Aguardando usuário";
  if (s === "aguardando_terceiro") return "Aguardando terceiro";
  if (s === "resolvido") return "Resolvido";
  if (s === "fechado") return "Fechado";
  if (s === "cancelado") return "Cancelado";
  return s;
}
function prioStyle(p: string) {
  return p === "critica" ? "bg-red-100 text-red-700 border border-red-200" : p === "alta" ? "bg-orange-100 text-orange-700 border border-orange-200" : p === "media" ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200";
}
function prioLabel(p: string) {
  if (p === "critica") return "Crítica";
  if (p === "alta") return "Alta";
  if (p === "media") return "Média";
  if (p === "baixa") return "Baixa";
  return p;
}
function timeParts(value: string) {
  const [h, m, s] = value.split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}
function zonedParts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(date);
  const get = (t: string) => p.find(x => x.type === t)?.value ?? "0";
  const wd = get("weekday");
  const dow = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[wd] ?? 0;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: Number(get("hour")), minute: Number(get("minute")), second: Number(get("second")), dow };
}
function localDateToUtc(parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number }, timeZone: string) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const z = zonedParts(new Date(guess), timeZone);
    const actual = Date.UTC(z.year, z.month - 1, z.day, z.hour, z.minute, z.second);
    guess += target - actual;
  }
  return guess;
}
function businessSecondsBetween(startMs: number, endMs: number, horarios: Horario[], timeZone = "America/Sao_Paulo") {
  if (endMs <= startMs) return 0;
  if (!horarios.length) return Math.floor((endMs - startMs) / 1000);
  const byDay = new Map<number, Horario[]>();
  for (const h of horarios) { const arr = byDay.get(h.dia_semana) ?? []; arr.push(h); byDay.set(h.dia_semana, arr); }
  let cursor = startMs; let total = 0;
  for (let i = 0; i < 3701 && cursor < endMs; i++) {
    const z = zonedParts(new Date(cursor), timeZone);
    const dayStartMs = localDateToUtc({ year: z.year, month: z.month, day: z.day, hour: 0, minute: 0 }, timeZone);
    for (const h of (byDay.get(z.dow) ?? []).sort((a, b) => timeParts(a.hora_inicio) - timeParts(b.hora_inicio))) {
      const inicio = localDateToUtc({ year: z.year, month: z.month, day: z.day, hour: Math.floor(timeParts(h.hora_inicio) / 3600), minute: Math.floor((timeParts(h.hora_inicio) % 3600) / 60), second: timeParts(h.hora_inicio) % 60 }, timeZone);
      const fim = localDateToUtc({ year: z.year, month: z.month, day: z.day, hour: Math.floor(timeParts(h.hora_fim) / 3600), minute: Math.floor((timeParts(h.hora_fim) % 3600) / 60), second: timeParts(h.hora_fim) % 60 }, timeZone);
      const a = Math.max(cursor, inicio); const b = Math.min(endMs, fim); if (b > a) total += Math.floor((b - a) / 1000);
    }
    cursor = dayStartMs + 36e5 * 24; if (cursor <= startMs) cursor = startMs + 86400000;
  }
  return total;
}
function slaInfo(c: any, now: number, regras: Map<string, Regra>, horarios: Horario[]) {
  const regra = c.sla_regra_id ? regras.get(c.sla_regra_id) : undefined;
  if (!regra || !regra.usa_sla_resolucao) return { status: "sem_sla", seconds: null };
  const aguardando = c.status === "aguardando_usuario" || c.status === "aguardando_terceiro";
  if (c.sla_pausado || aguardando) return { status: "pausado", seconds: Math.max(0, Number(c.sla_tempo_restante_segundos ?? 0)) };
  if (!c.prazo_resolucao) return { status: "sem_sla", seconds: null };
  const calendarioHorarios = regra.calendario_id ? horarios.filter(h => h.calendario_id === regra.calendario_id) : [];
  const seconds = businessSecondsBetween(now, new Date(c.prazo_resolucao).getTime(), calendarioHorarios);
  if (seconds <= 0) return { status: "vencido", seconds: 0 }; if (seconds <= 3600) return { status: "vencendo", seconds }; return { status: "ok", seconds };
}
function duration(seconds: number | null) {
  if (seconds == null) return "—"; const s = Math.max(0, Math.floor(seconds)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}min` : `${m}min`;
}
function slaClass(status: string) { if (status === "vencido") return "text-red-600 font-medium"; if (status === "vencendo") return "text-amber-600 font-medium"; if (status === "pausado") return "text-blue-600 font-medium"; return "text-emerald-600"; }

function FilaPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("__all_status__"); const [prioridade, setPrioridade] = useState("__all__"); const [segmentoSelecionado, setSegmentoSelecionado] = useState("todos"); const [somenteMeus, setSomenteMeus] = useState(false); const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  const { data: contexto, isLoading: loadingContexto } = useQuery({
    queryKey: ["fila-contexto"],
    queryFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
      const [{ data: roles, error: rolesError }, { data: profile, error: profileError }] = await Promise.all([supabase.from("user_roles").select("role").eq("user_id", userId), supabase.from("profiles").select("departamento,area_id").eq("id", userId).maybeSingle()]);
      if (rolesError) throw rolesError; if (profileError) throw profileError;
      const roleList = ((roles ?? []).map((r: any) => r.role) as Role[]);
      const role: Role = roleList.includes("admin") ? "admin" : roleList.includes("gestor") ? "gestor" : roleList.includes("atendente") ? "atendente" : "colaborador";
      let isGestorTI = false;
      if (role === "gestor" && profile?.area_id) { const { data: area, error: areaError } = await supabase.from("areas").select("nome").eq("id", profile.area_id).maybeSingle(); if (areaError) throw areaError; isGestorTI = (area?.nome ?? "").toLowerCase().replace(/[^a-z0-9]/g, "") === "ti"; }
      return { userId, role, departamento: profile?.departamento ?? null, areaId: profile?.area_id ?? null, isGestorTI };
    },
  });
  const { data: segmentos = [], isLoading: loadingSegmentos } = useQuery({ queryKey: ["fila-segmentos-operacional"], enabled: !!contexto, queryFn: async () => { const { data, error } = await supabase.from("segmentos").select("id,nome,ativo").eq("ativo", true).order("nome"); if (error) throw error; return (data ?? []) as Segmento[]; } });
  const segmentoIdsPermitidos = useMemo(() => new Set(segmentos.map(s => s.id)), [segmentos]);
  useEffect(() => { if (segmentoSelecionado !== "todos" && !segmentoIdsPermitidos.has(segmentoSelecionado)) setSegmentoSelecionado("todos"); }, [segmentoSelecionado, segmentoIdsPermitidos]);
  const { data: chamados = [], isLoading: loadingChamados } = useQuery({
    queryKey: ["fila", status, prioridade, segmentoSelecionado, somenteMeus, contexto?.userId, contexto?.role, contexto?.departamento, contexto?.areaId, contexto?.isGestorTI], enabled: !!contexto && !loadingSegmentos,
    queryFn: async () => {
      let q = supabase.from("chamados").select(`id,numero,titulo,status,prioridade,aberto_em,prazo_resolucao,sla_regra_id,sla_pausado,sla_tempo_restante_segundos,sla_resolucao_violado,segmento_id,atendente_id,tipo:tipos_chamado(id,nome),categoria:categorias(nome),solicitante:profiles!chamados_solicitante_profile_fkey(nome,departamento,area_id),atendente:profiles!chamados_atendente_profile_fkey(nome)`).order("aberto_em", { ascending: false }).limit(200);
      if (status !== "__all_status__") q = q.eq("status", status as any); if (prioridade !== "__all__") q = q.eq("prioridade", prioridade as any);
      if (somenteMeus && contexto?.userId) q = q.eq("atendente_id", contexto.userId); else if (segmentoSelecionado !== "todos") q = q.eq("segmento_id", segmentoSelecionado);
      if (contexto?.role === "colaborador" && contexto.userId) q = q.eq("solicitante_id", contexto.userId);
      if (contexto?.role === "atendente" && contexto.userId) q = q.or(`atendente_id.eq.${contexto.userId},atendente_id.is.null`);
      if (contexto?.role === "gestor" && !contexto.isGestorTI && contexto.departamento) q = q.eq("solicitante.departamento", contexto.departamento);
      const { data, error } = await q; if (error) throw error; return data ?? [];
    },
  });
  const regraIds = useMemo(() => [...new Set(chamados.map((c: any) => c.sla_regra_id).filter(Boolean))], [chamados]);
  const { data: regras = [] } = useQuery({ queryKey: ["fila-sla-regras", regraIds], enabled: regraIds.length > 0, queryFn: async () => { const { data, error } = await supabase.from("sla_regras").select("id,calendario_id,usa_sla_resolucao").in("id", regraIds); if (error) throw error; return (data ?? []) as Regra[]; } });
  const calendarioIds = useMemo(() => [...new Set(regras.map(r => r.calendario_id).filter(Boolean))] as string[], [regras]);
  const { data: horarios = [] } = useQuery({ queryKey: ["fila-sla-horarios", calendarioIds], enabled: calendarioIds.length > 0, queryFn: async () => { const { data, error } = await supabase.from("sla_calendario_horarios").select("calendario_id,dia_semana,hora_inicio,hora_fim").in("calendario_id", calendarioIds).eq("ativo", true); if (error) throw error; return (data ?? []) as Horario[]; } });
  const regraMap = useMemo(() => new Map(regras.map(r => [r.id, r])), [regras]); const selectedName = segmentoSelecionado === "todos" ? "Todos" : segmentos.find(s => s.id === segmentoSelecionado)?.nome ?? "Todos";
  if (loadingContexto || loadingSegmentos || loadingChamados) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando fila…</div>;
  return (<div className="space-y-4 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Fila de atendimento</h1><p className="text-sm text-muted-foreground">{selectedName} · {chamados.length} chamado(s)</p></div><div className="flex flex-wrap gap-2"><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select><Select value={prioridade} onValueChange={setPrioridade}><SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger><SelectContent>{PRIOS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent></Select>{contexto?.role !== "colaborador" && <Select value={segmentoSelecionado} onValueChange={setSegmentoSelecionado}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os segmentos</SelectItem>{segmentos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>}{contexto?.role === "atendente" && <Button variant={somenteMeus ? "default" : "outline"} onClick={() => setSomenteMeus(v => !v)}>Somente meus</Button>}</div></div><div className="grid gap-3">{chamados.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum chamado encontrado.</CardContent></Card> : chamados.map((c: any) => { const sla = slaInfo(c, now, regraMap, horarios); const encerrado = c.status === "resolvido" || c.status === "fechado"; const slaEstourado = sla.status === "vencido" && !encerrado; return <Card key={c.id} className={`cursor-pointer hover:bg-muted/30 ${slaEstourado ? "border-red-300 bg-red-50/40" : ""}`} onClick={() => navigate({ to: "/chamados/$id", params: { id: c.id } })}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1"><div className="font-mono text-xs text-muted-foreground">{c.numero}</div><div className="font-medium truncate">{c.titulo}</div><div className="mt-1 text-xs text-muted-foreground">Solicitante: {c.solicitante?.nome ?? "—"} · Responsável: {c.atendente?.nome ?? "Não atribuído"}</div></div><div className="flex items-center gap-2">{slaEstourado && <span className="rounded-full border border-red-300 bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">⚠ SLA estourado</span>}<span className={`rounded-full px-2 py-1 text-xs font-medium ${prioStyle(c.prioridade)}`}>{prioLabel(c.prioridade)}</span><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusStyle(c.status)}`}>{statusLabel(c.status)}</span><span className={`text-xs ${slaClass(slaEstourado ? sla.status : (encerrado ? "ok" : sla.status))}`}>{sla.status === "sem_sla" ? "Sem SLA" : sla.status === "pausado" ? `Pausado · ${duration(sla.seconds)}` : duration(sla.seconds)}</span></div></CardContent></Card>; })}</div></div>);
}
