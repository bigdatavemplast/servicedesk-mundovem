import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, Trash2, Route as RouteIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, type Role } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/regras-atribuicao")({
  head: () => ({ meta: [{ title: "Regras de Atribuição | Mundo Vem Service Desk" }, { name: "description", content: "Configure a atribuição automática dos chamados." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) throw redirect({ to: "/dashboard" });
  },
  component: RegrasAtribuicaoPage,
});

type Rule = { id: string; nome: string; grupo_atendimento_id: string; categoria_id: string | null; subcategoria_id: string | null; tipo_chamado_id: string | null; atendente_id: string; prioridade: number; ativo: boolean };

type Option = { id: string; nome: string };

type Member = { usuario_id: string; grupo_id: string; ativo: boolean; profile?: { nome: string | null; email: string | null } | null };

function RegrasAtribuicaoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [subcategoriaId, setSubcategoriaId] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [atendenteId, setAtendenteId] = useState("");
  const [prioridade, setPrioridade] = useState("100");

  const { data: grupos = [] } = useQuery({ queryKey: ["regras-atribuicao-grupos"], queryFn: async () => { const { data, error } = await (supabase as any).from("grupos_atendimento").select("id,nome,segmento_id").eq("ativo", true).order("nome"); if (error) throw error; return data ?? []; } });
  const { data: categorias = [] } = useQuery({ queryKey: ["regras-atribuicao-categorias"], queryFn: async () => { const { data, error } = await (supabase as any).from("categorias").select("id,nome,segmento,segmento_id").eq("ativo", true).order("nome"); if (error) throw error; return data ?? []; } });
  const { data: subcategorias = [] } = useQuery({ queryKey: ["regras-atribuicao-subcategorias"], queryFn: async () => { const { data, error } = await (supabase as any).from("subcategorias").select("id,nome,categoria_id").eq("ativo", true).order("nome"); if (error) throw error; return data ?? []; } });
  const { data: tipos = [] } = useQuery({ queryKey: ["regras-atribuicao-tipos"], queryFn: async () => { const { data, error } = await (supabase as any).from("tipos_chamado").select("id,nome").eq("ativo", true).order("ordem").order("nome"); if (error) throw error; return data ?? []; } });
  const { data: members = [] } = useQuery({ queryKey: ["regras-atribuicao-members", grupoId], enabled: Boolean(grupoId), queryFn: async () => { const { data, error } = await (supabase as any).from("grupo_atendentes").select("grupo_id,usuario_id,ativo,profiles:usuario_id(nome,email)").eq("grupo_id", grupoId).eq("ativo", true); if (error) throw error; return (data ?? []) as Member[]; } });
  const { data: rules = [], isLoading } = useQuery({ queryKey: ["regras-atribuicao"], queryFn: async () => { const { data, error } = await (supabase as any).from("regras_atribuicao_automatica").select("*").order("prioridade").order("criado_em"); if (error) throw error; return (data ?? []) as Rule[]; } });

  const categoriasFiltradas = useMemo(() => { if (!grupoId) return categorias; const grupo = grupos.find((g: any) => g.id === grupoId); if (!grupo) return categorias; return categorias.filter((c: any) => c.segmento_id === grupo.segmento_id || c.segmento === grupo.nome); }, [categorias, grupoId, grupos]);
  const subsFiltradas = useMemo(() => subcategorias.filter((s: any) => !categoriaId || s.categoria_id === categoriaId), [subcategorias, categoriaId]);

  const save = useMutation({ mutationFn: async () => {
    const cleanName = nome.trim();
    if (!cleanName) throw new Error("Informe o nome da regra.");
    if (!grupoId) throw new Error("Selecione o grupo/fila.");
    if (!atendenteId) throw new Error("Selecione o atendente.");
    const payload = { nome: cleanName, grupo_atendimento_id: grupoId, categoria_id: categoriaId || null, subcategoria_id: subcategoriaId || null, tipo_chamado_id: tipoId || null, atendente_id: atendenteId, prioridade: Math.max(0, Number(prioridade) || 0), ativo: true };
    const { error } = editing ? await (supabase as any).from("regras_atribuicao_automatica").update(payload).eq("id", editing.id) : await (supabase as any).from("regras_atribuicao_automatica").insert(payload);
    if (error) throw error;
  }, onSuccess: () => { toast.success(editing ? "Regra atualizada" : "Regra criada"); close(); qc.invalidateQueries({ queryKey: ["regras-atribuicao"] }); }, onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar a regra") });

  const toggle = useMutation({ mutationFn: async (r: Rule) => { const { error } = await (supabase as any).from("regras_atribuicao_automatica").update({ ativo: !r.ativo }).eq("id", r.id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["regras-atribuicao"] }), onError: (e: any) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: async (r: Rule) => { const { error } = await (supabase as any).from("regras_atribuicao_automatica").delete().eq("id", r.id); if (error) throw error; }, onSuccess: () => { toast.success("Regra excluída"); qc.invalidateQueries({ queryKey: ["regras-atribuicao"] }); }, onError: (e: any) => toast.error(e.message) });

  function close() { setOpen(false); setEditing(null); setNome(""); setGrupoId(""); setCategoriaId(""); setSubcategoriaId(""); setTipoId(""); setAtendenteId(""); setPrioridade("100"); }
  function create() { close(); setOpen(true); }
  function edit(r: Rule) { setEditing(r); setNome(r.nome); setGrupoId(r.grupo_atendimento_id); setCategoriaId(r.categoria_id ?? ""); setSubcategoriaId(r.subcategoria_id ?? ""); setTipoId(r.tipo_chamado_id ?? ""); setAtendenteId(r.atendente_id); setPrioridade(String(r.prioridade)); setOpen(true); }
  const label = (list: Option[], id: string | null) => id ? list.find((x) => x.id === id)?.nome ?? "—" : "Qualquer";
  const groupName = (id: string) => grupos.find((g: any) => g.id === id)?.nome ?? "—";
  const memberName = (id: string) => { for (const m of members) if (m.usuario_id === id) return m.profile?.nome ?? m.profile?.email ?? id; return id; };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><RouteIcon className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">Regras de Atribuição</h1><p className="text-sm text-muted-foreground">Defina quem recebe automaticamente cada combinação de fila e classificação.</p></div></div><Button onClick={create}><Plus className="mr-2 h-4 w-4" />Nova regra</Button></div>
    <Card><CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">O grupo/fila é definido na abertura. Quando houver uma regra compatível, o sistema atribui o atendente automaticamente e coloca o chamado em <strong className="text-foreground">aberto</strong>. Sem regra, o chamado permanece disponível para triagem.</CardContent></Card>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Regra</th><th className="p-3">Fila</th><th className="p-3">Classificação</th><th className="p-3">Atendente</th><th className="p-3">Prioridade</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando…</td></tr> : rules.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma regra cadastrada.</td></tr> : rules.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="p-3 font-medium">{r.nome}</td><td className="p-3">{groupName(r.grupo_atendimento_id)}</td><td className="p-3 text-muted-foreground">{label(categorias, r.categoria_id)} / {label(subcategorias, r.subcategoria_id)} / {label(tipos, r.tipo_chamado_id)}</td><td className="p-3">{r.atendente_id}</td><td className="p-3">{r.prioridade}</td><td className="p-3"><Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge></td><td className="p-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Editar" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title={r.ativo ? "Desativar" : "Ativar"} onClick={() => toggle.mutate(r)}><Power className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Excluir" onClick={() => { if (confirm(`Excluir a regra \"${r.nome}\"?`)) remove.mutate(r); }}><Trash2 className="h-4 w-4 text-red-500" /></Button></div></td></tr>)}</tbody></table></div></CardContent></Card>
    <Dialog open={open} onOpenChange={(v) => !v && close()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Editar regra" : "Nova regra"}</DialogTitle><DialogDescription>Os campos de categoria, subcategoria e tipo são opcionais. Quanto mais específicos, maior a prioridade automática da combinação.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2"><Label>Nome da regra</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: TI - Hardware - Notebook → Leonardo" /></div>
      <div className="space-y-1"><Label>Grupo / Fila *</Label><Select value={grupoId} onValueChange={(v) => { setGrupoId(v); setAtendenteId(""); }}><SelectTrigger><SelectValue placeholder="Selecione a fila" /></SelectTrigger><SelectContent>{grupos.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Atendente *</Label><Select value={atendenteId} onValueChange={setAtendenteId} disabled={!grupoId}><SelectTrigger><SelectValue placeholder={grupoId ? "Selecione o atendente" : "Selecione a fila primeiro"} /></SelectTrigger><SelectContent>{members.map((m) => <SelectItem key={m.usuario_id} value={m.usuario_id}>{m.profile?.nome ?? m.profile?.email ?? m.usuario_id}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Categoria</Label><Select value={categoriaId || "todos"} onValueChange={(v) => { setCategoriaId(v === "todos" ? "" : v); setSubcategoriaId(""); }}><SelectTrigger><SelectValue placeholder="Qualquer categoria" /></SelectTrigger><SelectContent><SelectItem value="todos">Qualquer categoria</SelectItem>{categoriasFiltradas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Subcategoria</Label><Select value={subcategoriaId || "todos"} onValueChange={(v) => setSubcategoriaId(v === "todos" ? "" : v)}><SelectTrigger><SelectValue placeholder="Qualquer subcategoria" /></SelectTrigger><SelectContent><SelectItem value="todos">Qualquer subcategoria</SelectItem>{subsFiltradas.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Tipo de chamado</Label><Select value={tipoId || "todos"} onValueChange={(v) => setTipoId(v === "todos" ? "" : v)}><SelectTrigger><SelectValue placeholder="Qualquer tipo" /></SelectTrigger><SelectContent><SelectItem value="todos">Qualquer tipo</SelectItem>{tipos.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Prioridade da regra</Label><Input type="number" min={0} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} /><p className="text-xs text-muted-foreground">Menor número = maior prioridade.</p></div>
    </div><DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Salvar regra"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
