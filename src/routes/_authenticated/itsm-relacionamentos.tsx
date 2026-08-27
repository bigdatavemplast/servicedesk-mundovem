import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Plus, X, Trash2, ArrowRight, Loader2 } from "lucide-react";

const TIPOS = [
  ["chamado", "Chamado / Incidente"], ["servico", "Serviço"], ["ativo", "Ativo"], ["problema", "Problema"],
  ["mudanca", "Mudança"], ["artigo", "Artigo"], ["politica", "Política"],
] as const;
const RELACOES = [
  ["causado_por", "Causado por"], ["origina", "Origina"], ["impacta", "Impacta"], ["resolve", "Resolve"],
  ["depende_de", "Depende de"], ["suporta", "Suporta"], ["hospeda", "Hospeda"], ["conecta_com", "Conecta com"],
  ["substitui", "Substitui"], ["relacionado_a", "Relacionado a"],
] as const;

type Registro = { id: string; nome: string; tipo: string; detalhe?: string };
type Relacionamento = { id: string; origem_tipo: string; origem_id: string; relacao: string; destino_tipo: string; destino_id: string; criado_em: string };

export const Route = createFileRoute("/_authenticated/itsm-relacionamentos")({ component: ItsmRelacionamentos });

function ItsmRelacionamentos() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [origemTipo, setOrigemTipo] = useState("servico");
  const [origemId, setOrigemId] = useState("");
  const [relacao, setRelacao] = useState("depende_de");
  const [destinoTipo, setDestinoTipo] = useState("ativo");
  const [destinoId, setDestinoId] = useState("");
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: relacionamentos, isLoading, error } = useQuery({ queryKey: ["itsm-relacionamentos"], queryFn: async () => {
    const { data, error } = await supabase.from("itsm_relacionamentos").select("*").order("criado_em", { ascending: false });
    if (error) throw error; return (data ?? []) as Relacionamento[];
  }});
  const { data: ativos } = useQuery({ queryKey: ["itsm-ativos-relacionamentos"], queryFn: async () => { const { data, error } = await supabase.from("itsm_ativos").select("id,nome,codigo_patrimonio,tipo").order("nome"); if (error) throw error; return data ?? []; }});
  const { data: servicos } = useQuery({ queryKey: ["itsm-servicos-relacionamentos"], queryFn: async () => { const { data, error } = await supabase.from("itsm_servicos").select("id,nome,descricao,status").order("nome"); if (error) throw error; return data ?? []; }});
  const { data: problemas } = useQuery({ queryKey: ["itsm-problemas-relacionamentos"], queryFn: async () => { const { data, error } = await supabase.from("itsm_problemas").select("id,titulo,numero").order("criado_em", { ascending: false }); if (error) throw error; return data ?? []; }});
  const { data: mudancas } = useQuery({ queryKey: ["itsm-mudancas-relacionamentos"], queryFn: async () => { const { data, error } = await supabase.from("itsm_mudancas").select("id,titulo,numero").order("criado_em", { ascending: false }); if (error) throw error; return data ?? []; }});
  const { data: chamados } = useQuery({ queryKey: ["itsm-chamados-relacionamentos"], queryFn: async () => { const { data, error } = await supabase.from("chamados").select("id,numero,titulo,status").order("aberto_em", { ascending: false }).limit(200); if (error) throw error; return data ?? []; }});

  const registros = (tipo: string): Registro[] => {
    if (tipo === "chamado") return (chamados ?? []).map((x: any) => ({ id: x.id, nome: x.titulo ?? `Chamado #${x.numero ?? x.id}`, tipo, detalhe: x.numero ? `#${x.numero} · ${x.status ?? ""}` : x.status }));
    if (tipo === "servico") return (servicos ?? []).map((x: any) => ({ id: x.id, nome: x.nome, tipo, detalhe: x.status ?? "" }));
    if (tipo === "ativo") return (ativos ?? []).map((x: any) => ({ id: x.id, nome: x.nome, tipo, detalhe: x.codigo_patrimonio ?? x.tipo }));
    if (tipo === "problema") return (problemas ?? []).map((x: any) => ({ id: x.id, nome: x.titulo, tipo, detalhe: x.numero ? `#${x.numero}` : undefined }));
    if (tipo === "mudanca") return (mudancas ?? []).map((x: any) => ({ id: x.id, nome: x.titulo, tipo, detalhe: x.numero ? `#${x.numero}` : undefined }));
    return [];
  };
  const nomeRegistro = (tipo: string, id: string) => registros(tipo).find((x) => x.id === id)?.nome ?? `${labelTipo(tipo)} · ${id.slice(0, 8)}`;
  const labelTipo = (tipo: string) => TIPOS.find(([v]) => v === tipo)?.[1] ?? tipo;
  const labelRelacao = (r: string) => RELACOES.find(([v]) => v === r)?.[1] ?? r;

  const criar = async () => {
    setErrorMessage(null);
    if (!origemId || !destinoId) return setErrorMessage("Selecione a origem e o destino do relacionamento.");
    if (origemTipo === destinoTipo && origemId === destinoId) return setErrorMessage("Origem e destino não podem ser o mesmo registro.");
    setSaving(true); const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from("itsm_relacionamentos").insert({ origem_tipo: origemTipo, origem_id: origemId, relacao, destino_tipo: destinoTipo, destino_id: destinoId, criado_por: user.user?.id ?? null });
    setSaving(false); if (error) return setErrorMessage(error.code === "23505" ? "Este relacionamento já está cadastrado." : error.message);
    setOrigemId(""); setDestinoId(""); setOpen(false); await qc.invalidateQueries({ queryKey: ["itsm-relacionamentos"] });
  };
  const excluir = async (id: string) => { if (!window.confirm("Excluir este relacionamento?")) return; const { error } = await supabase.from("itsm_relacionamentos").delete().eq("id", id); if (error) return setErrorMessage(error.message); await qc.invalidateQueries({ queryKey: ["itsm-relacionamentos"] }); };
  const origemOptions = registros(origemTipo); const destinoOptions = registros(destinoTipo);
  const filtered = (relacionamentos ?? []).filter((r) => `${nomeRegistro(r.origem_tipo, r.origem_id)} ${nomeRegistro(r.destino_tipo, r.destino_id)} ${labelRelacao(r.relacao)}`.toLowerCase().includes(busca.toLowerCase()));

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Network className="h-6 w-6 text-primary" /><h1 className="text-2xl font-semibold tracking-tight">Relacionamentos ITSM</h1></div><p className="mt-1 text-sm text-muted-foreground">Conecte chamados/incidentes, problemas, mudanças, ativos e serviços para manter rastreabilidade operacional.</p></div><Button onClick={() => { setErrorMessage(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo relacionamento</Button></div>
    {open && <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Novo relacionamento</CardTitle><Button variant="ghost" size="icon" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
      <div className="space-y-2"><Label>Origem</Label><Select value={origemTipo} onValueChange={(v) => { setOrigemTipo(v); setOrigemId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2 lg:col-span-2"><Label>Registro de origem</Label><Select value={origemId} onValueChange={setOrigemId}><SelectTrigger><SelectValue placeholder={origemOptions.length ? "Selecione" : "Nenhum disponível"} /></SelectTrigger><SelectContent>{origemOptions.map(x => <SelectItem key={x.id} value={x.id}>{x.nome}{x.detalhe ? ` · ${x.detalhe}` : ""}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Relação</Label><Select value={relacao} onValueChange={setRelacao}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RELACOES.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label>Destino</Label><Select value={destinoTipo} onValueChange={(v) => { setDestinoTipo(v); setDestinoId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2 lg:col-span-2"><Label>Registro de destino</Label><Select value={destinoId} onValueChange={setDestinoId}><SelectTrigger><SelectValue placeholder={destinoOptions.length ? "Selecione" : "Nenhum disponível"} /></SelectTrigger><SelectContent>{destinoOptions.map(x => <SelectItem key={x.id} value={x.id}>{x.nome}{x.detalhe ? ` · ${x.detalhe}` : ""}</SelectItem>)}</SelectContent></Select></div>
    </div>{errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={criar} disabled={saving}>{saving ? "Salvando..." : "Criar relacionamento"}</Button></div></CardContent></Card>}
    <Card><CardContent className="pt-6"><Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por chamado, problema, mudança, ativo, serviço ou relação..." /></CardContent></Card>
    {error && <Card><CardContent className="pt-6 text-sm text-destructive">Não foi possível carregar os relacionamentos.</CardContent></Card>}
    <Card><CardHeader><CardTitle>Relacionamentos registrados</CardTitle></CardHeader><CardContent>{isLoading ? <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</div> : filtered.length ? <div className="space-y-3">{filtered.map(r => <div key={r.id} className="flex items-center justify-between gap-4 rounded-lg border p-4"><div className="flex min-w-0 items-center gap-3"><div className="min-w-0"><div className="text-xs text-muted-foreground">{labelTipo(r.origem_tipo)}</div><div className="font-medium truncate">{nomeRegistro(r.origem_tipo, r.origem_id)}</div></div><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><div className="text-xs text-muted-foreground">{labelRelacao(r.relacao)} · {labelTipo(r.destino_tipo)}</div><div className="font-medium truncate">{nomeRegistro(r.destino_tipo, r.destino_id)}</div></div></div><Button variant="ghost" size="icon" onClick={() => excluir(r.id)} title="Excluir relacionamento"><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum relacionamento registrado.</p>}</CardContent></Card>
  </div>;
}
