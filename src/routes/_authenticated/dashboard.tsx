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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel de indicadores | Mundo Vem Service Desk" },
      { name: "description", content: "Acompanhe volume de chamados, cumprimento de SLA, tempo médio de resolução e chamados críticos da Mundo Vem." },
      { property: "og:title", content: "Painel de indicadores | Mundo Vem Service Desk" },
      { property: "og:description", content: "Acompanhe volume de chamados, cumprimento de SLA, tempo médio de resolução e chamados críticos da Mundo Vem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Painel de indicadores | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Acompanhe volume de chamados, cumprimento de SLA, tempo médio de resolução e chamados críticos da Mundo Vem." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r) => r.role === "gestor" || r.role === "admin")) {
      throw redirect({ to: "/chamados" });
    }
  },
  component: DashboardPage,
});

const COR_PRIORIDADE: Record<string, string> = {
  critica: "#D13438", alta: "#F7A800", media: "#0078D4", baixa: "#107C10",
};

const PERIODOS = [7, 15, 30, 90] as const;

type Chamado = {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  prioridade: string;
  criado_em: string;
  resolvido_em: string | null;
  sla_resolucao_violado: boolean;
  prazo_resolucao: string | null;
  sla_pausado: boolean;
  sla_tempo_restante_segundos: number | null;
  categoria_id: string | null;
  atendente_id: string | null;
};

function prioridadeStyle(p: string) {
  const k = p?.toLowerCase();
  if (k === "critica") return "bg-red-100 text-red-700 border-red-200";
  if (k === "alta") return "bg-amber-100 text-amber-700 border-amber-200";
  if (k === "media") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}
function statusLabel(s: string) {
  const map: Record<string, string> = {
    aberto: "Aberto", em_andamento: "Em andamento",
    aguardando_usuario: "Aguardando usuário", aguardando_terceiro: "Aguardando terceiro",
    resolvido: "Resolvido", fechado: "Fechado", cancelado: "Cancelado",
  };
  return map[s] ?? s;
}
function statusStyle(s: string) {
  if (s === "aberto") return "bg-sky-100 text-sky-700";
  if (s === "em_andamento") return "bg-amber-100 text-amber-700";
  if (s === "resolvido") return "bg-emerald-100 text-emerald-700";
  if (s === "fechado") return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
}

function DashboardPage() {
  const [dias, setDias] = useState<number>(30);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "abertos" | "andamento" | "resolvidos">("todos");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d.toISOString();
  }, [dias]);

  const { data: chamados = [], isLoading } = useQuery({
    queryKey: ["dash-chamados", dias],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chamados")
        .select("id,numero,titulo,status,prioridade,criado_em,resolvido_em,sla_resolucao_violado,prazo_resolucao,sla_pausado,sla_tempo_restante_segundos,categoria_id,atendente_id")
        .gte("criado_em", since)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Chamado[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["dash-categorias"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("id,nome");
      return data ?? [];
    },
  });
  const catMap = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c.nome])), [categorias]);

  const resumo = useMemo(() => {
    const total = chamados.length;
    const abertosAgora = chamados.filter((c) => !["resolvido", "fechado", "cancelado"].includes(c.status)).length;
    const resolvidos = chamados.filter((c) => c.status === "resolvido" || c.status === "fechado");
    const criticosAbertos = chamados.filter((c) => c.prioridade === "critica" && !["resolvido", "fechado", "cancelado"].includes(c.status)).length;
    const slaStatus = (c: Chamado) => {
      if (c.sla_pausado) return "pausado";
      if (!c.prazo_resolucao) return "sem_sla";
      const sec = (new Date(c.prazo_resolucao).getTime() - now) / 1000;
      if (sec <= 0) return "vencido";
      if (sec <= 3600) return "vencendo";
      return "ok";
    };
    const vencidos = chamados.filter((c) => slaStatus(c) === "vencido").length;
    const vencendo = chamados.filter((c) => slaStatus(c) === "vencendo").length;
    const pausados = chamados.filter((c) => slaStatus(c) === "pausado").length;
    const violados = chamados.filter((c) => c.sla_resolucao_violado || slaStatus(c) === "vencido").length;
    const taxaSla = total ? Math.round(((total - violados) / total) * 100) : null;
    const durHoras = resolvidos
      .filter((c) => c.resolvido_em)
      .map((c) => (new Date(c.resolvido_em!).getTime() - new Date(c.criado_em).getTime()) / 3_600_000);
    const tMedio = durHoras.length ? +(durHoras.reduce((a, b) => a + b, 0) / durHoras.length).toFixed(1) : null;
    return { total, abertosAgora, resolvidos: resolvidos.length, criticosAbertos, taxaSla, tMedio, vencidos, vencendo, pausados };
  }, [chamados, now]);

  const volume = useMemo(() => {
    const map = new Map<string, { dia: string; abertos: number; resolvidos: number }>();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, { dia: k.slice(5), abertos: 0, resolvidos: 0 });
    }
    chamados.forEach((c) => {
      const k = c.criado_em.slice(0, 10);
      const row = map.get(k);
      if (row) row.abertos++;
      if (c.resolvido_em) {
        const kr = c.resolvido_em.slice(0, 10);
        const r = map.get(kr);
        if (r) r.resolvidos++;
      }
    });
    return Array.from(map.values());
  }, [chamados, dias]);

  const slaPorPrioridade = useMemo(() => {
    const ordem = ["baixa", "media", "alta", "critica"];
    return ordem.map((p) => {
      const itens = chamados.filter((c) => c.prioridade === p);
      const violados = itens.filter((c) => c.sla_resolucao_violado).length;
      const taxa = itens.length ? Math.round(((itens.length - violados) / itens.length) * 100) : 0;
      return { prioridade: p, total: itens.length, taxa_pct: taxa };
    });
  }, [chamados]);

  const porCategoria = useMemo(() => {
    const agg = new Map<string, number>();
    chamados.forEach((c) => {
      const nome = c.categoria_id ? catMap[c.categoria_id] ?? "—" : "—";
      agg.set(nome, (agg.get(nome) ?? 0) + 1);
    });
    return Array.from(agg.entries()).map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
  }, [chamados, catMap]);

  const recentes = useMemo(() => {
    const filtro = (c: Chamado) => {
      if (filtroStatus === "todos") return true;
      if (filtroStatus === "abertos") return c.status === "aberto";
      if (filtroStatus === "andamento") return c.status === "em_andamento";
      if (filtroStatus === "resolvidos") return c.status === "resolvido" || c.status === "fechado";
      return true;
    };
    return chamados.filter(filtro).slice(0, 10);
  }, [chamados, filtroStatus]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Gerencial</h1>
          <p className="text-sm text-muted-foreground">Métricas e performance do service desk</p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map((d) => (
            <Button key={d} size="sm" variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Kpi label="Total chamados" valor={resumo.total} />
        <Kpi label="Abertos agora" valor={resumo.abertosAgora} />
        <Kpi label="Resolvidos" valor={resumo.resolvidos} />
        <Kpi label="Taxa SLA" valor={resumo.taxaSla !== null ? `${resumo.taxaSla}%` : "—"}
             destaque={resumo.taxaSla !== null && resumo.taxaSla >= 80} />
        <Kpi label="T. médio resolução"
             valor={resumo.tMedio !== null ? (resumo.tMedio < 1 ? `${Math.round(resumo.tMedio * 60)}min` : `${resumo.tMedio}h`) : "—"} />
        <Kpi label="Críticos abertos" valor={resumo.criticosAbertos}
             sub={resumo.criticosAbertos ? "atenção necessária" : "nenhum"} />
        <Kpi label="SLA vencendo" valor={resumo.vencendo} />
        <Kpi label="SLA vencido" valor={resumo.vencidos} />
        <Kpi label="SLA pausado" valor={resumo.pausados} />
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume de chamados por dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volume} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="abertos" stroke="#0078D4" strokeWidth={2} dot={{ r: 2 }} name="Abertos" />
                <Line type="monotone" dataKey="resolvidos" stroke="#107C10" strokeWidth={2} dot={{ r: 2 }} name="Resolvidos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">SLA por prioridade</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={slaPorPrioridade} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="prioridade" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="taxa_pct" name="Taxa SLA" radius={[4, 4, 0, 0]}>
                  {slaPorPrioridade.map((it) => (
                    <Cell key={it.prioridade} fill={COR_PRIORIDADE[it.prioridade] ?? "#8A8886"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Categorias */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por categoria</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={porCategoria} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
              <YAxis dataKey="categoria" type="category" tick={{ fontSize: 10 }} width={130} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="total" fill="#0078D4" name="Total" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recentes */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Chamados recentes</CardTitle>
          <div className="flex gap-1">
            {(["todos", "abertos", "andamento", "resolvidos"] as const).map((s) => (
              <Button key={s} size="sm" variant={filtroStatus === s ? "default" : "outline"}
                      onClick={() => setFiltroStatus(s)} className="h-7 text-xs">
                {s === "andamento" ? "Em andamento" : s[0].toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr className="text-left">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Título</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3">Prioridade</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Aberto em</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isLoading && recentes.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum chamado no período.</td></tr>
              )}
              {recentes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 pr-3 font-medium text-muted-foreground">{c.numero}</td>
                  <td className="py-2 pr-3 font-medium">
                    <Link to="/chamados/$id" params={{ id: c.id }} className="hover:underline">{c.titulo}</Link>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge variant="secondary" className="font-normal">{c.categoria_id ? catMap[c.categoria_id] ?? "—" : "—"}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${prioridadeStyle(c.prioridade)}`}>
                      {c.prioridade}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, valor, sub, destaque }: { label: string; valor: string | number; sub?: string; destaque?: boolean }) {
  return (
    <Card className={destaque ? "bg-primary text-primary-foreground border-primary" : ""}>
      <CardContent className="p-4">
        <div className={`text-[10px] uppercase tracking-wider ${destaque ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold">{valor}</div>
        {sub && (
          <div className={`mt-1 text-[11px] ${destaque ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</div>
        )}
      </CardContent>
    </Card>
  );
}
