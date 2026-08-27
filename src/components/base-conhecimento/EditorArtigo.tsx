import { useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function EditorArtigo({ id }: { id?: string }) {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("__none__");
  const [publicado, setPublicado] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-bc"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("id,nome").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  const { data: artigo } = useQuery({
    queryKey: ["bc-artigo-edit", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("base_conhecimento").select("*").eq("id", id!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (artigo) {
      setTitulo(artigo.titulo);
      setConteudo(artigo.conteudo);
      setCategoriaId(artigo.categoria_id ?? "__none__");
      setPublicado(artigo.publicado ?? true);
    }
  }, [artigo]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
   const payload: any = {
  titulo: titulo.trim(),
  conteudo: conteudo.trim(),
  categoria_id:
    categoriaId && categoriaId !== "__none__"
      ? categoriaId
      : null,
  publicado,
  slug: titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60),
};
    let res;
    if (id) {
      res = await supabase.from("base_conhecimento").update(payload).eq("id", id);
    } else {
      payload.autor_id = userRes.user?.id;
      res = await supabase.from("base_conhecimento").insert(payload);
    }
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(id ? "Artigo atualizado" : "Artigo criado");
    navigate({ to: "/base-conhecimento" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{id ? "Editar artigo" : "Novo artigo"}</h1>
        <p className="text-sm text-muted-foreground">Publique procedimentos e soluções.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Conteúdo</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={salvar}>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Geral</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={publicado} onChange={(e) => setPublicado(e.target.checked)} />
                  Publicado
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conteúdo</Label>
              <Textarea required rows={14} value={conteudo} onChange={(e) => setConteudo(e.target.value)}
                placeholder="Escreva o passo-a-passo, procedimento ou solução…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/base-conhecimento" })}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
