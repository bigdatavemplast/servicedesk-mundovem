import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Loader2, Pencil, Trash2, KeyRound, UserPlus } from "lucide-react";
import { criarUsuario, atualizarUsuario, excluirUsuario, definirPapel } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Gestão de usuários | Mundo Vem Service Desk" },
      { name: "description", content: "Crie, edite e desative contas de colaboradores e defina papéis de acesso no Service Desk da Mundo Vem." },
      { property: "og:title", content: "Gestão de usuários | Mundo Vem Service Desk" },
      { property: "og:description", content: "Crie, edite e desative contas de colaboradores e defina papéis de acesso no Service Desk da Mundo Vem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Gestão de usuários | Mundo Vem Service Desk" },
      { name: "twitter:description", content: "Crie, edite e desative contas de colaboradores e defina papéis de acesso no Service Desk da Mundo Vem." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (!(data ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminUsuariosPage,
});

const ROLES = [
  { v: "colaborador", l: "Colaborador (Abre chamados)" },
  { v: "atendente", l: "Atendente (Resolve chamados)" },
  { v: "gestor", l: "Gestor (Supervisiona equipe)" },
  { v: "admin", l: "Administrador (Acesso total)" },
] as const;

const ROLE_LABEL: Record<string, string> = {
  colaborador: "COLABORADOR", atendente: "ATENDENTE", gestor: "GESTOR", admin: "ADMIN",
};
const ROLE_BADGE: Record<string, string> = {
  admin: "bg-amber-100 text-amber-800 border-amber-200",
  gestor: "bg-blue-100 text-blue-800 border-blue-200",
  atendente: "bg-slate-200 text-slate-800 border-slate-300",
  colaborador: "bg-slate-100 text-slate-700 border-slate-200",
};

function AdminUsuariosPage() {
  const qc = useQueryClient();
  const criar = useServerFn(criarUsuario);
  const atualizar = useServerFn(atualizarUsuario);
  const excluir = useServerFn(excluirUsuario);
  const setRole = useServerFn(definirPapel);

  const [busca, setBusca] = useState("");

  // form: novo usuário
  const [fNome, setFNome] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fSenha, setFSenha] = useState("");
  const [fDep, setFDep] = useState("");
  const [fAreaId, setFAreaId] = useState("");
  const [fRole, setFRole] = useState<(typeof ROLES)[number]["v"]>("colaborador");

  // editar
  const [editing, setEditing] = useState<any | null>(null);
  const [eNome, setENome] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eDep, setEDep] = useState("");
  const [eAreaId, setEAreaId] = useState("");
  const [eRole, setERole] = useState<string>("colaborador");
  const [eSenha, setESenha] = useState("");

  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: areas = [] } = useQuery({
    queryKey: ["admin-areas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("areas").select("id,nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,nome,email,departamento,area_id,ativo").order("nome"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const byUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role);
        byUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
    },
  });

  const criarMut = useMutation({
    mutationFn: async () =>
      criar({
        data: {
          nome: fNome.trim(),
          email: fEmail.trim(),
          senha: fSenha,
          departamento: fDep.trim() || null,
          areaId: fAreaId || null,
          role: fRole,
        },
      }),
    onSuccess: () => {
      toast.success("Usuário cadastrado");
      setFNome(""); setFEmail(""); setFSenha(""); setFDep(""); setFAreaId(""); setFRole("colaborador");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar"),
  });

  const salvarMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      // Update profile + optional password/email
      await atualizar({
        data: {
          id: editing.id,
          nome: eNome.trim(),
          email: eEmail.trim(),
          departamento: eDep.trim() || null,
          senha: eSenha ? eSenha : undefined,
        },
      });
      // Ajustar papel principal: se mudou, remover antigos e definir novo
      const currentPrimary = editing.roles[0];
      if (currentPrimary !== eRole) {
        for (const r of editing.roles) {
          await setRole({ data: { userId: editing.id, role: r as any, add: false } });
        }
        await setRole({ data: { userId: editing.id, role: eRole as any, add: true } });
      }
    },
    onSuccess: () => {
      toast.success("Usuário atualizado");
      setEditing(null); setESenha("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const ativarMut = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) =>
      atualizar({ data: { id, ativo } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const excluirMut = useMutation({
    mutationFn: async (id: string) => excluir({ data: { id } }),
    onSuccess: () => {
      toast.success("Usuário excluído");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const filtered = users.filter((u: any) => {
    const q = busca.toLowerCase();
    return !q || u.nome?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.departamento?.toLowerCase().includes(q);
  });

  function openEdit(u: any) {
    setEditing(u);
    setENome(u.nome ?? "");
    setEEmail(u.email ?? "");
    setEDep(u.departamento ?? "");
    setEAreaId(u.area_id ?? "");
    setERole(u.roles[0] ?? "colaborador");
    setESenha("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-sm text-muted-foreground">Cadastre novos funcionários e configure os níveis de acesso ao Service Desk.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" /> Novo Usuário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Nome Completo</Label>
              <Input placeholder="Ex: João Silva" value={fNome} onChange={(e) => setFNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>E-mail Corporativo</Label>
              <Input type="email" placeholder="joao@empresa.com" value={fEmail} onChange={(e) => setFEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Senha de Acesso</Label>
              <Input type="password" placeholder="••••••••" value={fSenha} onChange={(e) => setFSenha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nível de Permissão (Papel)</Label>
              <Select value={fRole} onValueChange={(v) => setFRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Departamento</Label>
              <Input placeholder="Ex: RH, Financeiro, TI" value={fDep} onChange={(e) => setFDep(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Área</Label>
              <Select value={fAreaId || "__none__"} onValueChange={(v) => setFAreaId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem área</SelectItem>
                  {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!fNome.trim() || !fEmail.trim() || fSenha.length < 6 || criarMut.isPending}
              onClick={() => criarMut.mutate()}
            >
              {criarMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cadastrar Usuário
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Usuários Ativos ({filtered.length})</CardTitle>
            <Input
              placeholder="Buscar por nome, e-mail ou departamento…"
              className="max-w-xs"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Nome</th>
                      <th className="px-4 py-2">E-mail</th>
                      <th className="px-4 py-2">Área</th>
                      <th className="px-4 py-2">Departamento</th>
                      <th className="px-4 py-2">Nível</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map((u: any) => {
                      const primary = u.roles[0] ?? "colaborador";
                      return (
                        <tr key={u.id} className={u.ativo ? "" : "opacity-60"}>
                          <td className="px-4 py-2 font-medium">{u.nome ?? "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-2">{areas.find((a: any) => a.id === u.area_id)?.nome ?? "Sem área"}</td>
                          <td className="px-4 py-2">{u.departamento ?? "—"}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold ${ROLE_BADGE[primary]}`}>
                              {ROLE_LABEL[primary]}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant={u.ativo ? "default" : "secondary"}>{u.ativo ? "Ativo" : "Inativo"}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(u)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={u.ativo ? "outline" : "secondary"}
                                onClick={() => ativarMut.mutate({ id: u.id, ativo: !u.ativo })}
                              >
                                {u.ativo ? "Inativar" : "Ativar"}
                              </Button>
                              <Button size="icon" variant="ghost" title="Excluir" onClick={() => setDeleting(u)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editar */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize dados, papel e senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome</Label><Input value={eNome} onChange={(e) => setENome(e.target.value)} /></div>
            <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={eEmail} onChange={(e) => setEEmail(e.target.value)} /></div>
            <div className="space-y-1"><Label>Departamento</Label><Input value={eDep} onChange={(e) => setEDep(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Área</Label>
              <Select value={eAreaId || "__none__"} onValueChange={(v) => setEAreaId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem área</SelectItem>
                  {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={eRole} onValueChange={setERole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> Nova senha (opcional)</Label>
              <Input type="password" placeholder="Deixe em branco para manter" value={eSenha} onChange={(e) => setESenha(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={salvarMut.isPending} onClick={() => salvarMut.mutate()}>
              {salvarMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá <strong>{deleting?.nome ?? deleting?.email}</strong> permanentemente, incluindo o acesso ao sistema. Chamados existentes serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); if (deleting) excluirMut.mutate(deleting.id); }}
            >
              {excluirMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
