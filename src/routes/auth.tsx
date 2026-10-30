import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_VEM, LOGO_VEM_ALT } from "@/assets/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function safeNext(next: unknown): string | null { if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return null; return next; }
const TITULO = "Acesso ao portal — Mundo Vem Service Desk";
const DESCRICAO = "Entre com seu e-mail corporativo Mundo Vem para abrir e acompanhar chamados de TI e das demais áreas atendidas.";
const URL_PAGINA = "https://servicedesk-mundovem.lovable.app/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: TITULO }, { name: "description", content: DESCRICAO }, { property: "og:title", content: TITULO }, { property: "og:description", content: DESCRICAO }, { property: "og:type", content: "website" }, { property: "og:url", content: URL_PAGINA }, { name: "twitter:card", content: "summary" }, { name: "twitter:title", content: TITULO }, { name: "twitter:description", content: DESCRICAO }, { name: "robots", content: "noindex, follow" }], links: [{ rel: "canonical", href: URL_PAGINA }] }),
  validateSearch: (s: Record<string, unknown>): { next?: string; recovery?: string } => ({ next: safeNext(s.next) ?? undefined, recovery: s.recovery === "1" ? "1" : undefined }),
  beforeLoad: async ({ search }) => {
    // During password recovery Supabase establishes a temporary session on this
    // public route. Do not redirect that session to /areas; the login screen
    // becomes the password-change screen instead.
    if (search.recovery === "1") return;
    const { data } = await supabase.auth.getUser();
    if (data.user?.app_metadata?.must_change_password === true) return;
    if (data.user) {
      const next = safeNext(search.next);
      if (next && next !== "/dashboard") throw redirect({ href: next });
      throw redirect({ to: "/areas" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next, recovery } = Route.useSearch();
  const nextPath = safeNext(next) && next !== "/dashboard" ? safeNext(next) : null;
  const [loading, setLoading] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryChecking, setRecoveryChecking] = useState(recovery === "1");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updated, setUpdated] = useState(false);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted && data.user?.app_metadata?.must_change_password === true) {
        setForcePasswordChange(true);
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (recovery !== "1") return;
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) setRecoveryReady(true);
      else await new Promise(resolve => setTimeout(resolve, 700));
      if (!mounted) return;
      const retry = await supabase.auth.getSession();
      if (retry.data.session) setRecoveryReady(true);
      setRecoveryChecking(false);
    };
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) setRecoveryReady(true);
    });
    check();
    return () => { mounted = false; subscription.subscription.unsubscribe(); };
  }, [recovery]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    if (error) { setLoading(false); return toast.error(error.message); }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("ativo")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();

    if (profileError || !profile?.ativo) {
      await supabase.auth.signOut();
      setLoading(false);
      return toast.error("Seu usuário está inativo. Procure o administrador do sistema.");
    }

    if (signInData.user?.app_metadata?.must_change_password === true) {
      setForcePasswordChange(true);
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
      toast.info("Por segurança, defina sua senha pessoal para continuar.");
      return;
    }

    setLoading(false);
    toast.success("Bem-vindo!");
    if (nextPath) { window.location.href = nextPath; return; }
    navigate({ to: "/areas", replace: true });
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error("A senha deve ter pelo menos 8 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem.");
    setLoading(true);
    if (forcePasswordChange) {
      const { data, error } = await supabase.functions.invoke("admin-user-auth", {
        body: { action: "change_password", senha: newPassword },
      });
      if (error || data?.error) {
        setLoading(false);
        return toast.error(data?.error ?? "Não foi possível alterar a senha. Tente novamente.");
      }
      const { error: refreshError } = await supabase.auth.refreshSession();
      setLoading(false);
      if (refreshError) {
        await supabase.auth.signOut();
        return toast.error("Senha alterada. Entre novamente com sua nova senha.");
      }
      setForcePasswordChange(false);
      toast.success("Senha pessoal definida com sucesso!");
      navigate({ to: "/areas", replace: true });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
    setUpdated(true);
    toast.success("Senha alterada com sucesso!");
  }

  const recoveryView = recovery === "1";
  const passwordChangeView = recoveryView || forcePasswordChange;

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center font-semibold">
          <div className="flex items-center gap-2"><img src={LOGO_VEM} alt={LOGO_VEM_ALT} className="h-12 w-auto shrink-0 object-contain sm:h-14" width={108} height={56} /></div>
          <h1 className="text-xl font-bold tracking-tight">Acesso ao portal de chamados</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{passwordChangeView ? (updated ? "Senha alterada" : forcePasswordChange ? "Defina sua senha pessoal" : "Redefinir senha") : "Acesso ao portal"}</CardTitle>
            <CardDescription>{forcePasswordChange ? "O administrador definiu uma senha provisória. Crie sua senha pessoal para continuar." : recoveryView ? (updated ? "Sua senha foi atualizada. Agora você pode acessar o portal normalmente." : "Informe sua nova senha para recuperar o acesso ao portal.") : "Entre com seu e-mail corporativo."}</CardDescription>
          </CardHeader>
          <CardContent>
            {passwordChangeView ? (
              recoveryView && recoveryChecking ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              : recoveryView && !recoveryReady ? <div className="space-y-4"><p className="text-sm text-muted-foreground">O link de recuperação é inválido ou expirou.</p><Button asChild className="w-full"><Link to="/forgot-password">Solicitar novo link</Link></Button></div>
              : recoveryView && updated ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Faça login usando sua nova senha.</p><Button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }} className="w-full">Ir para o login</Button></div>
              : <form className="space-y-4 pt-2" onSubmit={handlePasswordUpdate}>
                  <div className="space-y-2"><Label htmlFor="recovery-new-password">Nova senha pessoal</Label><Input id="recovery-new-password" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
                  <div className="space-y-2"><Label htmlFor="recovery-confirm-password">Confirmar nova senha</Label><Input id="recovery-confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
                  <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Alterar senha e continuar</Button>
                </form>
            ) : (
              <form className="space-y-4 pt-2" onSubmit={handleLogin}>
                <div className="space-y-2"><Label htmlFor="login-email">E-mail</Label><Input id="login-email" type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="login-pass">Senha</Label><Input id="login-pass" type="password" required value={loginPass} onChange={e => setLoginPass(e.target.value)} /></div>
                <Button type="submit" className="w-full bg-[#9C1917] text-white hover:bg-[#821513] hover:text-white" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
