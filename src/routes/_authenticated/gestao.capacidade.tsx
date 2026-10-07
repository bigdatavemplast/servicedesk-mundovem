import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gestao/capacidade")({
  head: () => ({ meta: [{ title: "Capacidade e custos | Mundo Vem Service Desk" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => String(r.role) === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: CapacidadePage,
});

type Config = {
  id?: string;
  usuario_id: string | null;
  grupo_atendimento_id: string | null;
  horas_disponiveis_semana: number;
  custo_hora: number;
  ativo: boolean;
  atualizado_em?: string;
};
type Profile = { id: string; nome: string | null; email: string | null; ativo: boolean | null };
type Grupo = { id: string; nome: string; segmento_id: string | null; ativo: boolean | null };
type Segmento = { id: string; nome: string; ativo: boolean | null };

const emptyForm = { tipo: "usuario", referencia: "", horas: "40", custo: "0", ativo: true };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CapacidadePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [segmentoId, setSegmentoId] = useState("todos");
  const [savingError, setSavingError] = useState<string | null>(null);

  const { data: segmentos = [] } = useQuery({
    queryKey: ["gestao-capacidade-segmentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("segmentos").select("id,nome,ativo").eq("ativo", true).order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Segmento[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["gestao-capacidade-atendentes"],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "atendente");
      if (rolesError) throw rolesError;

      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id).filter(Boolean)));
      if (!ids.length) return [] as Profile[];

      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,email,ativo")
        .eq("ativo", true)
        .in("id", ids)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ["gestao-capacidade-grupos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("grupos_atendimento").select("id,nome,segmento_id,ativo").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as Grupo[];
    },
  });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["gestao-capacidade-configs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("gestao_capacidade").select("*").order("atualizado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Config[];
    },
  });

  const filteredConfigs = useMemo(() => {
    if (segmentoId === "todos") return configs;
    const groupIds = new Set(grupos.filter((g) => g.segmento_id === segmentoId).map((g) => g.id));
    const userIds = new Set<string>(profiles.map((p) => p.id));
    return configs.filter((c) => c.grupo_atendimento_id ? groupIds.has(c.grupo_atendimento_id) : c.usuario_id ? userIds.has(c.usuario_id) : false);
  }, [configs, grupos, profiles, segmentoId]);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p.nome || p.email || p.id])), [profiles]);
  const groupMap = useMemo(() => new Map(grupos.map((g) => [g.id, g.nome])), [grupos]);

  const reset = () => { setForm(emptyForm); setEditingId(null); setSavingError(null); };

  const save = useMutation({
    mutationFn: async () => {
      setSavingError(null);
      const horas = Number(form.horas);
      const custo = Number(form.custo);
      if (!form.referencia) throw new Error("Selecione um atendente ou grupo de atendimento.");
      if (!Number.isFinite(horas) || horas <= 0 || horas > 168) throw new Error("Informe horas semanais entre 0 e 168.");
      if (!Number.isFinite(custo) || custo < 0) throw new Error("Informe um custo/hora válido.");

      const payload = {
        usuario_id: form.tipo === "usuario" ? form.referencia : null,
        grupo_atendimento_id: form.tipo === "grupo" ? form.referencia : null,
        horas_disponiveis_semana: horas,
        custo_hora: custo,
        ativo: form.ativo,
      };

      if (editingId) {
        const { error } = await (supabase as any).from("gestao_capacidade").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: existing, error: lookupError } = await (supabase as any).from("gestao_capacidade").select("id").match({
          usuario_id: payload.usuario_id,
          grupo_atendimento_id: payload.grupo_atendimento_id,
        }).limit(1);
        if (lookupError) throw lookupError;
        if (existing?.[0]?.id) {
          const { error } = await (supabase as any).from("gestao_capacidade").update(payload).eq("id", existing[0].id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any).from("gestao_capacidade").insert(payload);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["gestao-capacidade-configs"] }); reset(); },
    onError: (error: any) => setSavingError(error?.message ?? "Não foi possível salvar a configuração."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("gestao_capacidade").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gestao-capacidade-configs"] }),
    onError: (error: any) => setSavingError(error?.message ?? "Não foi possível excluir a configuração."),
  });

  const edit = (c: Config) => {
    setEditingId(c.id ?? null);
    setForm({ tipo: c.usuario_id ? "usuario" : "grupo", referencia: c.usuario_id ?? c.grupo_atendimento_id ?? "", horas: String(c.horas_disponiveis_semana), custo: String(c.custo_hora), ativo: c.ativo });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-sm text-muted-foreground">Gestão do Service Desk</p>
        <h1 className="text-2xl font-bold tracking-tight">Capacidade e custo operacional</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cadastre a capacidade semanal e o custo/hora usados nas métricas de utilização e custo dos atendimentos.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>{editingId ? "Editar parâmetro" : "Novo parâmetro"}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2"><Label>Aplicar a</Label><Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v, referencia: "" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="usuario">Atendente</SelectItem><SelectItem value="grupo">Grupo de atendimento</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 lg:col-span-2"><Label>{form.tipo === "usuario" ? "Atendente" : "Grupo de atendimento"}</Label><Select value={form.referencia} onValueChange={(v) => setForm({ ...form, referencia: v })}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{form.tipo === "usuario" ? profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome || p.email || p.id}</SelectItem>) : grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Horas/semana</Label><Input type="number" min="1" max="168" step="0.5" value={form.horas} onChange={(e) => setForm({ ...form, horas: e.target.value })} /></div>
          <div className="space-y-2"><Label>Custo/hora (R$)</Label><Input type="number" min="0" step="0.01" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} /></div>
          <div className="flex items-end gap-2 lg:col-span-5"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : <><Plus className="mr-2 h-4 w-4" />{editingId ? "Salvar alterações" : "Cadastrar"}</>}</Button>{editingId && <Button variant="outline" onClick={reset}>Cancelar edição</Button>}</div>
          {savingError && <p className="text-sm text-destructive lg:col-span-5">{savingError}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Parâmetros cadastrados</h2><p className="text-sm text-muted-foreground">Esses valores alimentam automaticamente as métricas de custo e utilização.</p></div>
        <Select value={segmentoId} onValueChange={setSegmentoId}><SelectTrigger className="w-[220px]"><SelectValue placeholder="Todos os segmentos" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os segmentos</SelectItem>{segmentos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/40"><tr><th className="p-4 text-left">Responsável</th><th className="p-4 text-left">Tipo</th><th className="p-4 text-right">Horas/semana</th><th className="p-4 text-right">Custo/hora</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Ações</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr> : filteredConfigs.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum parâmetro cadastrado.</td></tr> : filteredConfigs.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="p-4 font-medium">{c.usuario_id ? profileMap.get(c.usuario_id) : c.grupo_atendimento_id ? groupMap.get(c.grupo_atendimento_id) : "—"}</td><td className="p-4">{c.usuario_id ? "Atendente" : "Grupo"}</td><td className="p-4 text-right">{Number(c.horas_disponiveis_semana).toLocaleString("pt-BR")} h</td><td className="p-4 text-right">{brl(Number(c.custo_hora))}</td><td className="p-4 text-center"><Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td><td className="p-4"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => edit(c)} title="Editar"><Pencil className="h-4 w-4" /></Button>{c.id && <Button size="sm" variant="ghost" onClick={() => { if (window.confirm("Excluir este parâmetro?")) remove.mutate(c.id!); }} title="Excluir"><Trash2 className="h-4 w-4" /></Button>}</div></td></tr>)}</tbody></table></div></CardContent></Card>

      <Card className="border-dashed"><CardContent className="flex gap-3 p-5 text-sm"><Activity className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-medium">Como o valor entra nas métricas</p><p className="mt-1 text-muted-foreground">Ao resolver um chamado, o sistema calcula o custo operacional pelo tempo de atendimento × custo/hora configurado. A utilização compara o tempo de atendimento com as horas disponíveis no período. Sem custo/hora configurado, o custo permanece sem valor em vez de inventar um número.</p></div></CardContent></Card>
    </div>
  );
}
