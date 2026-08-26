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
import { AlertTriangle, Plus, X, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-problemas")({ component: ItsmProblemas });

function ItsmProblemas() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [impacto, setImpacto] = useState("medio");
  const [urgencia, setUrgencia] = useState("media");
  const [causaRaiz, setCausaRaiz] = useState("");
  const [workaround, setWorkaround] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["itsm-problemas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("itsm_problemas").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => { setTitulo(""); setDescricao(""); setPrioridade("media"); setImpacto("medio"); setUrgencia("media"); setCausaRaiz(""); setWorkaround(""); setFormError(null); };
  const criarProblema = async () => {
    if (!titulo.trim()) { setFormError("Informe o título do problema."); return; }
    setSaving(true); setFormError(null);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("itsm_problemas").insert({ titulo: titulo.trim(), descricao: descricao.trim() || null, prioridade, impacto, urgencia, causa_raiz: causaRaiz.trim() || null, workaround: workaround.trim() || null, criado_por: userData.user?.id ?? null });
    setSaving(false); if (error) { setFormError(error.message); return; }
    resetForm(); setOpen(false); await queryClient.invalidateQueries({ queryKey: ["itsm-problemas"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Problemas</h1><p className="text-sm text-muted-foreground">Gestão de problemas, causas raiz e soluções permanentes.</p></div><Button onClick={() => { resetForm(); setSelected(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo problema</Button></div>
      {open ? <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>Novo problema</CardTitle><Button variant="ghost" size="icon" onClick={() => { setOpen(false); resetForm(); }}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label htmlFor="problema-titulo">Título *</Label><Input id="problema-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Descreva o problema" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="problema-descricao">Descrição</Label><Textarea id="problema-descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o problema e seus sintomas" /></div><div className="space-y-2"><Label>Prioridade</Label><Select value={prioridade} onValueChange={setPrioridade}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Crítica</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Impacto</Label><Select value={impacto} onValueChange={setImpacto}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixo">Baixo</SelectItem><SelectItem value="medio">Médio</SelectItem><SelectItem value="alto">Alto</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Urgência</Label><Select value={urgencia} onValueChange={setUrgencia}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div><div className="space-y-2 md:col-span-2"><Label htmlFor="problema-causa">Causa raiz</Label><Textarea id="problema-causa" value={causaRaiz} onChange={(e) => setCausaRaiz(e.target.value)} placeholder="Causa identificada, quando conhecida" /></div><div className="space-y-2 md:col-span-2"><Label htmlFor="problema-workaround">Workaround</Label><Textarea id="problema-workaround" value={workaround} onChange={(e) => setWorkaround(e.target.value)} placeholder="Solução temporária, se houver" /></div></div>{formError ? <p className="text-sm text-destructive">{formError}</p> : null}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} disabled={saving}>Cancelar</Button><Button onClick={criarProblema} disabled={saving}>{saving ? "Salvando..." : "Criar problema"}</Button></div></CardContent></Card> : null}
      {selected ? <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle>{selected.titulo ?? `Problema #${selected.numero ?? selected.id}`}</CardTitle><p className="text-sm text-muted-foreground">Problema #{selected.numero ?? "-"}</p></div><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Status" value={selected.status} /><Detail label="Prioridade" value={selected.prioridade} /><Detail label="Impacto" value={selected.impacto} /><Detail label="Urgência" value={selected.urgencia} /><Detail label="Responsável" value={selected.responsavel_id} /><Detail label="Identificado em" value={formatDate(selected.data_identificacao)} /><Detail label="Resolvido em" value={formatDate(selected.data_resolucao)} /><Detail label="Criado em" value={formatDate(selected.criado_em)} /><Detail label="Atualizado em" value={formatDate(selected.atualizado_em)} /></div><Detail label="Descrição" value={selected.descricao} multiline /><Detail label="Causa raiz" value={selected.causa_raiz} multiline /><Detail label="Workaround" value={selected.workaround} multiline /></CardContent></Card> : null}
      {error ? <Card><CardContent className="pt-6 text-sm text-destructive">Não foi possível carregar os problemas.</CardContent></Card> : null}
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Problemas registrados</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : data?.length ? <div className="space-y-3">{data.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border p-4"><div className="min-w-0"><div className="font-medium truncate">{item.titulo ?? `Problema #${item.numero ?? item.id}`}</div><div className="mt-1 text-sm text-muted-foreground">Status: {item.status ?? "-"} · Prioridade: {item.prioridade ?? "-"}</div></div><Button variant="outline" size="sm" onClick={() => setSelected(item)}><Eye className="mr-2 h-4 w-4" />Ver detalhes</Button></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum problema registrado.</p>}</CardContent></Card>
    </div>
  );
}
function Detail({ label, value, multiline = false }: { label: string; value: unknown; multiline?: boolean }) { const text = value === null || value === undefined || value === "" ? "-" : String(value); return <div className={multiline ? "space-y-1 md:col-span-2" : "space-y-1"}><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={multiline ? "whitespace-pre-wrap rounded-md border p-3 text-sm" : "text-sm"}>{text}</div></div>; }
function formatDate(value: unknown) { if (!value) return "-"; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("pt-BR"); }
