import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, UsersRound, Pencil, UserPlus, UserMinus, Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, type Role } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/grupos")({
  head: () => ({ meta: [{ title: "Filas de Atendimento | Mundo Vem Service Desk" }, { name: "description", content: "Consulte filas por segmento e seus atendentes." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.view_queues"))) throw redirect({ to: "/dashboard" });
  },
  component: GruposPage,
});

type Grupo = { id: string; segmento_id: string; nome: string; descricao: string | null; ativo: boolean; ordem: number; prefixo?: string | null };
type Segmento = { id: string; nome: string; ativo: boolean };
type Profile = { id: string; nome: string | null; email: string | null; ativo: boolean };
type Membership = { grupo_id: string; usuario_id: string; ativo: boolean };

function GruposPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Grupo | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Grupo | null>(null);
  const [segmentoFiltro, setSegmentoFiltro] = useState("todos");
  const [nome, setNome] = useState("");
  const [segmentoId, setSegmentoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["fila-current-user"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Usuário não autenticado");
      const { data: roles, error } = await (supabase as any).from("user_roles").select("role").eq("user_id", auth.user.id);
      if (error) throw error;
      return { id: auth.user.id, roles: (roles ?? []).map((r: { role: Role }) => r.role) as Role[] };
    },
  });

  const isAdmin = currentUser?.roles.includes("admin") ?? false;
  const isGestor = currentUser?.roles.includes("gestor") ?? false;
  const isAtendente = currentUser?.roles.includes("atendente") ?? false;

  const { data: segmentos = [] } = useQuery({
    queryKey: ["admin-segmentos-grupos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("segmentos").select("id,nome,ativo").eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as Segmento[];
    },
  });

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["admin-grupos-atendimento"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("grupos_atendimento").select("id,segmento_id,nome,descricao,ativo,ordem,prefixo").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Grupo[];
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-grupo-atendentes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("grupo_atendentes").select("grupo_id,usuario_id,ativo");
      if (error) throw error;
      return (data ?? []) as Membership[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-atendentes-grupos"],
    queryFn: async () => {
      const [{ data: ps, error: pe }, { data: rs, error: re }] = await Promise.all([
        (supabase as any).from("profiles").select("id,nome,email,ativo").eq("ativo", true).order("nome"),
        (supabase as any).from("user_roles").select("user_id,role").in("role", ["atendente", "gestor", "admin"]),
      ]);
      if (pe) throw pe;
      if (re) throw re;
      const ids = new Set((rs ?? []).map((r: { user_id: string }) => r.user_id));
      return ((ps ?? []) as Profile[]).filter((p) => ids.has(p.id));
    },
    enabled: isAdmin || isGestor || isAtendente,
  });

  const mySegmentIds = new Set(
    memberships.filter((m) => m.usuario_id === currentUser?.id && m.ativo).map((m) => grupos.find((g) => g.id === m.grupo_id)?.segmento_id).filter(Boolean) as string[],
  );

  const gruposPermitidos = isAdmin || isGestor || !isAtendente
    ? grupos
    : grupos.filter((g) => mySegmentIds.has(g.segmento_id));

  const segmentosPermitidos = isAdmin || isGestor || !isAtendente
    ? segmentos
    : segmentos.filter((s) => mySegmentIds.has(s.id));

  const segmentosVisiveis = [{ id: "todos", nome: "Todos", ativo: true }, ...segmentosPermitidos];
  const gruposFiltrados = segmentoFiltro === "todos" ? gruposPermitidos : gruposPermitidos.filter((g) => g.segmento_id === segmentoFiltro);

  const saveGroup = useMutation({
    mutationFn: async () => {
      if (!nome.trim() || !segmentoId) throw new Error("Informe o segmento e o nome da fila.");
      if (editing) {
        const { error } = await (supabase as any).from("grupos_atendimento").update({ nome: nome.trim(), segmento_id: segmentoId, descricao: descricao.trim() || null }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("grupos_atendimento").insert({ nome: nome.trim(), segmento_id: segmentoId, descricao: descricao.trim() || null });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Fila atualizada" : "Fila criada"); closeForm(); qc.invalidateQueries({ queryKey: ["admin-grupos-atendimento"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar a fila"),
  });

  const toggleGroup = useMutation({
    mutationFn: async (g: Grupo) => { const { error } = await (supabase as any).from("grupos_atendimento").update({ ativo: !g.ativo }).eq("id", g.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-grupos-atendimento"] }),
    onError: (e: any) => toast.error(e.message ?? "Não foi possível alterar a fila"),
  });

  const addUser = useMutation({
    mutationFn: async () => {
      if (!selectedGroup || !selectedUserId) throw new Error("Selecione um atendente.");
      const { error } = await (supabase as any).from("grupo_atendentes").upsert({ grupo_id: selectedGroup.id, usuario_id: selectedUserId, ativo: true }, { onConflict: "grupo_id,usuario_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atendente vinculado à fila"); setSelectedUserId(""); qc.invalidateQueries({ queryKey: ["admin-grupo-atendentes"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível vincular o atendente"),
  });

  const removeUser = useMutation({
    mutationFn: async ({ grupoId, usuarioId }: { grupoId: string; usuarioId: string }) => { const { error } = await (supabase as any).from("grupo_atendentes").update({ ativo: false }).eq("grupo_id", grupoId).eq("usuario_id", usuarioId); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-grupo-atendentes"] }),
    onError: (e: any) => toast.error(e.message ?? "Não foi possível remover o atendente"),
  });

  function openCreate() { setEditing(null); setNome(""); setDescricao(""); setSegmentoId(segmentosPermitidos[0]?.id ?? ""); setCreating(true); }
  function openEdit(g: Grupo) { setEditing(g); setNome(g.nome); setDescricao(g.descricao ?? ""); setSegmentoId(g.segmento_id); setCreating(true); }
  function closeForm() { setCreating(false); setEditing(null); }
  const segmentName = (id: string) => segmentos.find((s) => s.id === id)?.nome ?? "—";
  const groupMembers = (id: string) => memberships.filter((m) => m.grupo_id === id && m.ativo);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><UsersRound className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">Filas de Atendimento</h1><p className="text-sm text-muted-foreground">Selecione um segmento para visualizar sua fila.</p></div></div>
        {(isAdmin || isGestor) && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nova fila</Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {segmentosVisiveis.map((s) => {
          const selected = segmentoFiltro === s.id;
          const count = s.id === "todos" ? gruposPermitidos.filter((g) => g.ativo).length : gruposPermitidos.filter((g) => g.segmento_id === s.id && g.ativo).length;
          return <button key={s.id} type="button" onClick={() => setSegmentoFiltro(s.id)} className={`rounded-lg border p-4 text-left transition-colors hover:bg-muted/70 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"}`}><div className="text-sm font-semibold">{s.nome}</div><div className="mt-1 text-xs text-muted-foreground">{count} {count === 1 ? "fila" : "filas"}</div></button>;
        })}
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between"><div><CardTitle className="text-base">{segmentoFiltro === "todos" ? "Todas as filas" : `Fila — ${segmentName(segmentoFiltro)}`}</CardTitle><p className="text-sm text-muted-foreground">Cada segmento possui sua própria fila.</p></div><div className="w-full md:w-72"><Label className="mb-1 block text-xs">Segmento selecionado</Label><Select value={segmentoFiltro} onValueChange={setSegmentoFiltro}><SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger><SelectContent><SelectItem value="todos">Todos os segmentos</SelectItem>{segmentosPermitidos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select></div></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div> : gruposFiltrados.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma fila encontrada para o segmento selecionado.</div> : <div className="overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr className="border-b"><th className="px-4 py-3 text-left font-medium">Segmento</th><th className="px-4 py-3 text-left font-medium">Fila</th><th className="px-4 py-3 text-left font-medium">Prefixo</th><th className="px-4 py-3 text-left font-medium">Atendentes</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Ações</th></tr></thead><tbody>{gruposFiltrados.map((g) => { const members = groupMembers(g.id); return <tr key={g.id} className={`border-b last:border-0 ${!g.ativo ? "opacity-60" : ""}`}><td className="px-4 py-3">{segmentName(g.segmento_id)}</td><td className="px-4 py-3 font-medium">{g.nome}</td><td className="px-4 py-3 font-mono text-xs">{g.prefixo ?? "—"}</td><td className="px-4 py-3">{members.length}</td><td className="px-4 py-3"><Badge variant={g.ativo ? "default" : "secondary"}>{g.ativo ? "Ativa" : "Inativa"}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => { setSelectedGroup(g); setSelectedUserId(""); }}><UsersRound className="mr-2 h-4 w-4" />Atendentes</Button>{(isAdmin || isGestor) && <><Button variant="outline" size="sm" onClick={() => openEdit(g)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button variant="ghost" size="icon" title={g.ativo ? "Desativar" : "Ativar"} onClick={() => toggleGroup.mutate(g)}><Power className="h-4 w-4" /></Button></>}</div></td></tr>; })}</tbody></table></div>}
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={(open) => !open && closeForm()}><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar fila" : "Nova fila"}</DialogTitle><DialogDescription>A fila operacional corresponde ao segmento responsável pelo atendimento.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-1"><Label>Segmento</Label><Select value={segmentoId} onValueChange={setSegmentoId}><SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger><SelectContent>{segmentosPermitidos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Nome da fila</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: TI" /></div><div className="space-y-1"><Label>Descrição (opcional)</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Responsabilidade da fila" /></div></div><DialogFooter><Button variant="outline" onClick={closeForm}>Cancelar</Button><Button disabled={saveGroup.isPending} onClick={() => saveGroup.mutate()}>{saveGroup.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Atendentes — {selectedGroup?.nome}</DialogTitle><DialogDescription>O mesmo atendente pode pertencer a vários segmentos.</DialogDescription></DialogHeader><div className="space-y-4"><div className="flex gap-2"><Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um atendente" /></SelectTrigger><SelectContent>{profiles.filter((p) => !memberships.some((m) => m.grupo_id === selectedGroup?.id && m.usuario_id === p.id && m.ativo)).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome ?? p.email ?? p.id}</SelectItem>)}</SelectContent></Select><Button disabled={!selectedUserId || addUser.isPending} onClick={() => addUser.mutate()}><UserPlus className="mr-2 h-4 w-4" />Adicionar</Button></div><div className="space-y-2">{selectedGroup && groupMembers(selectedGroup.id).map((m) => { const p = profiles.find((x) => x.id === m.usuario_id); return <div key={m.usuario_id} className="flex items-center justify-between rounded-md border p-3"><div><div className="text-sm font-medium">{p?.nome ?? "Usuário"}</div><div className="text-xs text-muted-foreground">{p?.email ?? ""}</div></div><Button variant="ghost" size="sm" onClick={() => removeUser.mutate({ grupoId: selectedGroup.id, usuarioId: m.usuario_id })}><UserMinus className="mr-2 h-4 w-4" />Remover</Button></div>; })}{selectedGroup && groupMembers(selectedGroup.id).length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhum atendente vinculado.</p>}</div></div></DialogContent></Dialog>
    </div>
  );
}
