import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-problemas")({ component: ItsmProblemas });

function ItsmProblemas() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["itsm-problemas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("itsm_problemas").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Problemas</h1>
        <p className="text-sm text-muted-foreground">Gestão de problemas, causas raiz e soluções permanentes.</p>
      </div>
      {error ? <Card><CardContent className="pt-6 text-sm text-destructive">Não foi possível carregar os problemas.</CardContent></Card> : null}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Problemas registrados</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : data?.length ? <div className="space-y-3">{data.map((item: any) => <div key={item.id} className="rounded-lg border p-4"><div className="font-medium">{item.titulo ?? `Problema #${item.numero ?? item.id}`}</div><div className="mt-1 text-sm text-muted-foreground">Status: {item.status ?? "-"} · Prioridade: {item.prioridade ?? "-"}</div></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum problema registrado.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
