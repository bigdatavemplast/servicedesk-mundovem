import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FolderTree } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  head: () => ({ meta: [{ title: "Categorias e SLAs | Mundo Vem Service Desk" }, { name: "description", content: "Configure categorias, subcategorias e prazos de SLA usados na classificação dos chamados." }, { property: "og:title", content: "Categorias e SLAs | Mundo Vem Service Desk" }, { property: "og:description", content: "Configure categorias, subcategorias e prazos de SLA usados na classificação dos chamados." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "twitter:title", content: "Categorias e SLAs | Mundo Vem Service Desk" }, { name: "twitter:description", content: "Configure categorias, subcategorias e prazos de SLA usados na classificação dos chamados." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (!(data ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminCategoriasPage,
});

function AdminCategoriasPage() {
  const qc = useQueryClient();
  const [nomeCat, setNomeCat] = useState("");
  const [descCat, setDescCat] = useState("");
  const [segmentoId, setSegmentoId] = useState("");
  const [novaSub, setNovaSub] = useState<Record<string, string>>({});

  const { data: segmentos = [] } = useQuery({ queryKey: ["admin-segmentos"], queryFn: async () => { const { data, error } = await supabase.from("segmentos").select("id, nome").eq("ativo", true).order("ordem").order("nome"); if (error) throw error; return data ?? []; } });
  const { data: categorias = [] } = useQuery({ queryKey: ["admin-categorias"], queryFn: async () => { const { data, error } = await supabase.from("categorias").select("*").order("ordem").order("nome"); if (error) throw error; return data ?? []; } });
  const { data: subcategorias = [] } = useQuery({ queryKey: ["admin-subcategorias"], queryFn: async () => { const { data, error } = await supabase.from("subcategorias").select("*").order("ordem").order("nome"); if (error) throw error; return data ?? []; } });

  const criarCat = useMutation({
    mutationFn: async () => {
      const nome = nomeCat.trim();
      const segmento = segmentos.find((s) => s.id === segmentoId);
      if (!nome) throw new Error("Informe o nome da categoria.");
      if (!segmento) throw new Error("Selecione o segmento da categoria.");
      const { error } = await supabase.from("categorias").insert({ nome, descricao: descCat.trim() || null, segmento: segmento.nome, segmento_id: segmento.id });
      if (error) throw error;
    },
    onSuccess: () => { setNomeCat(""); setDescCat(""); setSegmentoId(""); qc.invalidateQueries({ queryKey: ["admin-categorias"] }); toast.success("Categoria criada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleCat = useMutation({ mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => { const { error } = await supabase.from("categorias").update({ ativo }).eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categorias"] }), onError: (e: any) => toast.error(e.message) });
  const excluirCat = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("categorias").delete().eq("id", id); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-categorias"] }); qc.invalidateQueries({ queryKey: ["admin-subcategorias"] }); toast.success("Excluída"); }, onError: (e: any) => toast.error(e.message) });
  const criarSub = useMutation({ mutationFn: async (catId: string) => { const nome = (novaSub[catId] ?? "").trim(); if (!nome) return; const { error } = await supabase.from("subcategorias").insert({ categoria_id: catId, nome }); if (error) throw error; }, onSuccess: (_d, catId) => { setNovaSub((s) => ({ ...s, [catId]: "" })); qc.invalidateQueries({ queryKey: ["admin-subcategorias"] }); }, onError: (e: any) => toast.error(e.message) });
  const excluirSub = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("subcategorias").delete().eq("id", id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-subcategorias"] }), onError: (e: any) => toast.error(e.message) });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><FolderTree className="h-5 w-5 text-primary" /><div><h1 className="text-2xl font-bold">Categorias e Subcategorias</h1><p className="text-sm text-muted-foreground">O segmento é definido na categoria. Assim, um Projeto de TI continua sendo classificado como Projeto.</p></div></div>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Nova categoria</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1fr_1.5fr_180px_auto]"><Input placeholder="Nome" value={nomeCat} onChange={(e) => setNomeCat(e.target.value)} /><Input placeholder="Descrição (opcional)" value={descCat} onChange={(e) => setDescCat(e.target.value)} /><Select value={segmentoId} onValueChange={setSegmentoId}><SelectTrigger aria-label="Segmento da categoria"><SelectValue placeholder="Segmento *" /></SelectTrigger><SelectContent>{segmentos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select><Button disabled={!nomeCat.trim() || !segmentoId || criarCat.isPending} onClick={() => criarCat.mutate()}>{criarCat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar</Button></CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2">{categorias.map((c: any) => { const subs = subcategorias.filter((s: any) => s.categoria_id === c.id); return <Card key={c.id} className={c.ativo ? "" : "opacity-60"}><CardHeader className="flex flex-row items-start justify-between gap-2 pb-2"><div><CardTitle className="text-base">{c.nome}</CardTitle>{c.descricao && <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>}{c.segmento && <Badge variant="outline" className="mt-2">{c.segmento}</Badge>}</div><div className="flex items-center gap-2"><Badge variant={c.ativo ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleCat.mutate({ id: c.id, ativo: !c.ativo })}>{c.ativo ? "Ativa" : "Inativa"}</Badge><Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir categoria?")) excluirCat.mutate(c.id); }}><Trash2 className="h-4 w-4 text-red-500" /></Button></div></CardHeader><CardContent className="space-y-2"><div className="space-y-1">{subs.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma subcategoria.</p>}{subs.map((s: any) => <div key={s.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-sm"><span>{s.nome}</span><Button size="icon" variant="ghost" onClick={() => excluirSub.mutate(s.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button></div>)}</div><div className="flex gap-2"><Input placeholder="Nova subcategoria" className="h-8" value={novaSub[c.id] ?? ""} onChange={(e) => setNovaSub((s) => ({ ...s, [c.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") criarSub.mutate(c.id); }} /><Button size="sm" onClick={() => criarSub.mutate(c.id)}>+</Button></div></CardContent></Card> })}</div>
    </div>
  );
}
