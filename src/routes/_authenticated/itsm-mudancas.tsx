import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Plus, X, Eye } from "lucide-react";

const LABELS: Record<string, string> = {
  normal: "Normal", emergencia: "Emergência", padrao: "Padrão",
  rascunho: "Rascunho", aguardando_aprovacao: "Aguardando aprovação", aprovado: "Aprovado",
  rejeitado: "Rejeitado", agendado: "Agendado", em_execucao: "Em execução", concluido: "Concluído", cancelado: "Cancelado",
  baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico",
};

export const Route = createFileRoute("/_authenticated/itsm-mudancas")({ component: ItsmMudancas });

function ItsmMudancas() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("normal");
  const [risco, setRisco] = useState("medio");
  const [impacto, setImpacto] = useState("medio");
  const [justificativa, setJustificativa] = useState("");
  const [planoExecucao, setPlanoExecucao] = useState("");
  const [planoRollback, setPlanoRollback] = useState("");
  const [janelaInicio, setJanelaInicio] = useState("");
  const [janelaFim, setJanelaFim] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["itsm-mudancas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("itsm_mudancas").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setTitulo(""); setDescricao(""); setTipo("normal"); setRisco("medio"); setImpacto("medio");
    setJustificativa(""); setPlanoExecucao(""); setPlanoRollback(""); setJanelaInicio(""); setJanelaFim(""); setFormError(null);
  };

  const criarMudanca = async () => {
    if (!titulo.trim()) { setFormError("Informe o título da mudança."); return; }
    if (!descricao.trim()) { setFormError("Informe a descrição da mudança."); return; }
    if (!justificativa.trim()) { setFormError("Informe a justificativa da mudança."); return; }
    if (!planoExecucao.trim()) { setFormError("Informe o plano de execução."); return; }
    if (!planoRollback.trim()) { setFormError("Informe o plano de rollback."); return; }
    setSaving(true); setFormError(null);
    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      titulo: titulo.trim(), descricao: descricao.trim(), tipo, risco, impacto,
      justificativa: justificativa.trim(), plano_execucao: planoExecucao.trim(), plano_rollback: planoRollback.trim(),
      janela_inicio: janelaInicio ? new Date(janelaInicio).toISOString() : null,
      janela_fim: janelaFim ? new Date(janelaFim).toISOString() : null,
      solicitante_id: userData.user?.id ?? null,
    };
    const { error } = await supabase.from("itsm_mudancas").insert(payload);
    setSaving(false);
    if (error) { setFormError(error.message); return; }
    resetForm(); setOpen(false); await queryClient.invalidateQueries({ queryKey: ["itsm-mudancas"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight">Mudanças</h1><p className="text-sm text-muted-foreground">Planejamento, aprovação e execução de mudanças no ambiente.</p></div>
        <Button onClick={() => { resetForm(); setSelected(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Nova mudança</Button>
      </div>

      {open ? <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>Nova mudança</CardTitle><Button variant="ghost" size="icon" onClick={() => { setOpen(false); resetForm(); }}><X className="h-4 w-4" /></Button></CardHeader>
        <CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label htmlFor="mudanca-titulo">Título *</Label><Input id="mudanca-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Descreva a mudança" /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="mudanca-descricao">Descrição *</Label><Textarea id="mudanca-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que será alterado e por quê" /></div>
          <div className="space-y-2"><Label>Tipo</Label><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="padrao">Padrão</SelectItem><SelectItem value="emergencia">Emergência</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Risco</Label><Select value={risco} onValueChange={setRisco}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixo">Baixo</SelectItem><SelectItem value="medio">Médio</SelectItem><SelectItem value="alto">Alto</SelectItem><SelectItem value="critico">Crítico</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Impacto</Label><Select value={impacto} onValueChange={setImpacto}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixo">Baixo</SelectItem><SelectItem value="medio">Médio</SelectItem><SelectItem value="alto">Alto</SelectItem><SelectItem value="critico">Crítico</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="mudanca-justificativa">Justificativa *</Label><Textarea id="mudanca-justificativa" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que a mudança é necessária" /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="mudanca-execucao">Plano de execução *</Label><Textarea id="mudanca-execucao" value={planoExecucao} onChange={(e) => setPlanoExecucao(e.target.value)} placeholder="Passos para executar a mudança" /></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="mudanca-rollback">Plano de rollback *</Label><Textarea id="mudanca-rollback" value={planoRollback} onChange={(e) => setPlanoRollback(e.target.value)} placeholder="Como reverter a mudança em caso de falha" /></div>
          <div className="space-y-2"><Label htmlFor="mudanca-inicio">Janela de início</Label><Input id="mudanca-inicio" type="datetime-local" value={janelaInicio} onChange={(e) => setJanelaInicio(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="mudanca-fim">Janela de fim</Label><Input id="mudanca-fim" type="datetime-local" value={janelaFim} onChange={(e) => setJanelaFim(e.target.value)} /></div>
        </div>{formError ? <p className="text-sm text-destructive">{formError}</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} disabled={saving}>Cancelar</Button><Button onClick={criarMudanca} disabled={saving}>{saving ? "Salvando..." : "Criar mudança"}</Button></div></CardContent></Card> : null}

      {selected ? <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle>{selected.titulo ?? `Mudança #${selected.numero ?? selected.id}`}</CardTitle><p className="text-sm text-muted-foreground">Mudança #{selected.numero ?? "-"}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Status" value={LABELS[selected.status] ?? selected.status} /><Detail label="Tipo" value={LABELS[selected.tipo] ?? selected.tipo} /><Detail label="Risco" value={LABELS[selected.risco] ?? selected.risco} /><Detail label="Impacto" value={LABELS[selected.impacto] ?? selected.impacto} /><Detail label="Solicitante" value={selected.solicitante_id} /><Detail label="Responsável" value={selected.responsavel_id} /><Detail label="Aprovador" value={selected.aprovador_id} /><Detail label="Aprovado em" value={formatDate(selected.aprovado_em)} /><Detail label="Executado em" value={formatDate(selected.executado_em)} /><Detail label="Criado em" value={formatDate(selected.criado_em)} /></div><Detail label="Descrição" value={selected.descricao} multiline /><Detail label="Justificativa" value={selected.justificativa} multiline /><Detail label="Plano de execução" value={selected.plano_execucao} multiline /><Detail label="Plano de rollback" value={selected.plano_rollback} multiline /></CardContent></Card> : null}

      {error ? <Card><CardContent className="pt-6 text-sm text-destructive">Não foi possível carregar as mudanças.</CardContent></Card> : null}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> Mudanças registradas</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : data?.length ? <div className="space-y-3">{data.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border p-4"><div className="min-w-0"><div className="font-medium truncate">{item.titulo ?? `Mudança #${item.numero ?? item.id}`}</div><div className="mt-1 text-sm text-muted-foreground">Status: {LABELS[item.status] ?? item.status ?? "-"} · Risco: {LABELS[item.risco] ?? item.risco ?? "-"} · Impacto: {LABELS[item.impacto] ?? item.impacto ?? "-"}</div></div><Button variant="outline" size="sm" onClick={() => setSelected(item)}><Eye className="mr-2 h-4 w-4" />Ver detalhes</Button></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma mudança registrada.</p>}</CardContent></Card>
    </div>
  );
}

function Detail({ label, value, multiline = false }: { label: string; value: unknown; multiline?: boolean }) { const text = value === null || value === undefined || value === "" ? "-" : String(value); return <div className={multiline ? "space-y-1 md:col-span-2" : "space-y-1"}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={multiline ? "whitespace-pre-wrap rounded-md border p-3 text-sm" : "text-sm"}>{text}</div></div>; }
function formatDate(value: unknown) { if (!value) return "-"; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR"); }
