import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AnexoDropzone } from "@/components/anexos/AnexoDropzone";
import { enviarAnexo } from "@/lib/anexos";
import { criarChamado } from "@/lib/chamado.functions";


export const Route = createFileRoute("/_authenticated/chamados/novo")({
  head: () => ({
    meta: [
      { title: "Abrir novo chamado | Mundo Vem Service Desk" },
      { name: "description", content: "Registre um novo chamado escolhendo categoria, subcategoria e prioridade para atendimento pelo Service Desk." },
      { property: "og:title", content: "Abrir novo chamado | Mundo Vem Service Desk" },
      { property: "og:description", content: "Registre um novo chamado escolhendo categoria, subcategoria e prioridade para atendimento pelo Service Desk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Abrir novo chamado | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Registre um novo chamado escolhendo categoria, subcategoria e prioridade para atendimento pelo Service Desk." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: NovoChamadoPage,
});

function NovoChamadoPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"baixa"|"media"|"alta"|"critica">("media");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [subcategoriaId, setSubcategoriaId] = useState<string>("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const criar = useServerFn(criarChamado);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("id, nome").eq("ativo", true).order("ordem");
      return data ?? [];
    },
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ["subcategorias", categoriaId],
    queryFn: async () => {
      if (!categoriaId) return [];
      const { data } = await supabase
        .from("subcategorias")
        .select("id, nome")
        .eq("categoria_id", categoriaId)
        .eq("ativo", true)
        .order("ordem");
      return data ?? [];
    },
    enabled: !!categoriaId,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    let criado: any;
    try {
      criado = await criar({
        data: {
          titulo,
          descricao,
          prioridade,
          categoriaId: categoriaId || null,
          subcategoriaId: subcategoriaId || null,
        },
      });
    } catch (error) {
      setLoading(false);
      return toast.error(error instanceof Error ? error.message : "Falha ao criar chamado");
    }

    let falhas = 0;
    for (const file of anexos) {
      try {
        await enviarAnexo({
          chamadoId: criado.id,
          autorId: user.id,
          file,
          onProgress: (pct) => setProgresso((p) => ({ ...p, [file.name]: pct })),
        });
      } catch (err) {
        falhas += 1;
        toast.error(err instanceof Error ? err.message : `Falha ao anexar ${file.name}`);
      }
    }

    setLoading(false);
    if (falhas === 0) toast.success("Chamado criado com sucesso!");
    else toast.warning("Chamado criado, mas alguns anexos falharam.");
    navigate({ to: "/chamados" });
  }


  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Novo chamado</h1>
        <p className="text-sm text-muted-foreground">Descreva o problema ou solicitação com o máximo de detalhes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Detalhes do chamado</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="titulo">Título</Label>
              <Input id="titulo" required maxLength={250} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Notebook não liga" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={(v) => { setCategoriaId(v); setSubcategoriaId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subcategoria</Label>
                <Select value={subcategoriaId} onValueChange={setSubcategoriaId} disabled={!categoriaId}>
                  <SelectTrigger><SelectValue placeholder={categoriaId ? "Selecione" : "Escolha categoria"} /></SelectTrigger>
                  <SelectContent>
                    {subcategorias.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea id="descricao" required rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o ocorrido, passos executados, mensagens de erro, etc." />
            </div>

            <div className="space-y-2">
              <Label>Anexos (opcional)</Label>
              <AnexoDropzone
                onArquivos={(novos) => setAnexos((atual) => [...atual, ...novos])}
                pendentes={anexos}
                progresso={progresso}
                onRemover={(i) => setAnexos((atual) => atual.filter((_, idx) => idx !== i))}
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/chamados" })}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Abrir chamado
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
