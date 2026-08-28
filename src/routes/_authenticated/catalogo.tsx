import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ListChecks, Search } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/catalogo")({ component: CatalogoPage });

type CatalogoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  instrucoes: string | null;
  segmento_id: string;
  categoria_id: string;
  subcategoria_id: string | null;
  tipo_chamado_id: string;
  requer_aprovacao: boolean;
  ordem: number;
};

type CatalogoData = {
  itens: CatalogoItem[];
  segmentos: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[];
  subcategorias: { id: string; nome: string }[];
  tipos: { id: string; nome: string }[];
};

function CatalogoPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");

  const { data, isLoading, error } = useQuery<CatalogoData>({
    queryKey: ["catalogo-publico"],
    queryFn: async () => {
      const [itensResult, segmentosResult, categoriasResult, subcategoriasResult, tiposResult] = await Promise.all([
        supabase
          .from("itsm_itens_catalogo")
          .select("id,nome,descricao,instrucoes,segmento_id,categoria_id,subcategoria_id,tipo_chamado_id,requer_aprovacao,ordem")
          .eq("ativo", true)
          .eq("publicado", true)
          .order("ordem")
          .order("nome"),
        supabase.from("segmentos").select("id,nome").eq("ativo", true).order("ordem").order("nome"),
        supabase.from("categorias").select("id,nome").eq("ativo", true).order("ordem").order("nome"),
        supabase.from("subcategorias").select("id,nome").eq("ativo", true).order("ordem").order("nome"),
        supabase.from("tipos_chamado").select("id,nome").eq("ativo", true).order("ordem").order("nome"),
      ]);

      for (const result of [itensResult, segmentosResult, categoriasResult, subcategoriasResult, tiposResult]) {
        if (result.error) throw new Error(result.error.message);
      }

      return {
        itens: (itensResult.data ?? []) as CatalogoItem[],
        segmentos: segmentosResult.data ?? [],
        categorias: categoriasResult.data ?? [],
        subcategorias: subcategoriasResult.data ?? [],
        tipos: tiposResult.data ?? [],
      };
    },
  });

  const itens = useMemo(() => {
    if (!data) return [];
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return data.itens;
    return data.itens.filter((item) => `${item.nome} ${item.descricao ?? ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [data, busca]);

  function solicitar(item: CatalogoItem) {
    const segmento = data?.segmentos.find((x) => x.id === item.segmento_id);
    localStorage.setItem(
      "service_desk_catalogo_item",
      JSON.stringify({
        id: item.id,
        nome: item.nome,
        descricao: item.descricao ?? "",
        segmentoId: item.segmento_id,
        categoriaId: item.categoria_id,
        subcategoriaId: item.subcategoria_id,
        tipoChamadoId: item.tipo_chamado_id,
      }),
    );
    if (segmento) {
      localStorage.setItem("service_desk_segmento", JSON.stringify({ id: segmento.id, nome: segmento.nome }));
    }
    navigate({ to: "/chamados/novo" });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Catálogo</h1>
            <p className="text-sm text-muted-foreground">Serviços disponíveis para solicitação.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar serviço..."
          className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {isLoading && (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando serviços...
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Não foi possível carregar o catálogo.</CardContent>
        </Card>
      )}

      {!isLoading && !error && itens.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {data?.itens.length ? "Nenhum serviço encontrado para a busca informada." : "Nenhum serviço publicado está disponível no momento."}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && itens.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {itens.map((item) => {
            const segmento = data?.segmentos.find((x) => x.id === item.segmento_id)?.nome ?? "—";
            const categoria = data?.categorias.find((x) => x.id === item.categoria_id)?.nome ?? "—";
            const subcategoria = item.subcategoria_id ? data?.subcategorias.find((x) => x.id === item.subcategoria_id)?.nome : null;
            const tipo = data?.tipos.find((x) => x.id === item.tipo_chamado_id)?.nome ?? "—";

            return (
              <Card key={item.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{item.nome}</CardTitle>
                    {item.requer_aprovacao && <Badge variant="outline">Aprovação</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{segmento} · {categoria}{subcategoria ? ` · ${subcategoria}` : ""} · {tipo}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  {item.descricao && <p className="text-sm text-muted-foreground">{item.descricao}</p>}
                  <Button className="mt-auto w-full" onClick={() => solicitar(item)}>Solicitar</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
