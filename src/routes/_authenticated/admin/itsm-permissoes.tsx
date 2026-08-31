import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/itsm-permissoes")({
  component: ItsmPermissoesPage,
});

function ItsmPermissoesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Permissões do ITSM Avançado</h1>
          <p className="text-sm text-muted-foreground">
            Libere o acesso ao ITSM por usuário, módulo e ação.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permissões ITSM</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A página foi carregada corretamente. A configuração de permissões será disponibilizada após a validação do carregamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
