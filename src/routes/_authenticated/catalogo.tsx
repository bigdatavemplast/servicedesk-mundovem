import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/catalogo")({ component: CatalogoPage });

function CatalogoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <p className="text-sm text-muted-foreground">Serviços disponíveis para solicitação.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Catálogo de serviços</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">A rota do catálogo está disponível.</p></CardContent>
      </Card>
    </div>
  );
}
