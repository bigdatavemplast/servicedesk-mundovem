import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ListChecks, Search, AlertCircle, X } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo de serviços | Mundo Vem Service Desk" }, { name: "description", content: "Consulte o catálogo de serviços da Mundo Vem e abra chamados a partir dos itens disponíveis por área." }, { property: "og:title", content: "Catálogo de serviços | Mundo Vem Service Desk" }, { property: "og:description", content: "Consulte o catálogo de serviços da Mundo Vem e abra chamados a partir dos itens disponíveis por área." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, follow" }] }), component: CatalogoPage });

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

function removerPrefixoExemplo(texto: string | null | undefined) {
  return (texto ?? "").replace(/^\s*(?:exemplo|ex)\s*:?\s*/i, "").trim();
}

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
        nome: removerPrefixoExemplo(item.nome),
        descricao: removerPrefixoExemplo(item.descricao),
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

      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar serviço..."
          aria-label="Buscar serviços por nome ou descrição"
          className={`border-border bg-white shadow-none placeholder:text-muted-foreground transition-colors hover:border-border hover:bg-white focus-visible:border-border focus-visible:bg-white focus-visible:ring-0 pl-9 pr-9 dark:bg-white ${busca.trim() ? "border-border bg-white focus-visible:ring-0" : ""}`}
        />
        {busca && <button type="button" aria-label="Limpar busca" onClick={() => setBusca("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>

      {isLoading && (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Carregando serviços...
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center"><AlertCircle className="h-6 w-6 text-destructive" /><p className="font-medium">Não foi possível carregar o catálogo.</p><p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente em instantes.</p></CardContent>
        </Card>
      )}

      {!isLoading && !error && itens.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center"><Search className="h-6 w-6 text-muted-foreground" /><p className="font-medium text-foreground">{data?.itens.length ? "Nenhum serviço encontrado" : "Nenhum serviço disponível"}</p><p className="max-w-md text-sm text-muted-foreground">{data?.itens.length ? "Tente buscar por outro termo ou confira a digitação." : "Nenhum serviço publicado está disponível no momento."}</p>{busca && (data?.itens.length ?? 0) > 0 && <Button variant="outline" size="sm" className="border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground" onClick={() => setBusca("")}>Limpar busca</Button>}</CardContent>
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
                    <CardTitle className="text-base">{removerPrefixoExemplo(item.nome)}</CardTitle>
                    {item.requer_aprovacao && <Badge variant="outline">Aprovação</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{segmento} · {categoria}{subcategoria ? ` · ${subcategoria}` : ""} · {tipo}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  {removerPrefixoExemplo(item.descricao) && <p className="text-sm text-muted-foreground">{removerPrefixoExemplo(item.descricao)}</p>}
                  <Button className="mt-auto w-full border border-[#9C1917] bg-[#9C1917] text-white shadow-none hover:border-[#841512] hover:bg-[#841512] hover:text-white dark:border-[#C9302C] dark:bg-[#C9302C] dark:text-white dark:hover:border-[#A82420] dark:hover:bg-[#A82420]" onClick={() => solicitar(item)}>Solicitar</Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
