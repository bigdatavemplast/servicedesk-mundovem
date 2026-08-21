import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, Layers3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, type Role } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/segmentos")({
  head: () => ({ meta: [{ title: "Segmentos | Mundo Vem Service Desk" }, { name: "description", content: "Gerencie os segmentos do Service Desk." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) throw redirect({ to: "/dashboard" });
  },
  component: SegmentosPage,
});

type Segmento = { id: string; nome: string; descricao: string | null; ativo: boolean };

function SegmentosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Segmento | null>(null);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: segmentos = [], isLoading } = useQuery({
    queryKey: ["admin-segmentos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("segmentos").select("id,nome,descricao,ativo").order("nome");
      if (error) throw error;
      return (data ?? []) as Segmento[];
    },
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-segmentos-grupos-count"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("grupos_atendimento").select("id,segmento_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome do segmento.");
      if (editing) {
        const { error } = await (supabase as any).from("segmentos").update({ nome: nome.trim(), descricao: descricao.trim() || null }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("segmentos").insert({ nome: nome.trim(), descricao: descricao.trim() || null, ativo: true });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Segmento atualizado" : "Segmento criado"); close(); qc.invalidateQueries({ queryKey: ["admin-segmentos"] }); qc.invalidateQueries({ queryKey: ["admin-segmentos-grupos-count"] }); qc.invalidateQueries({ queryKey: ["admin-segmentos-grupos"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar o segmento"),
  });

  const toggle = useMutation({
    mutationFn: async (s: Segmento) => {
      const { error } = await (supabase as any).from("segmentos").update({ ativo: !s.ativo }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-segmentos"] }); qc.invalidateQueries({ queryKey: ["admin-segmentos-grupos"] }); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível alterar o segmento"),
  });

  function create() { setEditing(null); setNome(""); setDescricao(""); setOpen(true); }
  function edit(s: Segmento) { setEditing(s); setNome(s.nome); setDescricao(s.descricao ?? ""); setOpen(true); }
  function close() { setOpen(false); setEditing(null); }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">Segmentos</h1><p className="text-sm text-muted-foreground">Defina as áreas responsáveis pelo atendimento.</p></div></div><Button onClick={create}><Plus className="mr-2 h-4 w-4" />Novo segmento</Button></div>
    <Card><CardHeader><CardTitle className="text-base">Segmentos cadastrados</CardTitle></CardHeader><CardContent>{isLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{segmentos.map((s) => { const count = groups.filter((g: any) => g.segmento_id === s.id).length; return <Card key={s.id} className={!s.ativo ? "opacity-60" : ""}><CardHeader className="pb-3"><div className="flex items-start justify-between gap-2"><CardTitle className="text-base">{s.nome}</CardTitle><Badge variant={s.ativo ? "default" : "secondary"}>{s.ativo ? "Ativo" : "Inativo"}</Badge></div></CardHeader><CardContent className="space-y-3">{s.descricao && <p className="text-sm text-muted-foreground">{s.descricao}</p>}<div className="text-sm text-muted-foreground">Grupos de atendimento: <span className="font-semibold text-foreground">{count}</span></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => edit(s)}><Pencil className="mr-2 h-4 w-4" />Editar</Button><Button variant="ghost" size="icon" title={s.ativo ? "Desativar" : "Ativar"} onClick={() => toggle.mutate(s)}><Power className="h-4 w-4" /></Button></div></CardContent></Card>; })}</div>}</CardContent></Card>
    <Dialog open={open} onOpenChange={(v) => !v && close()}><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar segmento" : "Novo segmento"}</DialogTitle><DialogDescription>Segmentos organizam a responsabilidade do atendimento.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: TI" /></div><div className="space-y-1"><Label>Descrição (opcional)</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Área responsável" /></div></div><DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
