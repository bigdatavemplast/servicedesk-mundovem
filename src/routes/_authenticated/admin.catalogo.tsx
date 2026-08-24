import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers3, ListChecks, FolderTree, Loader2 } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/admin/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo | Mundo Vem Service Desk" },
      { name: "description", content: "Visão operacional do catálogo de serviços do Service Desk." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id);

    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: CatalogoPage,
});

type Segmento = { id: string; nome: string; ativo: boolean; ordem: number | null };
type Categoria = { id: string; nome: string; descricao: string | null; segmento: string | null; segmento_id: string | null; ativo: boolean; ordem: number | null };
type Subcategoria = { id: string; nome: string; categoria_id: string; ativo?: boolean; ordem?: number | null };
type Tipo = { id: string; nome: string; descricao: string | null; ativo: boolean; ordem: number };

function CatalogoPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-catalogo"],
    queryFn: async () => {
      const [segmentosResult, categoriasResult, subcategoriasResult, tiposResult] = await Promise.all([
        supabase.from("segmentos").select("id,nome,ativo,ordem").order("ordem").order("nome"),
        supabase.from("categorias").select("id,nome,descricao,segmento,segmento_id,ativo,ordem").order("ordem").order("nome"),
        supabase.from("subcategorias").select("id,nome,categoria_id,ativo,ordem").order("ordem").order("nome"),
        supabase.from("tipos_chamado").select("id,nome,descricao,ativo,ordem").order("ordem").order("nome"),
      ]);

      for (const result of [segmentosResult, categoriasResult, subcategoriasResult, tiposResult]) {
        if (result.error) throw result.error;
      }

      return {
        segmentos: (segmentosResult.data ?? []) as Segmento[],
        categorias: (categoriasResult.data ?? []) as Categoria[],
        subcategorias: (subcategoriasResult.data ?? []) as Subcategoria[],
        tipos: (tiposResult.data ?? []) as Tipo[],
      };
    },
  });

  if (isLoading) {
    return <div className="flex min-h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando catálogo...</div>;
  }

  if (error || !data) {
    return <div className="rounded-lg border p-6 text-sm text-destructive">Não foi possível carregar o catálogo.</div>;
  }

  const activeSegmentos = data.segmentos.filter((s) => s.ativo);
  const activeCategorias = data.categorias.filter((c) => c.ativo);
  const activeSubcategorias = data.subcategorias.filter((s) => s.ativo !== false);
  const activeTipos = data.tipos.filter((t) => t.ativo);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <ListChecks className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Catálogo</h1>
            <p className="text-sm text-muted-foreground">
              Visão operacional da estrutura usada para orientar a abertura e o tratamento dos chamados.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Layers3} label="Segmentos ativos" value={activeSegmentos.length} />
        <SummaryCard icon={FolderTree} label="Categorias ativas" value={activeCategorias.length} />
        <SummaryCard icon={FolderTree} label="Subcategorias ativas" value={activeSubcategorias.length} />
        <SummaryCard icon={ListChecks} label="Tipos ativos" value={activeTipos.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estrutura do catálogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSegmentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum segmento ativo cadastrado.</p>
          ) : (
            activeSegmentos.map((segmento) => {
              const categorias = activeCategorias.filter(
                (categoria) => categoria.segmento_id === segmento.id || categoria.segmento === segmento.nome,
              );

              return (
                <div key={segmento.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-primary" />
                      <h2 className="font-semibold">{segmento.nome}</h2>
                    </div>
                    <Badge variant="outline">{categorias.length} categoria(s)</Badge>
                  </div>

                  {categorias.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma categoria ativa vinculada a este segmento.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {categorias.map((categoria) => {
                        const subs = activeSubcategorias.filter((sub) => sub.categoria_id === categoria.id);
                        return (
                          <div key={categoria.id} className="rounded-md bg-muted/30 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-medium">{categoria.nome}</div>
                                {categoria.descricao && <div className="mt-1 text-xs text-muted-foreground">{categoria.descricao}</div>}
                              </div>
                              <Badge variant="secondary">{subs.length}</Badge>
                            </div>
                            {subs.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {subs.map((sub) => <Badge key={sub.id} variant="outline">{sub.nome}</Badge>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de chamado</CardTitle>
        </CardHeader>
        <CardContent>
          {activeTipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum tipo ativo cadastrado.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {activeTipos.map((tipo) => (
                <div key={tipo.id} className="rounded-md border p-3">
                  <div className="font-medium">{tipo.nome}</div>
                  {tipo.descricao && <div className="mt-1 text-xs text-muted-foreground">{tipo.descricao}</div>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Layers3; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <Icon className="h-7 w-7 text-primary" />
      </CardContent>
    </Card>
  );
}
