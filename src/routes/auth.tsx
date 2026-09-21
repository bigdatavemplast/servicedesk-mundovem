import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_VEM, LOGO_VEM_ALT } from "@/assets/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [nome, setNome] = useState("");
  const [depto, setDepto] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

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

    let error: { message?: string } | null = null;
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      try {
        const resposta = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPass });
        error = resposta.error;
        if (!error) break;
      } catch (erro) {
        error = erro instanceof Error ? erro : { message: "Falha de comunicação com o servidor de autenticação." };
      }

      if (tentativa < 2) {
        await new Promise(resolve => setTimeout(resolve, 700 * (tentativa + 1)));
      }
    }

    setLoading(false);
    if (error) {
      const mensagem = error.message || "";
      if (mensagem.toLowerCase().includes("failed to fetch") || mensagem.toLowerCase().includes("network")) {
        return toast.error("Não foi possível conectar ao servidor de login. Tente novamente em alguns segundos.");
      }
      return toast.error(mensagem);
    }

    toast.success("Bem-vindo!");
    if (nextPath) { window.location.href = nextPath; return; }
    navigate({ to: "/areas", replace: true });
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
    setUpdated(true);
    toast.success("Senha alterada com sucesso!");
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    const { error } = await supabase.auth.signUp({ email: regEmail, password: regPass, options: { emailRedirectTo: window.location.origin + "/areas", data: { nome, departamento: depto } } });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail se necessário.");
  }

  const recoveryView = recovery === "1";

  return <div className="grid min-h-screen place-items-center bg-muted/30 px-4"><div className="w-full max-w-md"><div className="mb-6 flex flex-col items-center justify-center gap-2 text-center font-semibold"><div className="flex items-center gap-2"><img src={LOGO_VEM} alt={LOGO_VEM_ALT} className="h-12 w-auto shrink-0 object-contain sm:h-14" width={108} height={56} /></div><h1 className="text-xl font-bold tracking-tight">Acesso ao portal de chamados</h1></div><Card><CardHeader><CardTitle>{recoveryView ? (updated ? "Senha alterada" : "Redefinir senha") : "Acesso ao portal"}</CardTitle><CardDescription>{recoveryView ? (updated ? "Sua senha foi atualizada. Agora você pode acessar o portal normalmente." : "Informe sua nova senha para recuperar o acesso ao portal.") : "Entre com seu e-mail corporativo."}</CardDescription></CardHeader><CardContent>{recoveryView ? (recoveryChecking ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : !recoveryReady ? <div className="space-y-4"><p className="text-sm text-muted-foreground">O link de recuperação é inválido ou expirou.</p><Button asChild className="w-full"><Link to="/forgot-password">Solicitar novo link</Link></Button></div> : updated ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Faça login usando sua nova senha.</p><Button onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }} className="w-full">Ir para o login</Button></div> : <form className="space-y-4 pt-2" onSubmit={handlePasswordUpdate}><div className="space-y-2"><Label htmlFor="recovery-new-password">Nova senha</Label><Input id="recovery-new-password" type="password" required minLength={6} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="recovery-confirm-password">Confirmar nova senha</Label><Input id="recovery-confirm-password" type="password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div><Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Alterar senha</Button></form>) : <Tabs defaultValue="login"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="login">Entrar</TabsTrigger><TabsTrigger value="register">Criar conta</TabsTrigger></TabsList><TabsContent value="login"><form className="space-y-4 pt-4" onSubmit={handleLogin}><div className="space-y-2"><Label htmlFor="login-email">E-mail</Label><Input id="login-email" type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="login-pass">Senha</Label><Input id="login-pass" type="password" required value={loginPass} onChange={e => setLoginPass(e.target.value)} /></div><Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar</Button><div className="pt-1 text-center"><Link to="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Esqueci minha senha</Link></div></form></TabsContent><TabsContent value="register"><form className="space-y-4 pt-4" onSubmit={handleSignup}><div className="space-y-2"><Label htmlFor="reg-nome">Nome completo</Label><Input id="reg-nome" required value={nome} onChange={e => setNome(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="reg-depto">Departamento</Label><Input id="reg-depto" value={depto} onChange={e => setDepto(e.target.value)} placeholder="Ex.: Comercial" /></div><div className="space-y-2"><Label htmlFor="reg-email">E-mail corporativo</Label><Input id="reg-email" type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="reg-pass">Senha</Label><Input id="reg-pass" type="password" required minLength={6} value={regPass} onChange={e => setRegPass(e.target.value)} /></div><Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar conta</Button></form></TabsContent></Tabs>}</CardContent></Card></div></div>;
}
