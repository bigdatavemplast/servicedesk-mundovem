import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Mundo Vem Service Desk" },
      { name: "description", content: "Indicadores do Service Desk conforme o perfil de acesso." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
  },
  component: DashboardPage,
});

const COR_PRIORIDADE: Record<string, string> = {
  critica: "#D13438", alta: "#F7A800", media: "#0078D4", baixa: "#107C10",
};
const PERIODOS = [7, 15, 30, 90] as const;
const ENCERRADOS = ["resolvido", "fechado", "cancelado"];

type Chamado = {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  prioridade: string;
  criado_em: string;
  aberto_em: string;
  resolvido_em: string | null;
  sla_resolucao_violado: boolean;
  prazo_resolucao: string | null;
  sla_pausado: boolean;
  sla_tempo_restante_segundos: number | null;
  categoria_id: string | null;
  atendente_id: string | null;
  solicitante_id: string;
};

function prioridadeStyle(p: string) {
  if (p === "critica") return "bg-red-100 text-red-700 border-red-200";
  if (p === "alta") return "bg-amber-100 text-amber-700 border-amber-200";
  if (p === "media") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}
function statusLabel(s: string) {
  return ({ aberto: "Aberto", em_andamento: "Em andamento", aguardando_usuario: "Aguardando usuário", aguardando_terceiro: "Aguardando terceiro", resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado" } as Record<string, string>)[s] ?? s;
}
function statusStyle(s: string) {
  if (s === "aberto") return "bg-sky-100 text-sky-700";
  if (s === "em_andamento") return "bg-amber-100 text-amber-700";
  if (s === "resolvido") return "bg-emerald-100 text-emerald-700";
  if (s === "fechado") return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
}
function slaStatus(c: Chamado, now: number) {
  if (c.sla_pausado) return "pausado";
  if (!c.prazo_resolucao) return "sem_sla";
  const sec = (new Date(c.prazo_resolucao).getTime() - now) / 1000;
  if (sec <= 0) return "vencido";
  if (sec <= 3600) return "vencendo";
  return "ok";
}

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const [now, setNow] = useState(Date.now());
  const [dias, setDias] = useState<number>(30);
  const [segmentoId, setSegmentoId] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "abertos" | "andamento" | "resolvidos">("todos");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []).map((r) => String(r.role));
    },
  });

  const perfil = roles.includes("admin") ? "admin" : roles.includes("gestor") ? "gestor" : roles.includes("atendente") ? "atendente" : "colaborador";
  const isFull = perfil === "admin" || perfil === "gestor";
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString();
  }, [dias]);

  const { data: chamados = [], isLoading } = useQuery({
    queryKey: ["dashboard-chamados", perfil, user.id, dias],
    enabled: !loadingRoles,
    queryFn: async () => {
      let q = (supabase as any)
        .from("chamados")
        .select("id,numero,titulo,status,prioridade,criado_em,aberto_em,resolvido_em,sla_resolucao_violado,prazo_resolucao,sla_pausado,sla_tempo_restante_segundos,categoria_id,atendente_id,solicitante_id")
        .order("criado_em", { ascending: false });
      if (isFull) q = q.gte("criado_em", since);
      if (perfil === "atendente") q = q.or(`atendente_id.eq.${user.id},atendente_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Chamado[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["dashboard-categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("id,nome,segmento").eq("ativo", true).order("ordem").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const catMap = useMemo(
    () => Object.fromEntries(categorias.map((c: any) => [c.id, c.nome])),
    [categorias],
  );
  const catSegmentoMap = useMemo(
    () => Object.fromEntries(categorias.map((c: any) => [c.id, c.segmento])),
    [categorias],
  );
  const segmentos = useMemo(
    () => Array.from(new Set(categorias.map((c: any) => c.segmento).filter(Boolean))).sort(),
    [categorias],
  );
  const filtered = useMemo(
    () => segmentoId === "todos"
      ? chamados
      : chamados.filter((c) => c.categoria_id != null && catSegmentoMap[c.categoria_id] === segmentoId),
    [chamados, segmentoId, catSegmentoMap],
  );

  const resumo = useMemo(() => {
    const assignedToMe = chamados.filter((c) => c.atendente_id === user.id);
    const active = (c: Chamado) => !ENCERRADOS.includes(c.status);
    const resolved = (c: Chamado) => c.status === "resolvido" || c.status === "fechado";

    if (perfil === "colaborador") {
      return {
        total: chamados.length,
        abertosAgora: chamados.filter(active).length,
        resolvidos: chamados.filter(resolved).length,
        taxaSla: null,
        tMedio: null,
        criticosAbertos: 0,
        vencendo: 0,
        vencidos: 0,
        pausados: 0,
      };
    }

    if (perfil === "atendente") {
      const minhaFila = chamados.filter((c) => c.atendente_id === user.id || c.atendente_id === null);
      const meus = assignedToMe;
      const violados = meus.filter((c) => c.sla_resolucao_violado || slaStatus(c, now) === "vencido").length;
      const resolvidos = meus.filter(resolved).filter((c) => c.resolvido_em);
      const dur = resolvidos.map((c) => (new Date(c.resolvido_em!).getTime() - new Date(c.criado_em).getTime()) / 3600000);
      return {
        total: minhaFila.length,
        abertosAgora: meus.filter(active).length,
        resolvidos: meus.filter(resolved).length,
        taxaSla: meus.length ? Math.round(((meus.length - violados) / meus.length) * 100) : null,
        tMedio: dur.length ? +(dur.reduce((a, b) => a + b, 0) / dur.length).toFixed(1) : null,
        criticosAbertos: meus.filter((c) => c.prioridade === "critica" && active(c)).length,
        vencendo: meus.filter((c) => slaStatus(c, now) === "vencendo").length,
        vencidos: meus.filter((c) => slaStatus(c, now) === "vencido").length,
        pausados: meus.filter((c) => slaStatus(c, now) === "pausado").length,
      };
    }

    const violados = filtered.filter((c) => c.sla_resolucao_violado || slaStatus(c, now) === "vencido").length;
    const resolvidos = filtered.filter(resolved).filter((c) => c.resolvido_em);
    const dur = resolvidos.map((c) => (new Date(c.resolvido_em!).getTime() - new Date(c.criado_em).getTime()) / 3600000);
    return {
      total: filtered.length,
      abertosAgora: filtered.filter(active).length,
      resolvidos: filtered.filter(resolved).length,
      taxaSla: filtered.length ? Math.round(((filtered.length - violados) / filtered.length) * 100) : null,
      tMedio: dur.length ? +(dur.reduce((a, b) => a + b, 0) / dur.length).toFixed(1) : null,
      criticosAbertos: filtered.filter((c) => c.prioridade === "critica" && active(c)).length,
      vencendo: filtered.filter((c) => slaStatus(c, now) === "vencendo").length,
      vencidos: filtered.filter((c) => slaStatus(c, now) === "vencido").length,
      pausados: filtered.filter((c) => slaStatus(c, now) === "pausado").length,
    };
  }, [chamados, filtered, now, perfil, user.id]);

  const porCategoria = useMemo(() => {
    const base = perfil === "atendente" ? chamados.filter((c) => c.atendente_id === user.id) : filtered;
    const agg = new Map<string, number>();
    base.forEach((c) => {
      const nome = c.categoria_id ? catMap[c.categoria_id] ?? "—" : "—";
      agg.set(nome, (agg.get(nome) ?? 0) + 1);
    });
    return Array.from(agg.entries()).map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [catMap, chamados, filtered, perfil, user.id]);

  const recentes = useMemo(() => {
    let base = perfil === "colaborador" ? chamados : perfil === "atendente" ? chamados.filter((c) => c.atendente_id === user.id) : filtered;
    if (filtroStatus !== "todos") {
      base = base.filter((c) => filtroStatus === "abertos" ? c.status === "aberto" : filtroStatus === "andamento" ? c.status === "em_andamento" : c.status === "resolvido" || c.status === "fechado");
    }
    return base.slice(0, 10);
  }, [chamados, filtroStatus, filtered, perfil, user.id]);

  const volume = useMemo(() => {
    if (!isFull) return [];
    const map = new Map<string, { dia: string; abertos: number; resolvidos: number }>();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, { dia: k.slice(5), abertos: 0, resolvidos: 0 });
    }
    filtered.forEach((c) => {
      const a = map.get(c.criado_em.slice(0, 10)); if (a) a.abertos++;
      if (c.resolvido_em) { const r = map.get(c.resolvido_em.slice(0, 10)); if (r) r.resolvidos++; }
    });
    return Array.from(map.values());
  }, [dias, filtered, isFull]);

  const slaPorPrioridade = useMemo(() => ["baixa", "media", "alta", "critica"].map((p) => {
    const itens = filtered.filter((c) => c.prioridade === p);
    const violados = itens.filter((c) => c.sla_resolucao_violado || slaStatus(c, now) === "vencido").length;
    return { prioridade: p, total: itens.length, taxa_pct: itens.length ? Math.round(((itens.length - violados) / itens.length) * 100) : 0 };
  }), [filtered, now]);

  if (loadingRoles || isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando dashboard…</div>;

  if (perfil === "colaborador") {
    return <SimpleDashboard titulo="Meus chamados" descricao="Acompanhe somente os chamados abertos por você." cards={[
      ["Total chamados", resumo.total], ["Abertos agora", resumo.abertosAgora], ["Resolvidos", resumo.resolvidos],
    ]} recentes={recentes} catMap={catMap} showFilters={false} />;
  }

  if (perfil === "atendente") {
    return <AttendantDashboard resumo={resumo} recentes={recentes} porCategoria={porCategoria} catMap={catMap} userId={user.id} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Gerencial</h1>
          <p className="text-sm text-muted-foreground">{perfil === "gestor" ? "Métricas somente dos chamados abertos pela sua equipe." : "Métricas de todo o Service Desk."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={segmentoId} onValueChange={setSegmentoId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os segmentos</SelectItem>
              {segmentos.map((segmento: string) => <SelectItem key={segmento} value={segmento}>{segmento}</SelectItem>)}
            </SelectContent>
          </Select>
          {PERIODOS.map((d) => <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>{d}d</Button>)}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi label="Total chamados" valor={resumo.total} />
        <Kpi label="Abertos agora" valor={resumo.abertosAgora} />
        <Kpi label="Resolvidos" valor={resumo.resolvidos} />
        <Kpi label="Taxa SLA" valor={resumo.taxaSla !== null ? `${resumo.taxaSla}%` : "—"} destaque={resumo.taxaSla !== null && resumo.taxaSla >= 80} />
        <Kpi label="T. médio resolução" valor={resumo.tMedio !== null ? (resumo.tMedio < 1 ? `${Math.round(resumo.tMedio * 60)}min` : `${resumo.tMedio}h`) : "—"} />
        <Kpi label="Críticos abertos" valor={resumo.criticosAbertos} />
        <Kpi label="SLA vencendo" valor={resumo.vencendo} />
        <Kpi label="SLA vencido" valor={resumo.vencidos} />
        <Kpi label="SLA pausado" valor={resumo.pausados} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Volume de chamados por dia</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={volume}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="dia" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="abertos" stroke="#0078D4" strokeWidth={2} name="Abertos" /><Line type="monotone" dataKey="resolvidos" stroke="#107C10" strokeWidth={2} name="Resolvidos" /></LineChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">SLA por prioridade</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={slaPorPrioridade}><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="prioridade" tick={{ fontSize: 10 }} /><YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip formatter={(v: number) => `${v}%`} /><Bar dataKey="taxa_pct" name="Taxa SLA" radius={[4,4,0,0]}>{slaPorPrioridade.map((it) => <Cell key={it.prioridade} fill={COR_PRIORIDADE[it.prioridade] ?? "#8A8886"} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
      </div>

      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por categoria</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><BarChart data={porCategoria} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="categoria" type="category" width={130} /><Tooltip /><Bar dataKey="total" fill="#0078D4" name="Total" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></CardContent></Card>

      <Recentes recentes={recentes} catMap={catMap} filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus} />
    </div>
  );
}

function AttendantDashboard({ resumo, recentes, porCategoria, catMap, userId }: any) {
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">Meu Dashboard</h1><p className="text-sm text-muted-foreground">Indicadores da sua fila e dos seus chamados.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Total chamados" valor={resumo.total} sub="em seu nome ou sem atendente" />
      <Kpi label="Abertos agora" valor={resumo.abertosAgora} />
      <Kpi label="Taxa SLA" valor={resumo.taxaSla !== null ? `${resumo.taxaSla}%` : "—"} />
      <Kpi label="T. médio resolução" valor={resumo.tMedio !== null ? (resumo.tMedio < 1 ? `${Math.round(resumo.tMedio * 60)}min` : `${resumo.tMedio}h`) : "—"} />
      <Kpi label="Críticos abertos" valor={resumo.criticosAbertos} />
      <Kpi label="SLA vencendo" valor={resumo.vencendo} />
      <Kpi label="SLA vencido" valor={resumo.vencidos} />
      <Kpi label="SLA pausado" valor={resumo.pausados} />
    </div>
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por categoria</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={260}><BarChart data={porCategoria} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis type="number" allowDecimals={false} /><YAxis dataKey="categoria" type="category" width={140} /><Tooltip /><Bar dataKey="total" fill="#0078D4" name="Total" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
    <Recentes recentes={recentes} catMap={catMap} filtroStatus="todos" setFiltroStatus={() => undefined} somenteEmMeuNome userId={userId} showFilters={false} />
  </div>;
}

function SimpleDashboard({ titulo, descricao, cards, recentes, catMap, showFilters }: any) {
  return <div className="space-y-4">
    <div><h1 className="text-2xl font-bold">{titulo}</h1><p className="text-sm text-muted-foreground">{descricao}</p></div>
    <div className="grid gap-3 sm:grid-cols-3">{cards.map(([label, valor]: [string, number]) => <div key={label}><Kpi label={label} valor={valor} /></div>)}</div>
    <Recentes recentes={recentes} catMap={catMap} filtroStatus="todos" setFiltroStatus={() => undefined} showFilters={showFilters} />
  </div>;
}

function Recentes({ recentes, catMap, filtroStatus, setFiltroStatus, somenteEmMeuNome, showFilters = true }: any) {
  return <Card>
    <CardHeader className="pb-2 flex flex-row items-center justify-between"><div><CardTitle className="text-sm">Chamados recentes</CardTitle>{somenteEmMeuNome && <p className="text-xs text-muted-foreground mt-1">Somente chamados atribuídos a você.</p>}</div>
      {showFilters ? <div className="flex gap-1">{(["todos", "abertos", "andamento", "resolvidos"] as const).map((s) => <Button key={s} size="sm" variant={filtroStatus === s ? "default" : "outline"} onClick={() => setFiltroStatus(s)} className="h-7 text-xs">{s === "andamento" ? "Em andamento" : s[0].toUpperCase() + s.slice(1)}</Button>)}</div> : null}
    </CardHeader>
    <CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-xs text-muted-foreground border-b"><tr className="text-left"><th className="py-2 pr-3">#</th><th className="py-2 pr-3">Título</th><th className="py-2 pr-3">Categoria</th><th className="py-2 pr-3">Prioridade</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Aberto em</th></tr></thead>
      <tbody>{recentes.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum chamado encontrado.</td></tr> : recentes.map((c: Chamado) => <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40"><td className="py-2 pr-3 font-medium text-muted-foreground">{c.numero}</td><td className="py-2 pr-3 font-medium"><Link to="/chamados/$id" params={{ id: c.id }} className="hover:underline">{c.titulo}</Link></td><td className="py-2 pr-3"><Badge variant="secondary" className="font-normal">{c.categoria_id ? catMap[c.categoria_id] ?? "—" : "—"}</Badge></td><td className="py-2 pr-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${prioridadeStyle(c.prioridade)}`}>{c.prioridade}</span></td><td className="py-2 pr-3"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(c.status)}`}>{statusLabel(c.status)}</span></td><td className="py-2 pr-3 text-muted-foreground">{new Date(c.aberto_em).toLocaleDateString("pt-BR")}</td></tr>)}</tbody>
    </table></CardContent>
  </Card>;
}

function Kpi({ label, valor, sub, destaque }: { label: string; valor: string | number; sub?: string; destaque?: boolean }) {
  return <Card className={destaque ? "bg-primary text-primary-foreground border-primary" : ""}><CardContent className="p-4"><div className={`text-[10px] uppercase tracking-wider ${destaque ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{label}</div><div className="mt-1 text-2xl font-semibold">{valor}</div>{sub && <div className={`mt-1 text-[11px] ${destaque ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</div>}</CardContent></Card>;
}
