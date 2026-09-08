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
  { v: "aguardando_usuario", l: "Aguardando usuário" }, { v: "resolvido", l: "Resolvidos" },
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
  if (s === "aberto") return "bg-sky-100 text-sky-700";
  if (s === "em_andamento") return "bg-amber-100 text-amber-700";
  if (s.startsWith("aguardando")) return "bg-orange-100 text-orange-700";
  if (s === "resolvido") return "bg-emerald-100 text-emerald-700";
  if (s === "fechado") return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
}
function prioStyle(p: string) {
  return p === "critica" ? "bg-red-100 text-red-700" : p === "alta" ? "bg-amber-100 text-amber-700" : p === "media" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700";
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
  for (const h of horarios) {
    const arr = byDay.get(h.dia_semana) ?? [];
    arr.push(h); byDay.set(h.dia_semana, arr);
  }
  let cursor = startMs;
  let total = 0;
  for (let i = 0; i < 3701 && cursor < endMs; i++) {
    const z = zonedParts(new Date(cursor), timeZone);
    const dayStartMs = localDateToUtc({ year: z.year, month: z.month, day: z.day, hour: 0, minute: 0 }, timeZone);
    for (const h of (byDay.get(z.dow) ?? []).sort((a, b) => timeParts(a.hora_inicio) - timeParts(b.hora_inicio))) {
      const inicio = localDateToUtc({ year: z.year, month: z.month, day: z.day, hour: Math.floor(timeParts(h.hora_inicio) / 3600), minute: Math.floor((timeParts(h.hora_inicio) % 3600) / 60), second: timeParts(h.hora_inicio) % 60 }, timeZone);
      const fim = localDateToUtc({ year: z.year, month: z.month, day: z.day, hour: Math.floor(timeParts(h.hora_fim) / 3600), minute: Math.floor((timeParts(h.hora_fim) % 3600) / 60), second: timeParts(h.hora_fim) % 60 }, timeZone);
      const a = Math.max(cursor, inicio);
      const b = Math.min(endMs, fim);
      if (b > a) total += Math.floor((b - a) / 1000);
    }
    cursor = dayStartMs + 36e5 * 24;
    if (cursor <= startMs) cursor = startMs + 86400000;
  }
  return total;
}
function slaInfo(c: any, now: number, regras: Map<string, Regra>, horarios: Horario[]) {
  const regra = c.sla_regra_id ? regras.get(c.sla_regra_id) : undefined;
  if (!regra || !regra.usa_sla_resolucao) return { status: "sem_sla", seconds: null };
  if (c.sla_pausado) return { status: "pausado", seconds: Math.max(0, Number(c.sla_tempo_restante_segundos ?? 0)) };
  if (!c.prazo_resolucao) return { status: "sem_sla", seconds: null };
  const calendarioHorarios = regra.calendario_id ? horarios.filter(h => h.calendario_id === regra.calendario_id) : [];
  const seconds = businessSecondsBetween(now, new Date(c.prazo_resolucao).getTime(), calendarioHorarios);
  if (seconds <= 0) return { status: "vencido", seconds: 0 };
  if (seconds <= 3600) return { status: "vencendo", seconds };
  return { status: "ok", seconds };
}
function duration(seconds: number | null) {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}min` : `${m}min`;
}
function slaClass(status: string) {
  if (status === "vencido") return "text-red-600 font-medium";
  if (status === "vencendo") return "text-amber-600 font-medium";
  if (status === "pausado") return "text-blue-600 font-medium";
  return "text-emerald-600";
}

function FilaPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("__all_status__");
  const [prioridade, setPrioridade] = useState("__all__");
  const [segmentoSelecionado, setSegmentoSelecionado] = useState("todos");
  const [somenteMeus, setSomenteMeus] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  const { data: contexto, isLoading: loadingContexto } = useQuery({
    queryKey: ["fila-contexto"],
    queryFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
      const [{ data: roles, error: rolesError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("profiles").select("departamento").eq("id", userId).maybeSingle(),
      ]);
      if (rolesError) throw rolesError; if (profileError) throw profileError;
      const roleList = ((roles ?? []).map((r: any) => r.role) as Role[]);
      const role: Role = roleList.includes("admin") ? "admin" : roleList.includes("gestor") ? "gestor" : roleList.includes("atendente") ? "atendente" : "colaborador";
      let grupoIds: string[] = [];
      if (role === "atendente") {
        const { data, error } = await supabase.from("grupo_atendentes").select("grupo_id").eq("usuario_id", userId).eq("ativo", true);
        if (error) throw error; grupoIds = (data ?? []).map((m: any) => m.grupo_id);
      }
      return { userId, role, departamento: profile?.departamento ?? null, grupoIds };
    },
  });

  const { data: segmentos = [], isLoading: loadingSegmentos } = useQuery({
    queryKey: ["fila-segmentos-operacional", contexto?.role, contexto?.grupoIds], enabled: !!contexto,
    queryFn: async () => {
      let q = supabase.from("segmentos").select("id,nome,ativo").eq("ativo", true).order("nome");
      if (contexto?.role === "atendente") {
        if (!contexto.grupoIds.length) return [] as Segmento[];
        const { data: grupos, error } = await supabase.from("grupos_atendimento").select("segmento_id").in("id", contexto.grupoIds).eq("ativo", true);
        if (error) throw error; const ids = [...new Set((grupos ?? []).map((g: any) => g.segmento_id).filter(Boolean))]; if (!ids.length) return [] as Segmento[]; q = q.in("id", ids);
      }
      const { data, error } = await q; if (error) throw error; return (data ?? []) as Segmento[];
    },
  });
  const segmentoIdsPermitidos = useMemo(() => new Set(segmentos.map(s => s.id)), [segmentos]);
  useEffect(() => { if (segmentoSelecionado !== "todos" && !segmentoIdsPermitidos.has(segmentoSelecionado)) setSegmentoSelecionado("todos"); }, [segmentoSelecionado, segmentoIdsPermitidos]);

  const { data: chamados = [], isLoading: loadingChamados } = useQuery({
    queryKey: ["fila", status, prioridade, segmentoSelecionado, somenteMeus, contexto?.userId, contexto?.role, contexto?.departamento, [...segmentoIdsPermitidos]],
    enabled: !!contexto && !loadingSegmentos,
    queryFn: async () => {
      let q = supabase.from("chamados").select(`id,numero,titulo,status,prioridade,aberto_em,prazo_resolucao,sla_regra_id,sla_pausado,sla_tempo_restante_segundos,sla_resolucao_violado,segmento_id,atendente_id,tipo:tipos_chamado(id,nome),categoria:categorias(nome),solicitante:profiles!chamados_solicitante_profile_fkey(nome,departamento,area_id),atendente:profiles!chamados_atendente_profile_fkey(nome)`).order("aberto_em", { ascending: false }).limit(200);
      if (status !== "__all_status__") q = q.eq("status", status as any);
      if (prioridade !== "__all__") q = q.eq("prioridade", prioridade as any);

      if (somenteMeus && contexto?.userId) {
        q = q.eq("atendente_id", contexto.userId);
      } else if (contexto?.role === "atendente") {
        // Não usamos OR do PostgREST aqui: essa combinação estava fazendo a página
        // inteira da fila falhar em alguns ambientes. A RLS de chamados já permite
        // leitura para atendentes; filtramos a fila operacional no cliente e sempre
        // preservamos o chamado atribuído diretamente ao usuário.
      } else if (segmentoSelecionado !== "todos") {
        q = q.eq("segmento_id", segmentoSelecionado);
      }

      if (contexto?.role === "gestor" && contexto.departamento) q = q.eq("solicitante.departamento", contexto.departamento);
      const { data, error } = await q;
      if (error) throw error;

      let rows = data ?? [];
      if (contexto?.role === "atendente" && !somenteMeus) {
        rows = rows.filter((c: any) => c.atendente_id === contexto.userId || segmentoIdsPermitidos.has(c.segmento_id));
        if (segmentoSelecionado !== "todos") {
          rows = rows.filter((c: any) => c.atendente_id === contexto.userId || c.segmento_id === segmentoSelecionado);
        }
      }
      return rows;
    },
  });

  const regraIds = useMemo(() => [...new Set(chamados.map((c: any) => c.sla_regra_id).filter(Boolean))], [chamados]);
  const { data: regras = [] } = useQuery({
    queryKey: ["fila-sla-regras", regraIds], enabled: regraIds.length > 0,
    queryFn: async () => { const { data, error } = await supabase.from("sla_regras").select("id,calendario_id,usa_sla_resolucao").in("id", regraIds); if (error) throw error; return (data ?? []) as Regra[]; },
  });
  const calendarioIds = useMemo(() => [...new Set(regras.map(r => r.calendario_id).filter(Boolean))] as string[], [regras]);
  const { data: horarios = [] } = useQuery({
    queryKey: ["fila-sla-horarios", calendarioIds], enabled: calendarioIds.length > 0,
    queryFn: async () => { const { data, error } = await supabase.from("sla_calendario_horarios").select("calendario_id,dia_semana,hora_inicio,hora_fim").in("calendario_id", calendarioIds).eq("ativo", true); if (error) throw error; return (data ?? []) as Horario[]; },
  });
  const regraMap = useMemo(() => new Map(regras.map(r => [r.id, r])), [regras]);
  const selectedName = segmentoSelecionado === "todos" ? "Todos" : segmentos.find(s => s.id === segmentoSelecionado)?.nome ?? "Todos";

  if (loadingContexto || loadingSegmentos || loadingChamados) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando fila…</div>;

  return (<div className="space-y-4 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Fila de atendimento</h1><p className="text-sm text-muted-foreground">{selectedName} · {chamados.length} chamado(s)</p></div>
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select>
        <Select value={prioridade} onValueChange={setPrioridade}><SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger><SelectContent>{PRIOS.map(p => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent></Select>
        {contexto?.role !== "colaborador" && <Select value={segmentoSelecionado} onValueChange={setSegmentoSelecionado}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os segmentos</SelectItem>{segmentos.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>}
        {contexto?.role === "atendente" && <Button variant={somenteMeus ? "default" : "outline"} onClick={() => setSomenteMeus(v => !v)}>Somente meus</Button>}
      </div>
    </div>
    <div className="grid gap-3">
      {chamados.length === 0 ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum chamado encontrado.</CardContent></Card> : chamados.map((c: any) => {
        const sla = slaInfo(c, now, regraMap, horarios);
        return <Card key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate({ to: "/chamados/$id", params: { id: c.id } })}><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1"><div className="font-mono text-xs text-muted-foreground">{c.numero}</div><div className="font-medium truncate">{c.titulo}</div><div className="mt-1 text-xs text-muted-foreground">Solicitante: {c.solicitante?.nome ?? "—"} · Responsável: {c.atendente?.nome ?? "Não atribuído"}</div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs ${prioStyle(c.prioridade)}`}>{c.prioridade}</span><span className={`rounded-full px-2 py-1 text-xs ${statusStyle(c.status)}`}>{c.status}</span><span className={`text-xs ${slaClass(sla.status)}`}>{sla.status === "sem_sla" ? "Sem SLA" : sla.status === "pausado" ? `Pausado · ${duration(sla.seconds)}` : duration(sla.seconds)}</span></div></CardContent></Card>;
      })}
    </div>
  </div>);
}
