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
      { title: "Redefinir senha — Vemplast Support Hub" },
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

    const initializeRecovery = async () => {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        // Support the PKCE recovery format when Supabase returns ?code=...
        // directly to the Service Desk route.
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error("[Recovery] exchangeCodeForSession:", error);
          else if (mounted) setReady(true);
        }

        // Support the implicit recovery format when Supabase returns
        // #access_token=...&refresh_token=...&type=recovery.
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) console.error("[Recovery] setSession:", error);
          else if (mounted) setReady(true);
        }

        // Support recovery links that use token_hash + type=recovery.
        const tokenHash = params.get("token_hash");
        const tokenType = params.get("type");
        if (tokenHash && tokenType === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) console.error("[Recovery] verifyOtp:", error);
          else if (mounted) setReady(true);
        }

        // Give supabase-js a moment to persist the session created from the
        // recovery URL before checking it.
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session) setReady(true);
        setCheckingSession(false);

        // One short retry handles asynchronous browser storage persistence.
        if (!data.session) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (!mounted) return;
          const retry = await supabase.auth.getSession();
          if (retry.data.session) setReady(true);
        }

        // Never leave recovery parameters/tokens in the address bar.
        if (window.location.search || window.location.hash) {
          window.history.replaceState({}, document.title, "/reset-password");
        }
      } catch (error) {
        console.error("[Recovery] initialization error:", error);
        if (mounted) {
          setReady(false);
          setCheckingSession(false);
        }
      }
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" && session) setReady(true);
      if (event === "SIGNED_IN" && session) setReady(true);
      if (event === "SIGNED_OUT") setReady(false);
    });

    initializeRecovery();

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirmation) return toast.error("As senhas não coincidem.");

    setLoading(true);

    // Always refresh the current session before updateUser. This prevents the
    // recovery screen from attempting to update a stale/anonymous session.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      toast.error("O link de recuperação é inválido ou expirou. Solicite um novo link.");
      setReady(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      console.error("[Recovery] updateUser:", error);
      toast.error(error.message || "Não foi possível alterar a senha.");
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
          <img src={LOGO_VEM} alt={LOGO_VEM_ALT} className="h-12 w-auto shrink-0 object-contain sm:h-14" width={108} height={56} />
          <h1 className="text-xl font-bold tracking-tight">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">Vemplast Support Hub</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{updated ? "Senha alterada" : "Crie uma nova senha"}</CardTitle>
            <CardDescription>
              {updated
                ? "Sua senha foi atualizada. Agora você pode acessar o Service Desk normalmente."
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
                      <p className="text-muted-foreground">Faça login usando sua nova senha.</p>
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={handleGoToLogin}>Ir para o login</Button>
              </div>
            ) : !ready ? (
              <div className="space-y-5">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex gap-3">
                    <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">Link inválido ou expirado</p>
                      <p className="text-muted-foreground">Solicite novamente a recuperação de senha para receber um novo link.</p>
                    </div>
                  </div>
                </div>
                <Button asChild className="w-full"><Link to="/forgot-password">Solicitar novo link</Link></Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <Input id="new-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
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
