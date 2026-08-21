import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, FolderTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, type Role } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  head: () => ({ meta: [{ title: "Categorias | Mundo Vem Service Desk" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) throw redirect({ to: "/dashboard" });
  },
  component: CategoriasPage,
});

type Categoria = { id: string; nome: string; descricao: string | null; segmento: string; segmento_id: string | null; ativo: boolean; ordem: number; parent_id: string | null };
type Segmento = { id: string; nome: string; ativo: boolean };
type Subcategoria = { id: string; categoria_id: string; nome: string; descricao: string | null; ativo: boolean; ordem: number };

function CategoriasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [segmentoId, setSegmentoId] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<Categoria | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcategoria | null>(null);
  const [subNome, setSubNome] = useState("");
  const [subDescricao, setSubDescricao] = useState("");

  const { data: segmentos = [] } = useQuery({
    queryKey: ["admin-categorias-segmentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("segmentos").select("id,nome,ativo").eq("ativo", true).order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Segmento[];
    },
  });

  const { data: categorias = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin-categorias"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("categorias").select("id,nome,descricao,segmento,segmento_id,ativo,ordem,parent_id").is("parent_id", null).order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["admin-subcategorias"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("subcategorias").select("id,categoria_id,nome,descricao,ativo,ordem").order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as Subcategoria[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const cleanName = nome.trim();
      if (!cleanName) throw new Error("Informe o nome da categoria.");
      if (!segmentoId) throw new Error("Selecione o segmento.");
      const seg = segmentos.find((s) => s.id === segmentoId);
      if (!seg) throw new Error("Segmento inválido.");
      const payload = { nome: cleanName, descricao: descricao.trim() || null, segmento_id: segmentoId, segmento: seg.nome };
      const result = editing
        ? await (supabase as any).from("categorias").update(payload).eq("id", editing.id)
        : await (supabase as any).from("categorias").insert({ ...payload, ativo: true, ordem: categorias.length ? Math.max(...categorias.map((c) => c.ordem ?? 0)) + 1 : 1, parent_id: null });
      if (result.error) throw result.error;
    },
    onSuccess: () => { toast.success(editing ? "Categoria atualizada" : "Categoria criada"); close(); qc.invalidateQueries({ queryKey: ["admin-categorias"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar a categoria"),
  });

  const toggle = useMutation({
    mutationFn: async (c: Categoria) => {
      const { error } = await (supabase as any).from("categorias").update({ ativo: !c.ativo }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status da categoria atualizado"); qc.invalidateQueries({ queryKey: ["admin-categorias"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível alterar a categoria"),
  });

  const saveSub = useMutation({
    mutationFn: async () => {
      if (!selectedCategoria) throw new Error("Selecione uma categoria.");
      const cleanName = subNome.trim();
      if (!cleanName) throw new Error("Informe o nome da subcategoria.");
      const payload = { nome: cleanName, descricao: subDescricao.trim() || null };
      const current = subcategorias.filter((s) => s.categoria_id === selectedCategoria.id);
      const result = editingSub
        ? await (supabase as any).from("subcategorias").update(payload).eq("id", editingSub.id)
        : await (supabase as any).from("subcategorias").insert({ ...payload, categoria_id: selectedCategoria.id, ativo: true, ordem: current.length ? Math.max(...current.map((s) => s.ordem ?? 0)) + 1 : 1 });
      if (result.error) throw result.error;
    },
    onSuccess: () => { toast.success(editingSub ? "Subcategoria atualizada" : "Subcategoria criada"); closeSub(); qc.invalidateQueries({ queryKey: ["admin-subcategorias"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar a subcategoria"),
  });

  const toggleSub = useMutation({
    mutationFn: async (s: Subcategoria) => {
      const novoStatus = !s.ativo;
      const { error } = await (supabase as any).from("subcategorias").update({ ativo: novoStatus }).eq("id", s.id);
      if (error) throw error;
      return novoStatus;
    },
    onSuccess: (ativo) => { toast.success(ativo ? "Subcategoria reativada" : "Subcategoria desativada"); qc.invalidateQueries({ queryKey: ["admin-subcategorias"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível alterar o status da subcategoria"),
  });

  function create() { setEditing(null); setNome(""); setDescricao(""); setSegmentoId(""); setOpen(true); }
  function edit(c: Categoria) { setEditing(c); setNome(c.nome); setDescricao(c.descricao ?? ""); setSegmentoId(c.segmento_id ?? ""); setOpen(true); }
  function close() { setOpen(false); setEditing(null); setNome(""); setDescricao(""); setSegmentoId(""); }
  function createSub(c: Categoria) { setSelectedCategoria(c); setEditingSub(null); setSubNome(""); setSubDescricao(""); setSubOpen(true); }
  function editSub(c: Categoria, s: Subcategoria) { setSelectedCategoria(c); setEditingSub(s); setSubNome(s.nome); setSubDescricao(s.descricao ?? ""); setSubOpen(true); }
  function closeSub() { setSubOpen(false); setEditingSub(null); setSubNome(""); setSubDescricao(""); setSelectedCategoria(null); }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><FolderTree className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">Categorias</h1><p className="text-sm text-muted-foreground">Organize categorias por segmento e suas subcategorias.</p></div></div>
      <Button onClick={create}><Plus className="mr-2 h-4 w-4" />Nova categoria</Button>
    </div>
    <Card><CardHeader><CardTitle className="text-base">Categorias cadastradas</CardTitle></CardHeader><CardContent>
      {isLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div> : isError ? <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar as categorias: {error instanceof Error ? error.message : "erro desconhecido"}</div> : categorias.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma categoria cadastrada.</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categorias.map((c) => { const subs = subcategorias.filter((s) => s.categoria_id === c.id); return <Card key={c.id} className={!c.ativo ? "opacity-60" : ""}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><div><CardTitle className="text-base">{c.nome}</CardTitle><div className="mt-1 text-xs text-muted-foreground">Segmento: {c.segmento}</div></div><Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativa" : "Inativa"}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="text-sm text-muted-foreground">Subcategorias: <span className="font-semibold text-foreground">{subs.length}</span></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => edit(c)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button variant="outline" size="sm" onClick={() => createSub(c)}><Plus className="mr-2 h-4 w-4" />Subcategoria</Button><Button variant="ghost" size="icon" title={c.ativo ? "Desativar" : "Ativar"} onClick={() => toggle.mutate(c)}><Power className="h-4 w-4" /></Button></div>{subs.length > 0 && <div className="space-y-2 border-t pt-3">{subs.map((s) => <div key={s.id} className={`flex items-center justify-between gap-2 rounded-md border p-2 ${!s.ativo ? "opacity-60" : ""}`}><div><div className="text-sm font-medium">{s.nome}</div>{s.descricao && <div className="text-xs text-muted-foreground">{s.descricao}</div>}</div><div className="flex items-center gap-1"><Badge variant={s.ativo ? "default" : "secondary"}>{s.ativo ? "Ativa" : "Inativa"}</Badge><Button variant="ghost" size="icon" onClick={() => editSub(c, s)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => toggleSub.mutate(s)} disabled={toggleSub.isPending}>{s.ativo ? "Desativar" : "Reativar"}</Button></div></div>)}</div>}</CardContent></Card>; })}</div>}
    </CardContent></Card>
    <Dialog open={open} onOpenChange={(v) => !v && close()}><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle><DialogDescription>Associe a categoria a um segmento ativo.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Hardware" /></div><div className="space-y-1"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição opcional" /></div><div className="space-y-1"><Label>Segmento</Label><Select value={segmentoId} onValueChange={(v) => setSegmentoId(v)}><SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger><SelectContent>{segmentos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={subOpen} onOpenChange={(v) => !v && closeSub()}><DialogContent><DialogHeader><DialogTitle>{editingSub ? "Editar subcategoria" : "Nova subcategoria"}</DialogTitle><DialogDescription>Subcategoria de: {selectedCategoria?.nome}</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-4 py-2"><div className="space-y-1"><Label>Nome</Label><Input value={subNome} onChange={(e) => setSubNome(e.target.value)} placeholder="Ex.: Notebook" /></div><div className="space-y-1"><Label>Descrição</Label><Input value={subDescricao} onChange={(e) => setSubDescricao(e.target.value)} placeholder="Descrição opcional" /></div></div><DialogFooter><Button variant="outline" onClick={closeSub}>Cancelar</Button><Button disabled={saveSub.isPending} onClick={() => saveSub.mutate()}>{saveSub.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
