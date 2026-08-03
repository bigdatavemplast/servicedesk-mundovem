import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, Loader2 } from "lucide-react";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Parâmetro authorization_id ausente.");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Não foi possível carregar a autorização</CardTitle>
          <CardDescription>{String((error as Error)?.message ?? error)}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "aplicativo externo";

  async function decidir(aprovar: boolean) {
    setBusy(true);
    setErro(null);
    const api = oauthApi();
    const { data, error } = aprovar
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setErro(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setErro("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <Ticket className="h-5 w-5" />
          </div>
          <span className="text-lg">Mundo Vem — Service Desk</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Conectar {clientName} à sua conta</CardTitle>
            <CardDescription>
              Ao aprovar, {clientName} poderá consultar e abrir chamados, comentar e pesquisar a base de
              conhecimento em seu nome — sempre respeitando as suas permissões no portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {erro && (
              <p role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            )}
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy} onClick={() => decidir(true)}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aprovar
              </Button>
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decidir(false)}>
                Recusar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
