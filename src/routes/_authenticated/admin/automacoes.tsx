import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, Trash2, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { hasPermission, type Role } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/automacoes")({
  head: () => ({ meta: [{ title: "Automações | Mundo Vem Service Desk" }, { name: "description", content: "Configure automações operacionais do Service Desk." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role as Role);
    if (!roles.some((role) => hasPermission(role, "service_desk.manage"))) throw redirect({ to: "/dashboard" });
  },
  component: AutomacoesPage,
});

type Automation = { id: string; nome: string; descricao: string | null; evento: string; condicoes: Record<string, unknown>; acao: string; parametros_acao: Record<string, unknown>; ordem: number; ativo: boolean };

const EVENTS = [
  ["chamado_criado", "Chamado criado"],
  ["sem_atendente", "Chamado sem atendente"],
  ["sla_proximo_vencimento", "SLA próximo do vencimento"],
  ["sla_vencido", "SLA vencido"],
  ["chamado_resolvido", "Chamado resolvido"],
  ["resposta_solicitante", "Solicitante respondeu"],
  ["atendente_inativo", "Atendente inativo"],
  ["mudanca_prioridade", "Prioridade alterada"],
];
const ACTIONS = [
  ["reabrir", "Reabrir chamado"],
  ["fechar", "Fechar chamado"],
  ["escalonar", "Escalonar"],
  ["redistribuir", "Redistribuir"],
  ["alterar_status", "Alterar status"],
  ["alterar_prioridade", "Alterar prioridade"],
];

function AutomacoesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [evento, setEvento] = useState("");
  const [condicoes, setCondicoes] = useState("{}");
  const [acao, setAcao] = useState("");
  const [parametros, setParametros] = useState("{}");
  const [ordem, setOrdem] = useState("100");

  const { data: rules = [], isLoading } = useQuery({ queryKey: ["automacoes-service-desk"], queryFn: async () => { const { data, error } = await (supabase as any).from("automacoes_service_desk").select("*").order("ordem").order("nome"); if (error) throw error; return (data ?? []) as Automation[]; } });

  const save = useMutation({ mutationFn: async () => {
    if (!nome.trim()) throw new Error("Informe o nome da automação.");
    if (!evento) throw new Error("Selecione o evento.");
    if (!acao) throw new Error("Selecione a ação.");
    let parsedCond: Record<string, unknown>; let parsedParams: Record<string, unknown>;
    try { parsedCond = JSON.parse(condicoes || "{}"); } catch { throw new Error("Condições precisam ser um JSON válido."); }
    try { parsedParams = JSON.parse(parametros || "{}"); } catch { throw new Error("Parâmetros da ação precisam ser um JSON válido."); }
    const payload = { nome: nome.trim(), descricao: descricao.trim() || null, evento, condicoes: parsedCond, acao, parametros_acao: parsedParams, ordem: Math.max(0, Number(ordem) || 0) };
    const result = editing ? await (supabase as any).from("automacoes_service_desk").update(payload).eq("id", editing.id) : await (supabase as any).from("automacoes_service_desk").insert(payload);
    if (result.error) throw result.error;
  }, onSuccess: () => { toast.success(editing ? "Automação atualizada" : "Automação criada"); close(); qc.invalidateQueries({ queryKey: ["automacoes-service-desk"] }); }, onError: (e: any) => toast.error(e.message ?? "Não foi possível salvar a automação") });

  const toggle = useMutation({ mutationFn: async (r: Automation) => { const { error } = await (supabase as any).from("automacoes_service_desk").update({ ativo: !r.ativo }).eq("id", r.id); if (error) throw error; }, onSuccess: () => qc.invalidateQueries({ queryKey: ["automacoes-service-desk"] }), onError: (e: any) => toast.error(e.message) });
  const remove = useMutation({ mutationFn: async (r: Automation) => { const { error } = await (supabase as any).from("automacoes_service_desk").delete().eq("id", r.id); if (error) throw error; }, onSuccess: () => { toast.success("Automação excluída"); qc.invalidateQueries({ queryKey: ["automacoes-service-desk"] }); }, onError: (e: any) => toast.error(e.message) });

  function close() { setOpen(false); setEditing(null); setNome(""); setDescricao(""); setEvento(""); setCondicoes("{}"); setAcao(""); setParametros("{}"); setOrdem("100"); }
  function create() { close(); setOpen(true); }
  function edit(r: Automation) { setEditing(r); setNome(r.nome); setDescricao(r.descricao ?? ""); setEvento(r.evento); setCondicoes(JSON.stringify(r.condicoes ?? {}, null, 2)); setAcao(r.acao); setParametros(JSON.stringify(r.parametros_acao ?? {}, null, 2)); setOrdem(String(r.ordem)); setOpen(true); }
  const eventLabel = (v: string) => EVENTS.find(([id]) => id === v)?.[1] ?? v;
  const actionLabel = (v: string) => ACTIONS.find(([id]) => id === v)?.[1] ?? v;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary"><Workflow className="h-5 w-5" /></div><div><h1 className="text-2xl font-bold">Automações</h1><p className="text-sm text-muted-foreground">Configure regras no formato evento → condições → ação.</p></div></div><Button onClick={create}><Plus className="mr-2 h-4 w-4" />Nova automação</Button></div>
    <Card><CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">As automações ficam separadas de SLA, escalonamento, atribuição e notificações. Nesta etapa, nenhuma regra é criada automaticamente: você define o evento, as condições e a ação.</CardContent></Card>
    <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/40 text-left"><tr><th className="p-3">Automação</th><th className="p-3">Evento</th><th className="p-3">Ação</th><th className="p-3">Ordem</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Carregando…</td></tr> : rules.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma automação cadastrada.</td></tr> : rules.map((r) => <tr key={r.id} className="border-b last:border-0"><td className="p-3"><div className="font-medium">{r.nome}</div>{r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}</td><td className="p-3">{eventLabel(r.evento)}</td><td className="p-3">{actionLabel(r.acao)}</td><td className="p-3">{r.ordem}</td><td className="p-3"><Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge></td><td className="p-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Editar" onClick={() => edit(r)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title={r.ativo ? "Desativar" : "Ativar"} onClick={() => toggle.mutate(r)}><Power className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Excluir" onClick={() => { if (confirm(`Excluir a automação \"${r.nome}\"?`)) remove.mutate(r); }}><Trash2 className="h-4 w-4 text-red-500" /></Button></div></td></tr>)}</tbody></table></div></CardContent></Card>
    <Dialog open={open} onOpenChange={(v) => !v && close()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Editar automação" : "Nova automação"}</DialogTitle><DialogDescription>Configure a regra sem alterar ainda o processamento automático dos chamados.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1 md:col-span-2"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Escalar chamados TI sem atendimento" /></div>
      <div className="space-y-1 md:col-span-2"><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Explique o objetivo da regra." /></div>
      <div className="space-y-1"><Label>Evento *</Label><Select value={evento} onValueChange={setEvento}><SelectTrigger><SelectValue placeholder="Selecione o evento" /></SelectTrigger><SelectContent>{EVENTS.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1"><Label>Ação *</Label><Select value={acao} onValueChange={setAcao}><SelectTrigger><SelectValue placeholder="Selecione a ação" /></SelectTrigger><SelectContent>{ACTIONS.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1 md:col-span-2"><Label>Condições (JSON)</Label><Textarea className="min-h-32 font-mono text-xs" value={condicoes} onChange={(e) => setCondicoes(e.target.value)} /><p className="text-xs text-muted-foreground">Ex.: {`{"grupo":"TI","minutos_sem_atendente":30}`}</p></div>
      <div className="space-y-1 md:col-span-2"><Label>Parâmetros da ação (JSON)</Label><Textarea className="min-h-24 font-mono text-xs" value={parametros} onChange={(e) => setParametros(e.target.value)} /><p className="text-xs text-muted-foreground">Ex.: {`{"nivel":2}`}</p></div>
      <div className="space-y-1"><Label>Ordem</Label><Input type="number" min={0} value={ordem} onChange={(e) => setOrdem(e.target.value)} /><p className="text-xs text-muted-foreground">Menor número = executa primeiro.</p></div>
    </div><DialogFooter><Button variant="outline" onClick={close}>Cancelar</Button><Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Salvando…" : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
