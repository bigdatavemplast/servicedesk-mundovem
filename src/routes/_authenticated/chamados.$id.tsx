import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Clock, Loader2, Star } from "lucide-react";
import { AnexosSecao } from "@/components/anexos/AnexosSecao";
import { useServerFn } from "@tanstack/react-start";
import { atualizarChamado, comentarChamado, avaliarChamado } from "@/lib/chamado.functions";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: ({ params }) => {
    const ref = String(params.id).slice(0, 8);
    const titulo = `Chamado ${ref} | Mundo Vem Service Desk`;
    const descricao = `Acompanhe o chamado ${ref}: status, prioridade, SLA, comentários, anexos e histórico completo do atendimento na Mundo Vem.`;
    return { meta: [
      { title: titulo }, { name: "description", content: descricao },
      { property: "og:title", content: titulo }, { property: "og:description", content: descricao },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: titulo }, { name: "twitter:description", content: descricao },
      { name: "robots", content: "noindex, follow" },
    ] };
  },
  component: DetalheChamadoPage,
});

const STATUS: { v: string; l: string }[] = [
  { v: "aberto", l: "Aberto" }, { v: "em_andamento", l: "Em andamento" },
  { v: "aguardando_usuario", l: "Aguardando usuário" }, { v: "aguardando_terceiro", l: "Aguardando terceiro" },
  { v: "resolvido", l: "Resolvido" }, { v: "fechado", l: "Fechado" }, { v: "cancelado", l: "Cancelado" },
];
const PRIOS = [
  { v: "baixa", l: "Baixa" }, { v: "media", l: "Média" }, { v: "alta", l: "Alta" }, { v: "critica", l: "Crítica" },
];
function fmt(d: string | null) { if (!d) return "—"; return new Date(d).toLocaleString("pt-BR"); }
function prioClass(p: string) { return p === "critica" ? "bg-red-100 text-red-700" : p === "alta" ? "bg-amber-100 text-amber-700" : p === "media" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"; }
function slaInfo(chamado: any, now: number) {
  if (chamado?.sla_pausado) { const sec = Math.max(0, Number(chamado.sla_tempo_restante_segundos ?? 0)); return { status: "pausado", label: "Pausado", seconds: sec }; }
  if (!chamado?.prazo_resolucao) return { status: "sem_sla", label: "Sem SLA", seconds: null as number | null };
  const sec = Math.floor((new Date(chamado.prazo_resolucao).getTime() - now) / 1000);
  if (sec <= 0) return { status: "vencido", label: "Vencido", seconds: 0 };
  if (sec <= 3600) return { status: "vencendo", label: "Vencendo", seconds: sec };
  return { status: "ok", label: "OK", seconds: sec };
}
function formatDuration(seconds: number | null) { if (seconds == null) return "—"; const s = Math.max(0, Math.floor(seconds)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); if (h > 0) return `${h}h ${m}min`; return `${m}min`; }
function slaClass(status: string) { if (status === "vencido") return "text-red-600"; if (status === "vencendo") return "text-amber-600"; if (status === "pausado") return "text-blue-600"; return "text-emerald-600"; }
function statusClass(s: string) { if (s === "aberto") return "bg-sky-100 text-sky-700"; if (s === "em_andamento") return "bg-amber-100 text-amber-700"; if (s.startsWith("aguardando")) return "bg-orange-100 text-orange-700"; if (s === "resolvido") return "bg-emerald-100 text-emerald-700"; if (s === "fechado") return "bg-violet-100 text-violet-700"; if (s === "reaberto") return "bg-sky-100 text-sky-700"; return "bg-muted text-muted-foreground"; }

function DetalheChamadoPage() {
  const { id } = Route.useParams(); const { user } = Route.useRouteContext(); const navigate = useNavigate(); const qc = useQueryClient();
  const [comentario, setComentario] = useState(""); const [interno, setInterno] = useState(false); const [nota, setNota] = useState(0); const [avaliacaoComentario, setAvaliacaoComentario] = useState(""); const [now, setNow] = useState(Date.now());
  const [confirmacao, setConfirmacao] = useState<{ campo: "status" | "prioridade" | "atendente" | "tipo"; valor: string | null; label: string; atual: string; atualLabel: string } | null>(null);
  const atualizarServer = useServerFn(atualizarChamado); const comentarServer = useServerFn(comentarChamado); const avaliarServer = useServerFn(avaliarChamado);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const { data: roles = [] } = useQuery({ queryKey: ["my-roles", user.id], queryFn: async () => { const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id); return (data ?? []).map((r) => r.role as string); } });
  const isStaff = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));
  const isAttendant = roles.includes("atendente") && !roles.includes("gestor") && !roles.includes("admin");

  const { data: chamado, isLoading } = useQuery({
    queryKey: ["chamado", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("chamados").select(`*,
          solicitante:profiles!chamados_solicitante_profile_fkey(id,nome,email,departamento),
          atendente:profiles!chamados_atendente_profile_fkey(id,nome,email),
          tipo:tipos_chamado(id,nome), categoria:categorias(id,nome), subcategoria:subcategorias(id,nome),
          sla:slas(prioridade,tempo_resposta_h,tempo_resolucao_h)`).eq("id", id).maybeSingle();
      if (error) throw error; return data;
    },
  });

  const { data: comentarios = [] } = useQuery({ queryKey: ["chamado-comentarios", id, isAttendant], queryFn: async () => { let q = supabase.from("comentarios_chamado").select("id,conteudo,interno,criado_em,autor:profiles(nome)").eq("chamado_id", id).order("criado_em", { ascending: true }); if (!isAttendant) q = q.eq("interno", false); const { data } = await q; return data ?? []; } });
  const { data: historico = [] } = useQuery({ queryKey: ["chamado-historico", id], queryFn: async () => { const { data } = await supabase.from("historico_chamado").select("id,acao,de,para,criado_em,autor:profiles(nome)").eq("chamado_id", id).order("criado_em", { ascending: false }); return data ?? []; } });

  // Atendentes são carregados exclusivamente pelos grupos vinculados ao segmento do chamado.
  // Isso impede que um chamado RH exiba atendentes de TI, mesmo que tenham o mesmo papel.
  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos", chamado?.segmento_id],
    enabled: isStaff && !!chamado?.segmento_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_atendentes")
        .select("usuario_id, usuario:profiles(id,nome), grupo:grupos_atendimento!inner(segmento_id,ativo)")
        .eq("ativo", true)
        .eq("grupo.ativo", true)
        .eq("grupo.segmento_id", chamado!.segmento_id);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).map((r: any) => r.usuario).filter((p: any) => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id); return true;
      });
    },
  });

  const { data: tiposChamado = [] } = useQuery({ queryKey: ["tipos-chamado-ativos"], enabled: isStaff, queryFn: async () => { const { data, error } = await supabase.from("tipos_chamado").select("id,nome").eq("ativo", true).order("ordem", { ascending: true }).order("nome", { ascending: true }); if (error) throw error; return data ?? []; } });

  const atualizar = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => { await atualizarServer({ data: { chamadoId: id, status: typeof patch.status === "string" ? patch.status : undefined, prioridade: typeof patch.prioridade === "string" ? patch.prioridade as any : undefined, atendenteId: "atendente_id" in patch ? ((patch.atendente_id as string | null) ?? null) : undefined, tipoChamadoId: typeof patch.tipoChamadoId === "string" ? patch.tipoChamadoId : undefined } }); },
    onSuccess: () => { toast.success("Chamado atualizado"); qc.invalidateQueries({ queryKey: ["chamado", id] }); qc.invalidateQueries({ queryKey: ["chamado-historico", id] }); qc.invalidateQueries({ queryKey: ["fila"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const comentar = useMutation({
    mutationFn: async () => { await comentarServer({ data: { chamadoId: id, conteudo: comentario, interno } }); },
    onSuccess: () => { setComentario(""); setInterno(false); qc.invalidateQueries({ queryKey: ["chamado", id] }); qc.invalidateQueries({ queryKey: ["chamado-comentarios", id] }); qc.invalidateQueries({ queryKey: ["chamado-historico", id] }); qc.invalidateQueries({ queryKey: ["fila"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Resposta enviada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const avaliar = useMutation({
    mutationFn: async () => { if (nota < 1) throw new Error("Escolha uma nota"); await avaliarServer({ data: { chamadoId: id, nota, comentario: avaliacaoComentario || null } }); },
    onSuccess: () => { toast.success("Avaliação registrada"); qc.invalidateQueries({ queryKey: ["chamado", id] }); qc.invalidateQueries({ queryKey: ["chamado-historico", id] }); qc.invalidateQueries({ queryKey: ["fila"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!chamado) return <div className="p-8 text-center text-sm text-muted-foreground">Chamado não encontrado.</div>;
  const podeAvaliar = chamado.solicitante_id === user.id && chamado.status === "resolvido" && !chamado.avaliacao_nota;
  const jaAvaliado = chamado.avaliacao_nota != null; const fechadoEmMs = chamado.fechado_em ? new Date(chamado.fechado_em).getTime() : 0; const prazoReaberturaMs = fechadoEmMs + 48 * 60 * 60 * 1000;
  const podeReabrir = chamado.solicitante_id === user.id && chamado.status === "fechado" && fechadoEmMs > 0 && now <= prazoReaberturaMs; const sla = slaInfo(chamado as any, now);

  return (<div className="space-y-4">
    <Button variant="ghost" size="sm" onClick={() => navigate({ to: isStaff ? "/fila" : "/chamados" })}><ArrowLeft className="mr-2 h-4 w-4" />{isStaff ? "Fila de atendimento" : "Meus chamados"}</Button>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-xs text-muted-foreground">{chamado.numero}</div><h1 className="text-2xl font-bold">{chamado.titulo}</h1><div className="mt-1 text-sm text-muted-foreground">Solicitante: <strong>{(chamado.solicitante as any)?.nome ?? "—"}</strong></div></div><div className="flex gap-2"><span className={`rounded-full px-2 py-1 text-xs font-medium ${prioClass(chamado.prioridade)}`}>{chamado.prioridade}</span><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(chamado.status)}`}>{STATUS.find((s) => s.v === chamado.status)?.l ?? chamado.status}</span></div></div>
    {podeReabrir && (<Card className="border-sky-200 bg-sky-50/50"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="text-sm font-semibold">Precisa de mais atendimento?</div><div className="text-xs text-muted-foreground">Você pode reabrir este chamado até {fmt(new Date(prazoReaberturaMs).toISOString())}.</div></div><Button variant="outline" disabled={atualizar.isPending} onClick={() => setConfirmacao({ campo: "status", valor: "reaberto", label: "Reaberto", atual: "fechado", atualLabel: "Fechado" })}>{atualizar.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Reabrir chamado</Button></CardContent></Card>)}
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Descrição</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{chamado.descricao}</p></CardContent></Card>
      <AnexosSecao chamadoId={id} userId={user.id} podeRemoverTodos={roles.includes("admin")} />
      {podeAvaliar && (<Card className="border-emerald-200 bg-emerald-50/40"><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Avaliar atendimento</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex gap-1">{[1,2,3,4,5].map((n) => (<button key={n} onClick={() => setNota(n)} className="p-1"><Star className={`h-6 w-6 ${n <= nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} /></button>))}</div><Textarea rows={3} placeholder="Comentário (opcional)" value={avaliacaoComentario} onChange={(e) => setAvaliacaoComentario(e.target.value)} /><Button disabled={nota < 1 || avaliar.isPending} onClick={() => avaliar.mutate()}>{avaliar.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />} Enviar avaliação e fechar</Button></CardContent></Card>)}
      {jaAvaliado && (<Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Avaliação</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex gap-1">{[1,2,3,4,5].map((n) => (<Star key={n} className={`h-5 w-5 ${n <= (chamado.avaliacao_nota ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />))}</div>{chamado.avaliacao_comentario && <p className="text-sm text-muted-foreground">"{chamado.avaliacao_comentario}"</p>}</CardContent></Card>)}
      {isStaff && (<Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ações do atendimento</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">
        <div className="min-w-[180px] space-y-1"><label className="text-xs text-muted-foreground">Status</label><Select value={chamado.status} onValueChange={(v) => { const item = STATUS.find((x) => x.v === v); if (v !== chamado.status) setConfirmacao({ campo: "status", valor: v, label: item?.l ?? v, atual: chamado.status, atualLabel: STATUS.find((x) => x.v === chamado.status)?.l ?? chamado.status }); }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[160px] space-y-1"><label className="text-xs text-muted-foreground">Prioridade</label><Select value={chamado.prioridade} onValueChange={(v) => { const item = PRIOS.find((x) => x.v === v); if (v !== chamado.prioridade) setConfirmacao({ campo: "prioridade", valor: v, label: item?.l ?? v, atual: chamado.prioridade, atualLabel: PRIOS.find((x) => x.v === chamado.prioridade)?.l ?? chamado.prioridade }); }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{PRIOS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[220px] flex-1 space-y-1"><label className="text-xs text-muted-foreground">Atendente</label><Select value={chamado.atendente_id ?? "__none__"} onValueChange={(v) => { const value = v === "__none__" ? null : v; const tecnico = value ? tecnicos.find((t: any) => t.id === value) : null; if (value !== (chamado.atendente_id ?? null)) setConfirmacao({ campo: "atendente", valor: value, label: tecnico?.nome ?? "Não atribuído", atual: chamado.atendente_id ?? "", atualLabel: (chamado.atendente as any)?.nome ?? "Não atribuído" }); }}><SelectTrigger className="h-9"><SelectValue placeholder="Não atribuído" /></SelectTrigger><SelectContent><SelectItem value="__none__">Não atribuído</SelectItem>{tecnicos.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[220px] flex-1 space-y-1"><label className="text-xs text-muted-foreground">Tipo de Chamado</label><Select value={chamado.tipo_chamado_id ?? "__none__"} onValueChange={(v) => { const tipo = tiposChamado.find((t: any) => t.id === v); if (v !== (chamado.tipo_chamado_id ?? null) && v !== "__none__") setConfirmacao({ campo: "tipo", valor: v, label: tipo?.nome ?? v, atual: chamado.tipo_chamado_id ?? "", atualLabel: (chamado.tipo as any)?.nome ?? "Sem tipo definido" }); }}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent>{tiposChamado.map((tipo: any) => <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>)}</SelectContent></Select></div>
        {chamado.atendente_id !== user.id && (<Button variant="outline" size="sm" className="self-end" onClick={() => setConfirmacao({ campo: "atendente", valor: user.id, label: "Você", atual: chamado.atendente_id ?? "", atualLabel: (chamado.atendente as any)?.nome ?? "Não atribuído" })}>Atribuir a mim</Button>)}
      </CardContent></Card>)}
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Adicionar resposta</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder={interno ? "Nota interna (não visível ao solicitante)" : "Escreva sua resposta…"} /><div className="flex items-center justify-between">{isAttendant ? (<label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={interno} onChange={(e) => setInterno(e.target.checked)} />Nota interna</label>) : <div /> }<Button size="sm" disabled={!comentario.trim() || comentar.isPending} onClick={() => comentar.mutate()}>{comentar.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Enviar</Button></div></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Conversas</CardTitle></CardHeader><CardContent className="space-y-3">{comentarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}{comentarios.map((c: any) => (<div key={c.id} className={`rounded-md border-l-4 p-3 text-sm ${c.interno ? "border-amber-400 bg-amber-50" : "border-slate-300 bg-muted/40"}`}><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{c.autor?.nome ?? "Sistema"} {c.interno && <span className="font-medium text-amber-700">(interno)</span>}</span><span>{fmt(c.criado_em)}</span></div><p className="whitespace-pre-wrap">{c.conteudo}</p></div>))}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Histórico</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-sm"><li className="text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" /> Aberto em {fmt(chamado.aberto_em)}</li>{historico.map((h: any) => (<li key={h.id} className="text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" />{h.acao.replaceAll("_", " ")}: <span className="text-foreground">{h.de || "—"} → {h.para || "—"}</span><span className="ml-2 text-xs">({fmt(h.criado_em)})</span></li>))}</ul></CardContent></Card>
    </div><div><Card><CardContent className="space-y-3 p-4 text-sm"><Info label="Solicitante" value={(chamado.solicitante as any)?.nome} /><Info label="Departamento" value={(chamado.solicitante as any)?.departamento} /><Info label="Atendente" value={(chamado.atendente as any)?.nome ?? "Sem atendente atribuído"} /><Info label="Tipo de Chamado" value={(chamado.tipo as any)?.nome} /><Info label="Categoria" value={(chamado.categoria as any)?.nome} /><Info label="Subcategoria" value={(chamado.subcategoria as any)?.nome} /><Info label="Aberto em" value={fmt(chamado.aberto_em)} /><Info label="Resolvido em" value={fmt(chamado.resolvido_em)} />{chamado.prazo_resolucao && (<div className="border-t pt-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SLA de resolução</div><div className={`mt-1 font-semibold ${slaClass(sla.status)}`}>{sla.label}</div><div className="mt-1 text-xs text-muted-foreground">{sla.status === "vencido" ? `Vencido há ${formatDuration(Math.floor((now - new Date(chamado.prazo_resolucao).getTime()) / 1000))}` : `${formatDuration(sla.seconds)} restantes`}</div>{sla.status !== "pausado" && <div className="mt-1 text-[11px] text-muted-foreground">Vencimento: {fmt(chamado.prazo_resolucao)}</div>}{sla.status === "pausado" && <div className="mt-1 flex items-center gap-1 text-xs text-blue-600"><Clock className="h-3 w-3" /> Aguardando resposta do solicitante</div>}</div>)}</CardContent></Card></div></div>
    <AlertDialog open={!!confirmacao} onOpenChange={(open) => !open && setConfirmacao(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar alteração</AlertDialogTitle><AlertDialogDescription>Confirma a alteração de <strong>{confirmacao?.atualLabel}</strong> para <strong>{confirmacao?.label}</strong>?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setConfirmacao(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (!confirmacao) return; const c = confirmacao; setConfirmacao(null); if (c.campo === "status") atualizar.mutate({ status: c.valor }); if (c.campo === "prioridade") atualizar.mutate({ prioridade: c.valor }); if (c.campo === "atendente") atualizar.mutate({ atendente_id: c.valor }); if (c.campo === "tipo") atualizar.mutate({ tipoChamadoId: c.valor }); }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>);
}

function Info({ label, value }: { label: string; value?: string | null }) { return (<div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5">{value || "—"}</div></div>); }
