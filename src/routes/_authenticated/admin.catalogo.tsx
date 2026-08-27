import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Layers3, ListChecks, FolderTree, Loader2, Plus, Pencil, Power, Trash2 } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo | Mundo Vem Service Desk" }, { name: "description", content: "Visão operacional do catálogo de serviços do Service Desk." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) throw redirect({ to: "/dashboard" });
  },
  component: CatalogoPage,
});

type Segmento = { id: string; nome: string; ativo: boolean; ordem: number | null };
type Categoria = { id: string; nome: string; descricao: string | null; segmento: string | null; segmento_id: string | null; ativo: boolean; ordem: number | null };
type Subcategoria = { id: string; nome: string; categoria_id: string; ativo?: boolean; ordem?: number | null };
type Tipo = { id: string; nome: string; descricao: string | null; ativo: boolean; ordem: number };
type CatalogoItem = { id: string; nome: string; descricao: string | null; instrucoes: string | null; segmento_id: string; categoria_id: string; subcategoria_id: string | null; tipo_chamado_id: string; ativo: boolean; publicado: boolean; requer_aprovacao: boolean; campos_formulario: unknown; ordem: number };

function CatalogoPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CatalogoItem | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-catalogo"],
    queryFn: async () => {
      const [segmentosResult, categoriasResult, subcategoriasResult, tiposResult, itensResult] = await Promise.all([
        supabase.from("segmentos").select("id,nome,ativo,ordem").order("ordem").order("nome"),
        supabase.from("categorias").select("id,nome,descricao,segmento,segmento_id,ativo,ordem").order("ordem").order("nome"),
        supabase.from("subcategorias").select("id,nome,categoria_id,ativo,ordem").order("ordem").order("nome"),
        supabase.from("tipos_chamado").select("id,nome,descricao,ativo,ordem").order("ordem").order("nome"),
        supabase.from("itsm_itens_catalogo").select("id,nome,descricao,instrucoes,segmento_id,categoria_id,subcategoria_id,tipo_chamado_id,ativo,publicado,requer_aprovacao,campos_formulario,ordem").order("ordem").order("nome"),
      ]);
      for (const result of [segmentosResult, categoriasResult, subcategoriasResult, tiposResult, itensResult]) if (result.error) throw result.error;
      return {
        segmentos: (segmentosResult.data ?? []) as Segmento[],
        categorias: (categoriasResult.data ?? []) as Categoria[],
        subcategorias: (subcategoriasResult.data ?? []) as Subcategoria[],
        tipos: (tiposResult.data ?? []) as Tipo[],
        itens: (itensResult.data ?? []) as CatalogoItem[],
      };
    },
  });

  if (isLoading) return <div className="flex min-h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando catálogo...</div>;
  if (error || !data) return <div className="rounded-lg border p-6 text-sm text-destructive">Não foi possível carregar o catálogo.</div>;

  const activeSegmentos = data.segmentos.filter((s) => s.ativo);
  const activeCategorias = data.categorias.filter((c) => c.ativo);
  const activeSubcategorias = data.subcategorias.filter((s) => s.ativo !== false);
  const activeTipos = data.tipos.filter((t) => t.ativo);

  const saveItem = async (form: HTMLFormElement) => {
    setSaving(true);
    const fd = new FormData(form);
    const payload = {
      nome: String(fd.get("nome") ?? "").trim(),
      descricao: String(fd.get("descricao") ?? "").trim() || null,
      instrucoes: String(fd.get("instrucoes") ?? "").trim() || null,
      segmento_id: String(fd.get("segmento_id")),
      categoria_id: String(fd.get("categoria_id")),
      subcategoria_id: String(fd.get("subcategoria_id") || "") || null,
      tipo_chamado_id: String(fd.get("tipo_chamado_id")),
      requer_aprovacao: fd.get("requer_aprovacao") === "on",
      ativo: true,
      publicado: false,
      ordem: 0,
    };
    if (!payload.nome) { toast.error("Informe o nome do item."); setSaving(false); return; }
    const result = editing
      ? await supabase.from("itsm_itens_catalogo").update(payload).eq("id", editing.id)
      : await supabase.from("itsm_itens_catalogo").insert(payload);
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(editing ? "Item atualizado." : "Item criado como rascunho.");
    setEditing(null); setShowForm(false); await queryClient.invalidateQueries({ queryKey: ["admin-catalogo"] });
  };

  const togglePublished = async (item: CatalogoItem) => {
    const { error: updateError } = await supabase.from("itsm_itens_catalogo").update({ publicado: !item.publicado }).eq("id", item.id);
    if (updateError) toast.error(updateError.message); else { toast.success(item.publicado ? "Item despublicado." : "Item publicado."); await queryClient.invalidateQueries({ queryKey: ["admin-catalogo"] }); }
  };
  const toggleActive = async (item: CatalogoItem) => {
    const { error: updateError } = await supabase.from("itsm_itens_catalogo").update({ ativo: !item.ativo }).eq("id", item.id);
    if (updateError) toast.error(updateError.message); else { toast.success(item.ativo ? "Item desativado." : "Item ativado."); await queryClient.invalidateQueries({ queryKey: ["admin-catalogo"] }); }
  };
  const removeItem = async (item: CatalogoItem) => {
    if (!window.confirm(`Excluir o item "${item.nome}"?`)) return;
    const { error: deleteError } = await supabase.from("itsm_itens_catalogo").delete().eq("id", item.id);
    if (deleteError) toast.error(deleteError.message); else { toast.success("Item excluído."); await queryClient.invalidateQueries({ queryKey: ["admin-catalogo"] }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary" /><div><h1 className="text-2xl font-bold">Catálogo</h1><p className="text-sm text-muted-foreground">Visão operacional da estrutura usada para orientar a abertura e o tratamento dos chamados.</p></div></div></div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" />Novo item</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Layers3} label="Segmentos ativos" value={activeSegmentos.length} /><SummaryCard icon={FolderTree} label="Categorias ativas" value={activeCategorias.length} /><SummaryCard icon={FolderTree} label="Subcategorias ativas" value={activeSubcategorias.length} /><SummaryCard icon={ListChecks} label="Tipos ativos" value={activeTipos.length} />
      </div>

      {showForm && <CatalogoForm item={editing} data={data} saving={saving} onCancel={() => { setEditing(null); setShowForm(false); }} onSubmit={saveItem} />}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Itens de catálogo</CardTitle><Badge variant="outline">{data.itens.length}</Badge></CardHeader>
        <CardContent>
          {data.itens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item cadastrado. Clique em “Novo item” para criar o primeiro.</p> : <div className="space-y-3">{data.itens.map((item) => {
            const segmento = data.segmentos.find((x) => x.id === item.segmento_id)?.nome ?? "—";
            const categoria = data.categorias.find((x) => x.id === item.categoria_id)?.nome ?? "—";
            const subcategoria = data.subcategorias.find((x) => x.id === item.subcategoria_id)?.nome;
            const tipo = data.tipos.find((x) => x.id === item.tipo_chamado_id)?.nome ?? "—";
            return <div key={item.id} className="rounded-lg border p-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.nome}</span><Badge variant={item.publicado ? "default" : "secondary"}>{item.publicado ? "Publicado" : "Rascunho"}</Badge>{!item.ativo && <Badge variant="destructive">Inativo</Badge>}{item.requer_aprovacao && <Badge variant="outline">Aprovação</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{segmento} · {categoria}{subcategoria ? ` · ${subcategoria}` : ""} · {tipo}</p>{item.descricao && <p className="mt-2 text-sm">{item.descricao}</p>}</div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => { setEditing(item); setShowForm(true); }}><Pencil className="mr-1 h-4 w-4" />Editar</Button><Button size="sm" variant="outline" onClick={() => void togglePublished(item)}>{item.publicado ? "Despublicar" : "Publicar"}</Button><Button size="sm" variant="outline" onClick={() => void toggleActive(item)}><Power className="mr-1 h-4 w-4" />{item.ativo ? "Desativar" : "Ativar"}</Button><Button size="sm" variant="ghost" onClick={() => void removeItem(item)}><Trash2 className="h-4 w-4" /></Button></div></div></div>;
          })}</div>}
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base">Estrutura do catálogo</CardTitle></CardHeader><CardContent className="space-y-4">{activeSegmentos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum segmento ativo cadastrado.</p> : activeSegmentos.map((segmento) => { const categorias = activeCategorias.filter((categoria) => categoria.segmento_id === segmento.id || categoria.segmento === segmento.nome); return <div key={segmento.id} className="rounded-lg border p-4"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary" /><h2 className="font-semibold">{segmento.nome}</h2></div><Badge variant="outline">{categorias.length} categoria(s)</Badge></div>{categorias.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma categoria ativa vinculada a este segmento.</p> : <div className="grid gap-3 md:grid-cols-2">{categorias.map((categoria) => { const subs = activeSubcategorias.filter((sub) => sub.categoria_id === categoria.id); return <div key={categoria.id} className="rounded-md bg-muted/30 p-3"><div className="flex items-start justify-between gap-2"><div><div className="font-medium">{categoria.nome}</div>{categoria.descricao && <div className="mt-1 text-xs text-muted-foreground">{categoria.descricao}</div>}</div><Badge variant="secondary">{subs.length}</Badge></div>{subs.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{subs.map((sub) => <Badge key={sub.id} variant="outline">{sub.nome}</Badge>)}</div>}</div>; })}</div>}</div>; })}</CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">Tipos de chamado</CardTitle></CardHeader><CardContent>{activeTipos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum tipo ativo cadastrado.</p> : <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{activeTipos.map((tipo) => <div key={tipo.id} className="rounded-md border p-3"><div className="font-medium">{tipo.nome}</div>{tipo.descricao && <div className="mt-1 text-xs text-muted-foreground">{tipo.descricao}</div>}</div>)}</div>}</CardContent></Card>
    </div>
  );
}

function CatalogoForm({ item, data, saving, onCancel, onSubmit }: { item: CatalogoItem | null; data: { segmentos: Segmento[]; categorias: Categoria[]; subcategorias: Subcategoria[]; tipos: Tipo[] }; saving: boolean; onCancel: () => void; onSubmit: (form: HTMLFormElement) => Promise<void> }) {
  const [segmentoId, setSegmentoId] = useState(item?.segmento_id ?? data.segmentos.find((s) => s.ativo)?.id ?? "");
  const [categoriaId, setCategoriaId] = useState(item?.categoria_id ?? "");
  const categorias = data.categorias.filter((c) => c.ativo && (c.segmento_id === segmentoId || c.segmento === data.segmentos.find((s) => s.id === segmentoId)?.nome));
  const subcategorias = data.subcategorias.filter((s) => s.ativo !== false && s.categoria_id === categoriaId);
  return <Card><CardHeader><CardTitle className="text-base">{item ? "Editar item de catálogo" : "Novo item de catálogo"}</CardTitle></CardHeader><CardContent><form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void onSubmit(e.currentTarget); }}>
    <div className="md:col-span-2"><label className="text-sm font-medium">Nome *</label><Input name="nome" defaultValue={item?.nome ?? ""} className="mt-1" placeholder="Ex.: Solicitar acesso ao sistema" /></div>
    <div><label className="text-sm font-medium">Segmento *</label><select name="segmento_id" value={segmentoId} onChange={(e) => { setSegmentoId(e.target.value); setCategoriaId(""); }} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">{data.segmentos.filter((s) => s.ativo).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
    <div><label className="text-sm font-medium">Categoria *</label><select name="categoria_id" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Selecione</option>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
    <div><label className="text-sm font-medium">Subcategoria</label><select name="subcategoria_id" defaultValue={item?.subcategoria_id ?? ""} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Nenhuma</option>{subcategorias.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
    <div><label className="text-sm font-medium">Tipo de chamado *</label><select name="tipo_chamado_id" defaultValue={item?.tipo_chamado_id ?? data.tipos.find((t) => t.ativo)?.id ?? ""} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">{data.tipos.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></div>
    <div className="md:col-span-2"><label className="text-sm font-medium">Descrição</label><Textarea name="descricao" defaultValue={item?.descricao ?? ""} className="mt-1" placeholder="Explique o que o usuário está solicitando." /></div>
    <div className="md:col-span-2"><label className="text-sm font-medium">Instruções</label><Textarea name="instrucoes" defaultValue={item?.instrucoes ?? ""} className="mt-1" placeholder="Orientações para o solicitante e atendimento." /></div>
    <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="requer_aprovacao" defaultChecked={item?.requer_aprovacao ?? false} /> Requer aprovação antes do atendimento</label>
    <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{item ? "Salvar alterações" : "Criar item"}</Button></div>
  </form></CardContent></Card>;
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: number }) { return <Card><CardContent className="flex items-center justify-between p-4"><div><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value}</div></div><Icon className="h-7 w-7 text-primary" /></CardContent></Card>; }
