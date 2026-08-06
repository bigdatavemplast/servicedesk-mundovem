import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/fila")({
  head: () => ({
    meta: [
      { title: "Fila de atendimento | Mundo Vem Service Desk" },
      { name: "description", content: "Fila dos técnicos com chamados pendentes, prioridade e sinalização de risco de estouro de SLA." },
      { property: "og:title", content: "Fila de atendimento | Mundo Vem Service Desk" },
      { property: "og:description", content: "Fila dos técnicos com chamados pendentes, prioridade e sinalização de risco de estouro de SLA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Fila de atendimento | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Fila dos técnicos com chamados pendentes, prioridade e sinalização de risco de estouro de SLA." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: FilaPage,
});

const STATUS = [
  { v: "", l: "Todos" },
  { v: "aberto", l: "Abertos" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "aguardando_usuario", l: "Aguardando usuário" },
  { v: "resolvido", l: "Resolvidos" },
];
const PRIOS = [
  { v: "__all__", l: "Todas as prioridades" },
  { v: "critica", l: "Crítica" }, { v: "alta", l: "Alta" },
  { v: "media", l: "Média" }, { v: "baixa", l: "Baixa" },
];

function statusStyle(s: string) {
  if (s === "aberto") return "bg-sky-100 text-sky-700";
  if (s === "em_andamento") return "bg-amber-100 text-amber-700";
  if (s.startsWith("aguardando")) return "bg-orange-100 text-orange-700";
  if (s === "resolvido") return "bg-emerald-100 text-emerald-700";
  if (s === "fechado") return "bg-violet-100 text-violet-700";
  return "bg-muted text-muted-foreground";
}
function prioStyle(p: string) {
  return p === "critica" ? "bg-red-100 text-red-700"
    : p === "alta" ? "bg-amber-100 text-amber-700"
    : p === "media" ? "bg-blue-100 text-blue-700"
    : "bg-emerald-100 text-emerald-700";
}

function FilaPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [prioridade, setPrioridade] = useState("__all__");

  const { data: chamados = [], isLoading } = useQuery({
    queryKey: ["fila", status, prioridade],
    queryFn: async () => {
      let q = supabase.from("chamados")
        .select("id,numero,titulo,status,prioridade,aberto_em,sla_resolucao_violado,categoria:categorias(nome),solicitante:profiles!chamados_solicitante_profile_fkey(nome)")
        .order("aberto_em", { ascending: false }).limit(200);
      if (status) q = q.eq("status", status as any);
      if (prioridade !== "__all__") q = q.eq("prioridade", prioridade as any);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fila de atendimento</h1>
        <p className="text-sm text-muted-foreground">Todos os chamados para triagem e atendimento.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {STATUS.map((o) => (
            <Button key={o.v || "all"} size="sm" variant={status === o.v ? "default" : "outline"}
              className="h-8" onClick={() => setStatus(o.v)}>{o.l}</Button>
          ))}
        </div>
        <div className="ml-auto w-48">
          <Select value={prioridade} onValueChange={setPrioridade}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIOS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Título</th>
                <th className="px-4 py-2">Solicitante</th>
                <th className="px-4 py-2">Categoria</th>
                <th className="px-4 py-2">Prioridade</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Aberto em</th>
                <th className="px-4 py-2">SLA</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Carregando…</td></tr>}
              {!isLoading && chamados.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Nenhum chamado encontrado.</td></tr>
              )}
              {chamados.map((c: any) => (
                <tr key={c.id} onClick={() => navigate({ to: "/chamados/$id", params: { id: c.id } })}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{c.numero}</td>
                  <td className="px-4 py-2 font-medium">{c.titulo}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.solicitante?.nome ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.categoria?.nome ?? "—"}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${prioStyle(c.prioridade)}`}>{c.prioridade}</span></td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${statusStyle(c.status)}`}>{c.status}</span></td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(c.aberto_em).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2 text-xs">{c.sla_resolucao_violado ? <span className="text-red-600 font-medium">⚠ Vencido</span> : <span className="text-muted-foreground">Ok</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
