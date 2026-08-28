import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/itsm-permissoes")({
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    if (!(data ?? []).some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: ItsmPermissoesPage,
});

const MODULOS = [["problemas", "Problemas"], ["mudancas", "Mudanças"], ["ativos", "Ativos / CMDB"], ["relacionamentos", "Relacionamentos"], ["servicos", "Serviços"], ["catalogo", "Catálogo"], ["conhecimento", "Gestão de Conhecimento"], ["auditoria", "Auditoria"], ["governanca", "Governança"]] as const;
const ACOES = ["visualizar", "criar", "editar", "excluir"] as const;
type Perm = Record<(typeof ACOES)[number], boolean>;

function ItsmPermissoesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = React.useState("");
  const [draft, setDraft] = React.useState<Record<string, Perm>>({});

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["itsm-permission-users"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,nome,email,departamento,ativo").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: permissions = [], isLoading: loadingPermissions } = useQuery({
    queryKey: ["itsm-permissions", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("itsm_permissoes_usuario").select("modulo,visualizar,criar,editar,excluir").eq("user_id", selected);
      if (error) throw error;
      return data ?? [];
    },
  });

  React.useEffect(() => {
    const next: Record<string, Perm> = {};
    for (const [key] of MODULOS) next[key] = { visualizar: false, criar: false, editar: false, excluir: false };
    permissions.forEach((p: any) => {
      if (next[p.modulo]) next[p.modulo] = { visualizar: !!p.visualizar, criar: !!p.criar, editar: !!p.editar, excluir: !!p.excluir };
    });
    setDraft(next);
  }, [permissions]);

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      for (const [modulo] of MODULOS) {
        const p = draft[modulo] ?? { visualizar: false, criar: false, editar: false, excluir: false };
        const { error } = await supabase.from("itsm_permissoes_usuario").upsert({ user_id: selected, modulo, ...p }, { onConflict: "user_id,modulo" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Permissões ITSM salvas");
      qc.invalidateQueries({ queryKey: ["itsm-permissions", selected] });
      qc.invalidateQueries({ queryKey: ["my-itsm-permissions"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar as permissões"),
  });

  const user = users.find((u: any) => u.id === selected);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /><div><h1 className="text-2xl font-bold">Permissões do ITSM Avançado</h1><p className="text-sm text-muted-foreground">Libere o acesso ao ITSM por usuário, módulo e ação.</p></div></div>
      <Card><CardHeader><CardTitle className="text-base">1. Selecione o usuário</CardTitle></CardHeader><CardContent>
        {loadingUsers ? <span className="text-sm text-muted-foreground">Carregando…</span> : <Select value={selected} onValueChange={setSelected}><SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Selecione um usuário" /></SelectTrigger><SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome || u.email}</SelectItem>)}</SelectContent></Select>}
      </CardContent></Card>
      {selected && <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">2. Acessos de {user?.nome ?? user?.email}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Visualizar controla o acesso ao módulo. As demais ações controlam o que o usuário pode fazer dentro dele.</p></div><Button onClick={() => save.mutate()} disabled={save.isPending || loadingPermissions}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar permissões</Button></CardHeader><CardContent>
        {loadingPermissions ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando permissões…</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="py-3 pr-4">Módulo</th>{ACOES.map(a => <th key={a} className="px-3 py-3 text-center">{a}</th>)}</tr></thead><tbody>{MODULOS.map(([key, label]) => <tr key={key} className="border-b last:border-0"><td className="py-3 pr-4 font-medium">{label}</td>{ACOES.map(acao => <td key={acao} className="px-3 py-3 text-center"><Switch checked={!!draft[key]?.[acao]} onCheckedChange={v => setDraft(d => ({ ...d, [key]: { ...(d[key] ?? { visualizar: false, criar: false, editar: false, excluir: false }), [acao]: v } }))} /></td>)}</tr>)}</tbody></table></div>}
      </CardContent></Card>}
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">Admin</Badge> Administradores continuam com acesso total ao ITSM.</div>
    </div>
  );
}
