import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/documentacao")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (!(data ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  }, component: DocumentacaoPage,
});

const CATEGORIAS = ["Atualização", "Visão geral", "Operação", "SLA", "Classificação", "ITSM", "Segurança", "Técnico"];
const vazio = { categoria: "Atualização", titulo: "", conteudo: "", versao: "", ordem: "0" };

type EditingState = { id?: string | null } | null;

function DocumentacaoPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EditingState>(null);
  const [form, setForm] = useState(vazio);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documentacao-sistema"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentacao_sistema")
        .select("*")
        .eq("ativo", true)
        .order("ordem")
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim() || !form.conteudo.trim()) {
        throw new Error("Informe título e conteúdo.");
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        throw new Error("Usuário autenticado não identificado.");
      }

      const payload = {
        categoria: form.categoria,
        titulo: form.titulo.trim(),
        conteudo: form.conteudo.trim(),
        versao: form.versao.trim() || null,
        ordem: Number(form.ordem) || 0,
        ativo: true,
      };

      if (editing?.id) {
        const { error } = await supabase
          .from("documentacao_sistema")
          .update(payload)
          .eq("id", editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("documentacao_sistema")
          .insert({
            ...payload,
            criado_por: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Documentação salva");
      setEditing(null);
      setForm(vazio);
      qc.invalidateQueries({ queryKey: ["documentacao-sistema"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar"),
  });

  const remove = async (id: string) => {
    if (!id) {
      toast.error("Registro de documentação inválido.");
      return;
    }
    if (!confirm("Excluir este registro da documentação?")) return;
    const { error } = await supabase.from("documentacao_sistema").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Registro excluído");
      qc.invalidateQueries({ queryKey: ["documentacao-sistema"] });
    }
  };

  const startNew = () => {
    setForm(vazio);
    setEditing({ id: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEdit = (d: any) => {
    if (!d?.id) {
      toast.error("Não foi possível editar: documentação sem ID.");
      return;
    }
    setEditing({ id: d.id });
    setForm({
      categoria: d.categoria ?? "Atualização",
      titulo: d.titulo ?? "",
      conteudo: d.conteudo ?? "",
      versao: d.versao ?? "",
      ordem: String(d.ordem ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Documentação do Service Desk</h1>
            <p className="text-sm text-muted-foreground">
              Registro vivo das atualizações, funcionamento atual e informações técnicas do sistema.
            </p>
          </div>
        </div>
        <Button type="button" onClick={startNew}>
          <Plus className="mr-2 h-4 w-4" />Nova documentação
        </Button>
      </div>

      {editing !== null && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing.id ? "Editar documentação" : "Nova documentação"}</CardTitle>
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)}>
              <X />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Versão / fase</Label>
                <Input value={form.versao} onChange={(e) => setForm((f) => ({ ...f, versao: e.target.value }))} placeholder="Ex.: MVP / Fase 3" />
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea className="min-h-[240px]" value={form.conteudo} onChange={(e) => setForm((f) => ({ ...f, conteudo: e.target.value }))} placeholder="Descreva o funcionamento, regra, atualização ou detalhe técnico..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                <Save className="mr-2 h-4 w-4" />{save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando documentação...</p>
      ) : (
        <div className="space-y-4">
          {docs.map((d: any) => (
            <Card key={d.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <div className="mb-1 flex gap-2 text-xs text-muted-foreground">
                    <span>{d.categoria}</span>{d.versao && <span>· {d.versao}</span>}
                  </div>
                  <CardTitle className="text-lg">{d.titulo}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(d)}><Pencil /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{d.conteudo}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
