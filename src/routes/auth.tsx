import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";

function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

const TITULO = "Acesso ao portal — Mundo Vem Service Desk";
const DESCRICAO =
  "Entre com seu e-mail corporativo Mundo Vem para abrir e acompanhar chamados de TI e das demais áreas atendidas.";
const URL_PAGINA = "https://servicedesk-mundovem.lovable.app/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESCRICAO },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESCRICAO },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL_PAGINA },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITULO },
      { name: "twitter:description", content: DESCRICAO },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [{ rel: "canonical", href: URL_PAGINA }],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: safeNext(s.next) ?? undefined,
  }),

  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const next = safeNext(search.next);
      if (next) throw redirect({ href: next });
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [nome, setNome] = useState("");
  const [depto, setDepto] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo!");
    if (nextPath) {
      window.location.href = nextPath;
      return;
    }
    navigate({ to: "/dashboard" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPass,
      options: {
        emailRedirectTo: nextPath ? window.location.origin + nextPath : window.location.origin,
        data: { nome, departamento: depto },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu e-mail se necessário.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center justify-center gap-2 text-center font-semibold">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Ticket className="h-5 w-5" />
            </div>
            <span className="text-lg">Mundo Vem — Service Desk</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Acesso ao portal de chamados</h1>
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Acesso ao portal</CardTitle>
            <CardDescription>Entre com seu e-mail corporativo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form className="space-y-4 pt-4" onSubmit={handleLogin}>
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-mail</Label>
                    <Input id="login-email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-pass">Senha</Label>
                    <Input id="login-pass" type="password" required value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form className="space-y-4 pt-4" onSubmit={handleSignup}>
                  <div className="space-y-2">
                    <Label htmlFor="reg-nome">Nome completo</Label>
                    <Input id="reg-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-depto">Departamento</Label>
                    <Input id="reg-depto" value={depto} onChange={(e) => setDepto(e.target.value)} placeholder="Ex.: Comercial" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">E-mail corporativo</Label>
                    <Input id="reg-email" type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">Senha</Label>
                    <Input id="reg-pass" type="password" required minLength={6} value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
