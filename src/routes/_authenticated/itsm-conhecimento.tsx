import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Eye, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-conhecimento")({ component: ItsmConhecimento });

type Article = { id: string; titulo: string; resumo: string | null; conteudo: string; categoria: string | null; status: string; versao: number; autor_id: string | null; revisor_id: string | null; publicado_em: string | null; revisao_em: string | null; validade_em: string | null; visualizacoes: number; util: number; nao_util: number; criado_em: string; atualizado_em: string };
type Categoria = { id: string; nome: string; ativo: boolean };

function slugify(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "artigo";
}

function ItsmConhecimento() {
  const qc = useQueryClient();
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<Article | null>(null); const [editing, setEditing] = useState<Article | null>(null); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(""); const [resumo, setResumo] = useState(""); const [conteudo, setConteudo] = useState(""); const [categoria, setCategoria] = useState(""); const [status, setStatus] = useState("rascunho");
  const { data: categorias = [] } = useQuery({ queryKey: ["itsm-conhecimento-categorias"], queryFn: async () => { const { data, error } = await supabase.from("categorias").select("id,nome,ativo").eq("ativo", true).order("ordem").order("nome"); if (error) throw error; return (data ?? []) as Categoria[]; } });
  const { data, isLoading } = useQuery({ queryKey: ["itsm-conhecimento", search], queryFn: async () => { let q = supabase.from("itsm_artigos_conhecimento").select("*").order("atualizado_em", { ascending: false }); if (search.trim()) q = q.or(`titulo.ilike.%${search.trim()}%,resumo.ilike.%${search.trim()}%,conteudo.ilike.%${search.trim()}%`); const { data, error } = await q; if (error) throw error; return (data ?? []) as Article[]; } });
  const reset = () => { setTitulo(""); setResumo(""); setConteudo(""); setCategoria(""); setStatus("rascunho"); setError(null); };
  const startEdit = (a?: Article) => { if (a) { setEditing(a); setTitulo(a.titulo); setResumo(a.resumo ?? ""); setConteudo(a.conteudo); setCategoria(a.categoria ?? ""); setStatus(a.status); } else { setEditing(null); reset(); } setOpen(true); };
  const sincronizarBase = async (a: Article) => {
    const { data: user } = await supabase.auth.getUser();
    const categoriaId = a.categoria ? categorias.find((c) => c.nome === a.categoria)?.id ?? null : null;
    const { data: existing } = await supabase.from("base_conhecimento").select("id,slug").eq("id", a.id).maybeSingle();
    const slug = existing?.slug || `${slugify(a.titulo)}-${a.id.slice(0, 8)}`;
    const { error } = await supabase.from("base_conhecimento").upsert({ id: a.id, titulo: a.titulo, slug, conteudo: a.conteudo, categoria_id: categoriaId, publicado: true, visualizacoes: a.visualizacoes ?? 0, autor_id: a.autor_id ?? user.user?.id ?? null, criado_em: a.criado_em, atualizado_em: new Date().toISOString() } as never, { onConflict: "id" });
    return error;
  };
  const save = async () => {
    if (!titulo.trim() || !conteudo.trim()) return setError("Informe título e conteúdo."); if (!categoria) return setError("Selecione uma categoria."); setSaving(true); setError(null);
    const payload = { titulo: titulo.trim(), resumo: resumo.trim() || null, conteudo: conteudo.trim(), categoria, status, atualizado_em: new Date().toISOString(), ...(status === "publicado" && !editing?.publicado_em ? { publicado_em: new Date().toISOString() } : {}) };
    const result = editing ? await supabase.from("itsm_artigos_conhecimento").update({ ...payload, versao: editing.versao + 1 }).eq("id", editing.id).select("*").single() : await supabase.from("itsm_artigos_conhecimento").insert(payload).select("*").single(); setSaving(false); if (result.error) return setError(result.error.message);
    const artigo = result.data as Article; if (artigo.status === "publicado") { const syncError = await sincronizarBase(artigo); if (syncError) return setError(`Artigo publicado, mas não foi possível sincronizar a Base de Conhecimento: ${syncError.message}`); }
    setSelected(artigo); setOpen(false); setEditing(null); reset(); await qc.invalidateQueries({ queryKey: ["itsm-conhecimento"] });
  };
  const publish = async (a: Article) => { setError(null); const { data: updated, error } = await supabase.from("itsm_artigos_conhecimento").update({ status: "publicado", publicado_em: a.publicado_em ?? new Date().toISOString(), atualizado_em: new Date().toISOString() }).eq("id", a.id).select("*").single(); if (error) return setError(error.message); const syncError = await sincronizarBase(updated as Article); if (syncError) return setError(`Publicado no módulo, mas a Base de Conhecimento não foi sincronizada: ${syncError.message}`); await qc.invalidateQueries({ queryKey: ["itsm-conhecimento"] }); };
  return <div className="space-y-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary"/><h1 className="text-2xl font-semibold tracking-tight">Gestão de Conhecimento</h1></div><p className="text-sm text-muted-foreground">Artigos, procedimentos, soluções e conhecimento reutilizável do ITSM.</p></div><Button onClick={() => startEdit()}><Plus className="mr-2 h-4 w-4"/>Novo artigo</Button></div>
  <Card><CardContent className="pt-6"><Input placeholder="Pesquisar artigos..." value={search} onChange={e => setSearch(e.target.value)}/></CardContent></Card>
  {open && <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{editing ? "Editar artigo" : "Novo artigo"}</CardTitle><Button variant="ghost" size="icon" onClick={() => { setOpen(false); setEditing(null); }}><X className="h-4 w-4"/></Button></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Título *</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)}/></div><div className="space-y-2"><Label>Categoria *</Label><Select value={categoria} onValueChange={setCategoria}><SelectTrigger><SelectValue placeholder="Selecione uma categoria"/></SelectTrigger><SelectContent>{categorias.map(c => <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="rascunho">Rascunho</SelectItem><SelectItem value="em_revisao">Em revisão</SelectItem><SelectItem value="publicado">Publicado</SelectItem><SelectItem value="arquivado">Arquivado</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Resumo</Label><Input value={resumo} onChange={e => setResumo(e.target.value)}/></div><div className="space-y-2 md:col-span-2"><Label>Conteúdo *</Label><Textarea rows={12} value={conteudo} onChange={e => setConteudo(e.target.value)}/></div></div>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div></CardContent></Card>}
  {selected && !open && <Card className="border-primary/50"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>{selected.titulo}</CardTitle><p className="text-sm text-muted-foreground">v{selected.versao} · {selected.status} · {selected.visualizacoes} visualizações</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => startEdit(selected)}><Pencil className="mr-2 h-4 w-4"/>Editar</Button><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-4 w-4"/></Button></div></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">{selected.resumo ?? ""}</p><div className="whitespace-pre-wrap text-sm">{selected.conteudo}</div></CardContent></Card>}
  <Card><CardHeader><CardTitle>Artigos</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : data?.length ? <div className="space-y-3">{data.map(a => <div key={a.id} className="flex items-center justify-between gap-4 rounded-lg border p-4"><div><div className="font-medium">{a.titulo}</div><div className="text-sm text-muted-foreground">{a.categoria ?? "Sem categoria"} · {a.status} · v{a.versao}</div></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(a)}><Eye className="mr-2 h-4 w-4"/>Ver</Button>{a.status !== "publicado" && <Button size="sm" onClick={() => publish(a)}>Publicar</Button>}</div></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum artigo encontrado.</p>}</CardContent></Card></div>;
}
