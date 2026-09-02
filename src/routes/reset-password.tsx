import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_VEM, LOGO_VEM_ALT } from "@/assets/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Mundo Vem Service Desk" },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [ready, setReady] = useState(false);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkRecoverySession = async () => {
      // Supabase restores the recovery session from the link before this page
      // is rendered. We only allow the password update when that session exists.
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setReady(true);
        setCheckingSession(false);
        return;
      }

      // Give the auth client a moment to process the recovery callback.
      await new Promise((resolve) => setTimeout(resolve, 500));
      const retry = await supabase.auth.getSession();
      if (!mounted) return;

      setReady(Boolean(retry.data.session));
      setCheckingSession(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
      if (event === "SIGNED_OUT") setReady(false);
    });

    checkRecoverySession();

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmation) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
      return;
    }

    setUpdated(true);
    toast.success("Senha alterada com sucesso!");
  }

  async function handleGoToLogin() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center">
          <img
            src={LOGO_VEM}
            alt={LOGO_VEM_ALT}
            className="h-12 w-auto shrink-0 object-contain sm:h-14"
            width={108}
            height={56}
          />
          <h1 className="text-xl font-bold tracking-tight">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">Mundo Vem Service Desk</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{updated ? "Senha alterada" : "Crie uma nova senha"}</CardTitle>
            <CardDescription>
              {updated
                ? "Sua senha foi atualizada. Agora você pode acessar o portal normalmente."
                : "Informe e confirme sua nova senha para recuperar o acesso."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checkingSession ? (
              <div className="flex min-h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : updated ? (
              <div className="space-y-5">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Senha atualizada com sucesso</p>
                      <p className="text-muted-foreground">
                        Faça login usando sua nova senha.
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={handleGoToLogin}>
                  Ir para o login
                </Button>
              </div>
            ) : !ready ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Link inválido ou expirado</p>
                      <p className="text-muted-foreground">
                        Solicite novamente a recuperação de senha para receber um novo link.
                      </p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full">
                  <Link to="/forgot-password">Solicitar novo link</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Alterar senha
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
