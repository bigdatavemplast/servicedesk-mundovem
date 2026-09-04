import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_VEM, LOGO_VEM_ALT } from "@/assets/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Recuperar senha | Mundo Vem Service Desk" }, { name: "description", content: "Receba um link por e-mail para recuperar o acesso ao Service Desk da Mundo Vem." }, { property: "og:title", content: "Recuperar senha | Mundo Vem Service Desk" }, { property: "og:description", content: "Receba um link por e-mail para recuperar o acesso ao Service Desk da Mundo Vem." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, follow" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    // The recovery link must return to the Service Desk itself, never to Lovable.
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível solicitar a recuperação da senha. Tente novamente.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center">
          <img src={LOGO_VEM} alt={LOGO_VEM_ALT} className="h-12 w-auto shrink-0 object-contain sm:h-14" width={108} height={56} />
          <h1 className="text-xl font-bold tracking-tight">Recuperar acesso</h1>
          <p className="text-sm text-muted-foreground">Vemplast Support Hub</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{sent ? "Verifique seu e-mail" : "Esqueci minha senha"}</CardTitle>
            <CardDescription>{sent ? "Se o endereço estiver cadastrado, enviaremos um link para redefinir sua senha." : "Informe seu e-mail corporativo para receber um link de recuperação."}</CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-5">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Solicitação enviada</p>
                      <p className="text-muted-foreground">Verifique sua caixa de entrada e também a pasta de spam ou lixo eletrônico.</p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full"><Link to="/auth">Voltar para o login</Link></Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">E-mail corporativo</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" placeholder="seu.email@vemplast.com.br" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar link de recuperação</Button>
                <Button asChild type="button" variant="ghost" className="w-full"><Link to="/auth"><ArrowLeft className="mr-2 h-4 w-4" />Voltar para o login</Link></Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
