import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Clock, Loader2, RotateCcw, Star, CheckCircle2, LockKeyhole } from "lucide-react";
import { AnexosSecao } from "@/components/anexos/AnexosSecao";
import { useServerFn } from "@tanstack/react-start";
import { atualizarChamado, comentarChamado, avaliarChamado, acaoSolicitanteChamado, reabrirChamado } from "@/lib/chamado.functions";

export const Route = createFileRoute("/_authenticated/chamados/$id")({
  head: ({ params }) => {
    const ref = String(params.id).slice(0, 8);
    const titulo = "Mundo Vem — Service Desk";
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
  { v: "resolvido", l: "Resolvido" }, { v: "fechado", l: "Fechado" }, { v: "reaberto", l: "Reaberto" }, { v: "cancelado", l: "Cancelado" },
];
const PRIOS = [
  { v: "baixa", l: "Baixa" }, { v: "media", l: "Média" }, { v: "alta", l: "Alta" }, { v: "critica", l: "Crítica" },
];
function fmt(d: string | null) { if (!d) return "—"; return new Date(d).toLocaleString("pt-BR"); }
function prioClass(p: string) {
  if (p === "critica") return "bg-rose-50 text-rose-700 border border-rose-200 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 dark:hover:bg-rose-900/60";
  if (p === "alta") return "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900";
  if (p === "media") return "bg-blue-50 text-blue-700 border border-blue-200 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 dark:hover:bg-blue-900/60";
  if (p === "baixa") return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
  return "bg-muted text-muted-foreground border border-border";
}
function slaInfo(chamado: any, now: number) {
  const slaDeveEstarPausado = !!chamado?.sla_pausado && ["aguardando_usuario", "aguardando_terceiro"].includes(chamado?.status);
  if (slaDeveEstarPausado) { const sec = Math.max(0, Number(chamado.sla_tempo_restante_segundos ?? 0)); return { status: "pausado", label: "Pausado", seconds: sec }; }
  if (!chamado?.prazo_resolucao) return { status: "sem_sla", label: "Sem SLA", seconds: null as number | null };
  if (chamado.status === "cancelado") return { status: "finalizado_cancelado", label: "Cancelado", seconds: null as number | null };
  if (["resolvido", "fechado"].includes(chamado.status)) return chamado.sla_resolucao_violado ? { status: "finalizado_vencido", label: "Finalizado fora do SLA", seconds: null as number | null } : { status: "finalizado", label: "SLA cumprido", seconds: null as number | null };
  const sec = Math.floor((new Date(chamado.prazo_resolucao).getTime() - now) / 1000);
  if (sec <= 0) return { status: "vencido", label: "Vencido", seconds: 0 };
  if (sec <= 3600) return { status: "vencendo", label: "Vencendo", seconds: sec };
  return { status: "ok", label: "OK", seconds: sec };
}
function formatDuration(seconds: number | null) { if (seconds == null) return "—"; const s = Math.max(0, Math.floor(seconds)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); if (h > 0) return `${h}h ${m}min`; return `${m}min`; }
function slaClass(status: string) { if (status === "vencido" || status === "finalizado_vencido") return "text-red-600"; if (status === "vencendo") return "text-[#9C1917]"; if (status === "pausado") return "text-blue-600"; if (status === "finalizado_cancelado") return "text-slate-600"; if (status === "finalizado") return "text-emerald-700"; return "text-emerald-600"; }
function statusClass(s: string) {
  const neutro = "bg-slate-100 text-slate-700 border border-slate-200 transition-colors hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700";
  const azul = "bg-blue-50 text-blue-700 border border-blue-200 transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 dark:hover:bg-blue-900/60";
  const classes: Record<string, string> = {
    aberto: azul,
    reaberto: azul,
    em_triagem: "bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900 dark:hover:bg-indigo-900/60",
    em_andamento: "bg-sky-50 text-sky-700 border border-sky-200 transition-colors hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900 dark:hover:bg-sky-900/60",
    aguardando_usuario: "bg-amber-50 text-amber-800 border border-amber-200 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 dark:hover:bg-amber-900/60",
    aguardando_terceiro: "bg-amber-50 text-amber-800 border border-amber-200 transition-colors hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900 dark:hover:bg-amber-900/60",
    fechado: neutro,
    cancelado: "bg-rose-50 text-rose-700 border border-rose-200 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900 dark:hover:bg-rose-900/60",
    resolvido: "bg-emerald-50 text-emerald-700 border border-emerald-200 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 dark:hover:bg-emerald-900/60",
  };
  return classes[s] ?? neutro;
}
function statusLabel(s: string | null | undefined) { return STATUS.find((item) => item.v === s)?.l ?? (s ? s.replaceAll("_", " ") : "—"); }
function dateKey(d: string | null | undefined) { return d ? new Date(d).toLocaleDateString("pt-BR") : ""; }
function dayLabel(d: string | null | undefined, now: number) {
  if (!d) return "Data não informada";
  const date = new Date(d);
  const today = new Date(now);
  if (date.toLocaleDateString("pt-BR") === today.toLocaleDateString("pt-BR")) return "Hoje";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
}

function DetalheChamadoPage() {
  const { id } = Route.useParams(); const { user } = Route.useRouteContext(); const navigate = useNavigate(); const qc = useQueryClient();
  const [comentario, setComentario] = useState(""); const [interno, setInterno] = useState(false); const [justificativaPrioridade, setJustificativaPrioridade] = useState(""); const [motivoSolicitante, setMotivoSolicitante] = useState(""); const [nota, setNota] = useState(0); const [avaliacaoComentario, setAvaliacaoComentario] = useState(""); const [now, setNow] = useState(Date.now());
  const [confirmacaoReabertura, setConfirmacaoReabertura] = useState(false); const [confirmacao, setConfirmacao] = useState<{ campo: "status" | "prioridade" | "atendente" | "tipo"; valor: string | null; label: string; atual: string; atualLabel: string } | null>(null);
  const atualizarServer = useServerFn(atualizarChamado); const comentarServer = useServerFn(comentarChamado); const avaliarServer = useServerFn(avaliarChamado); const acaoSolicitanteServer = useServerFn(acaoSolicitanteChamado); const reabrirServer = useServerFn(reabrirChamado);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const { data: roles = [] } = useQuery({ queryKey: ["my-roles", user.id], queryFn: async () => { const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id); return (data ?? []).map((r) => r.role as string); } });
  const isStaff = roles.some((r) => ["atendente", "gestor", "admin"].includes(r));
  const isAttendant = roles.includes("atendente") && !roles.includes("gestor") && !roles.includes("admin");
  const isManager = roles.includes("gestor") && !roles.includes("admin");
  const { data: perfilGestor } = useQuery({
    queryKey: ["perfil-area-gestor", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("departamento").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: isManager,
  });

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

  useEffect(() => { if (chamado?.numero) document.title = chamado.numero; }, [chamado?.numero]);

  const podeVerNotasInternas = roles.includes("admin") || isAttendant;
  const { data: comentarios = [] } = useQuery({ queryKey: ["chamado-comentarios", id, podeVerNotasInternas], queryFn: async () => { let q = supabase.from("comentarios_chamado").select("id,conteudo,interno,criado_em,autor:profiles(nome)").eq("chamado_id", id).order("criado_em", { ascending: true }); if (!podeVerNotasInternas) q = q.eq("interno", false); const { data } = await q; return data ?? []; } });
  const { data: historico = [] } = useQuery({ queryKey: ["chamado-historico", id], queryFn: async () => { const { data } = await supabase.from("historico_chamado").select("id,acao,de,para,ator_role,criado_em,autor:profiles(id,nome)").eq("chamado_id", id).order("criado_em", { ascending: false }); return data ?? []; } });

  const historicoAutorIds = [...new Set(historico.map((h: any) => h.autor?.id).filter((value: unknown): value is string => typeof value === "string" && value.length > 0))];
  const { data: historicoAutorRoles = [] } = useQuery({
    queryKey: ["historico-autor-roles", historicoAutorIds],
    enabled: historicoAutorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id,role").in("user_id", historicoAutorIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const getHistoricoAutorRole = (historicoItem: any) => {
    if (historicoItem?.ator_role) return historicoItem.ator_role;
    const userId = historicoItem?.autor?.id;
    if (!userId) return null;
    const roles = (historicoAutorRoles as any[]).filter((r) => r.user_id === userId).map((r) => r.role as string);
    if (roles.includes("admin")) return "admin";
    if (roles.includes("gestor")) return "gestor";
    if (roles.includes("atendente")) return "atendente";
    if (roles.includes("colaborador")) return "colaborador";
    return null;
  };
  const historicoRoleLabel = (role: string | null | undefined) => ({
    admin: "Admin",
    gestor: "Gestor",
    atendente: "Atendente",
    colaborador: "Colaborador",
  } as Record<string, string>)[role ?? ""] ?? null;

  const historicoAtendenteIds = [...new Set(historico.flatMap((h: any) => h.acao === "atendente_alterado" ? [h.de, h.para] : []).filter((value: unknown): value is string => typeof value === "string" && value.length > 0))];
  const { data: historicoAtendentes = [] } = useQuery({
    queryKey: ["historico-atendentes", historicoAtendenteIds],
    enabled: historicoAtendenteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,nome").in("id", historicoAtendenteIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const getAtendenteNome = (id: string | null | undefined) => id ? ((historicoAtendentes as any[]).find((p) => p.id === id)?.nome ?? id) : "—";

  const historicoTipoIds = [...new Set(historico.flatMap((h: any) => h.acao === "tipo_chamado_alterado" ? [h.de, h.para] : []).filter((value: unknown): value is string => typeof value === "string" && value.length > 0))];
  const { data: historicoTipos = [] } = useQuery({
    queryKey: ["historico-tipos-chamado", historicoTipoIds],
    enabled: historicoTipoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_chamado").select("id,nome").in("id", historicoTipoIds);
      if (error) throw error;
      return data ?? [];
    },
  });
  const getTipoChamadoNome = (id: string | null | undefined) => id ? ((historicoTipos as any[]).find((tipo) => tipo.id === id)?.nome ?? "Tipo removido") : "Sem tipo definido";

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos", chamado?.segmento_id],
    enabled: isStaff && !!chamado?.segmento_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grupo_atendentes")
        .select("usuario_id, usuario:profiles(id,nome), grupo:grupos_atendimento!inner(segmento_id,ativo)")
        .eq("ativo", true)
        .eq("grupo.ativo", true)
        .eq("grupo.segmento_id", chamado!.segmento_id as string);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).map((r: any) => r.usuario).filter((p: any) => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id); return true;
      });
    },
  });

  const { data: tiposChamado = [] } = useQuery({ queryKey: ["tipos-chamado-ativos"], enabled: isStaff, queryFn: async () => { const { data, error } = await supabase.from("tipos_chamado").select("id,nome").eq("ativo", true).order("ordem", { ascending: true }).order("nome", { ascending: true }); if (error) throw error; return data ?? []; } });
  const { data: atendentePodeAlterar = false } = useQuery({
    queryKey: ["pode-alterar-chamado", id, user.id, chamado?.atendente_id, chamado?.grupo_atendimento_id, chamado?.segmento_id],
    enabled: isAttendant && !!chamado,
    queryFn: async () => {
      if (!chamado || chamado.atendente_id != null) return false;
      let q = supabase
        .from("grupo_atendentes")
        .select("usuario_id, grupos_atendimento!inner(id, ativo, segmento_id)")
        .eq("usuario_id", user.id)
        .eq("ativo", true)
        .eq("grupos_atendimento.ativo", true);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return (data ?? []).some((row: any) => {
        const grupo = Array.isArray(row.grupos_atendimento) ? row.grupos_atendimento[0] : row.grupos_atendimento;
        return grupo && (
          grupo.segmento_id === chamado.segmento_id ||
          (chamado.grupo_atendimento_id != null && grupo.id === chamado.grupo_atendimento_id)
        );
      });
    },
  });
  const bloquearAlteracaoAtendente = () => {
    if (!isAttendant) return false;
    if (atendentePodeAlterar) return false;
    toast.error("Você não pode alterar este chamado. Ele já possui um atendente ou não pertence ao seu grupo/área.");
    return true;
  };

  const atualizar = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => { await atualizarServer({ data: { chamadoId: id, status: typeof patch.status === "string" ? patch.status : undefined, prioridade: typeof patch.prioridade === "string" ? patch.prioridade as any : undefined, atendenteId: "atendente_id" in patch ? ((patch.atendente_id as string | null) ?? null) : undefined, tipoChamadoId: typeof patch.tipoChamadoId === "string" ? patch.tipoChamadoId : undefined, justificativa: typeof patch.justificativa === "string" ? patch.justificativa : undefined } }); },
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
    onSuccess: () => { toast.success("Avaliação registrada"); qc.invalidateQueries({ queryKey: ["chamado", id] }); qc.invalidateQueries({ queryKey: ["chamado-historico", id] }); setNota(0); setAvaliacaoComentario(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const reabrir = useMutation({
    mutationFn: async () => {
      await reabrirServer({ data: { chamadoId: id } });
    },
    onSuccess: () => {
      toast.success("Chamado reaberto");
      setConfirmacaoReabertura(false);
      qc.invalidateQueries({ queryKey: ["chamado", id] });
      qc.invalidateQueries({ queryKey: ["chamado-historico", id] });
      qc.invalidateQueries({ queryKey: ["fila"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível reabrir o chamado."),
  });

  const acaoSolicitante = useMutation({
    mutationFn: async (entrada: { acao: "retomar" | "fechar"; motivo?: string }) => {
      await acaoSolicitanteServer({ data: { chamadoId: id, acao: entrada.acao, motivo: entrada.motivo } });
      return entrada.acao;
    },
    onSuccess: (acao) => {
      toast.success(acao === "retomar" ? "Chamado devolvido ao atendimento" : "Chamado fechado");
      if (acao === "retomar") setMotivoSolicitante("");
      qc.invalidateQueries({ queryKey: ["chamado", id] });
      qc.invalidateQueries({ queryKey: ["chamado-historico", id] });
      qc.invalidateQueries({ queryKey: ["fila"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível atualizar o chamado."),
  });

  const sla = slaInfo(chamado, now);
  const gestorNoProprioChamado = isManager && chamado?.solicitante_id === user.id;
  const mesmaAreaDoGestor = !!perfilGestor?.departamento && !!(chamado?.solicitante as any)?.departamento
    && perfilGestor.departamento.trim().toLocaleLowerCase("pt-BR") === (chamado?.solicitante as any).departamento.trim().toLocaleLowerCase("pt-BR");
  const exibirAvisoAcessoGestor = isManager && mesmaAreaDoGestor;
  const paginaSomenteLeitura = isManager;
  const podeAlterarChamado = !isManager;
  const podeAlterarPrioridade = !isManager;
  const tempoDesdeResolucao = chamado?.resolvido_em ? Date.now() - new Date(chamado.resolvido_em).getTime() : -1;
  const podeAvaliar = !!chamado && (!isManager || chamado.solicitante_id === user.id) && chamado.solicitante_id === user.id && chamado.status === "resolvido" && chamado.avaliacao_nota == null && tempoDesdeResolucao >= 0 && tempoDesdeResolucao <= 48 * 60 * 60 * 1000;
  const jaAvaliado = chamado?.avaliacao_nota != null;
  const podeReabrir = !!chamado && chamado.solicitante_id === user.id && ["resolvido", "fechado"].includes(chamado.status) && !!chamado.resolvido_em && (Date.now() - new Date(chamado.resolvido_em).getTime() < 48 * 60 * 60 * 1000);
  const exibirAvisoReabertura = !!chamado && ["resolvido", "fechado"].includes(chamado.status);
  const prazoReaberturaExpirado = !!chamado?.resolvido_em && Date.now() - new Date(chamado.resolvido_em).getTime() >= 48 * 60 * 60 * 1000;
  const statusOptions = STATUS;
  const chamadoEmAbertoAposVirada = !!chamado && !["resolvido", "fechado", "cancelado"].includes(chamado.status) && dateKey(chamado.aberto_em) !== dateKey(new Date(now).toISOString());

  if (isLoading || !chamado) return <div className="p-6">Carregando…</div>;
  return (<div className="mx-auto max-w-6xl p-4 md:p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><div><Button variant="ghost" size="sm" asChild><Link to="/chamados"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button><h1 className="mt-2 text-xl font-semibold">{chamado.numero} — {chamado.titulo}</h1></div><Badge variant="outline" className={statusClass(chamado.status)}>{statusLabel(chamado.status)}</Badge></div>
    {chamadoEmAbertoAposVirada && <div role="status" className="mb-4 flex items-start gap-3 rounded-lg border border-[#E8D3D2] border-l-[3px] border-l-[#9C1917] bg-[#FBF5F4] px-4 py-3 text-sm">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F0DEDC] text-[#8F292D]">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-[#57272A]">Atenção: este chamado atravessou o dia</p>
        <p className="mt-0.5 leading-relaxed text-[#70585A]">Aberto em {fmt(chamado.aberto_em)} e ainda não foi resolvido. Priorize o atendimento para evitar novo atraso.</p>
      </div>
    </div>}
    {!isStaff && ["resolvido", "fechado"].includes(chamado.status) && <div role="status" className={`mb-4 flex items-start gap-3 rounded-lg border px-4 py-4 shadow-sm ${chamado.status === "resolvido" ? "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" : "border-border bg-muted/40 text-foreground"}`}>
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${chamado.status === "resolvido" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
        {chamado.status === "resolvido" ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5" aria-hidden="true" />}
      </div>
      <div className="min-w-0">
        <div className="font-semibold">{prazoReaberturaExpirado ? (chamado.status === "resolvido" ? "Resolvido — prazo de reabertura encerrado" : "Fechado — prazo de reabertura encerrado") : chamado.resolvido_em ? (chamado.status === "resolvido" ? "Resolvido — você ainda pode reabrir" : "Fechado — você ainda pode reabrir") : (chamado.status === "resolvido" ? "Seu chamado foi resolvido" : "Este chamado foi encerrado")}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{prazoReaberturaExpirado ? "As 48 horas para reabrir este chamado já passaram. Se o problema continuar, use o acesso Abrir chamado no menu." : chamado.resolvido_em ? <>Se o problema continuar, você pode reabrir este chamado até <strong className="font-semibold text-foreground">{fmt(new Date(new Date(chamado.resolvido_em).getTime() + 48 * 60 * 60 * 1000).toISOString())}</strong>.</> : "Não foi possível confirmar a data da resolução para calcular o prazo. Verifique abaixo se a opção de reabertura está disponível."}</p>
        {chamado.resolvido_em && <p className="mt-2 text-xs text-muted-foreground">{chamado.status === "resolvido" ? "Resolvido em" : "Data da resolução"} {fmt(chamado.resolvido_em)}</p>}
      </div>
    </div>}

    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Descrição</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm">{chamado.descricao}</p></CardContent></Card>
      <AnexosSecao chamadoId={id} userId={user.id} somenteImagens={isManager} podeRemoverTodos={roles.includes("admin") && !paginaSomenteLeitura} podeRemoverProprio={!gestorNoProprioChamado} podeAdicionar={!isManager && (!isAttendant || atendentePodeAlterar)} onTentativaSemPermissao={() => { if (isAttendant && !atendentePodeAlterar) toast.error("Você não pode alterar este chamado. Ele já possui um atendente ou não pertence ao seu grupo/área."); }} />
      {!roles.includes("admin") && !isManager && roles.includes("colaborador") && chamado.solicitante_id === user.id && chamado.status === "aguardando_usuario" && <Card className="border-slate-200 shadow-sm"><CardHeader className="pb-1 pt-4"><CardTitle className="text-sm font-medium">A solicitação ainda não foi concluída?</CardTitle></CardHeader><CardContent className="space-y-3 pb-4"><div className="space-y-1.5"><label htmlFor="motivo-retomada" className="text-sm font-medium">Justificativa <span className="text-destructive">*</span></label><Textarea id="motivo-retomada" value={motivoSolicitante} onChange={(e) => setMotivoSolicitante(e.target.value)} placeholder="Informe o que ainda precisa ser resolvido." rows={2} maxLength={2000} disabled={acaoSolicitante.isPending} /></div><div className="flex flex-wrap gap-2"><Button disabled={acaoSolicitante.isPending || !motivoSolicitante.trim()} onClick={() => acaoSolicitante.mutate({ acao: "retomar", motivo: motivoSolicitante.trim() })}>{acaoSolicitante.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Solicitar continuidade</Button><Button variant="outline" disabled={acaoSolicitante.isPending} onClick={() => acaoSolicitante.mutate({ acao: "fechar" })}>{acaoSolicitante.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Encerrar chamado</Button></div></CardContent></Card>}

      {podeAvaliar && (<Card className="overflow-hidden border-2 border-emerald-300 bg-emerald-50/70 shadow-md dark:border-emerald-800 dark:bg-emerald-950/20"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-[#9C1917] dark:bg-emerald-900/60"><Star className="h-5 w-5 fill-current" /></span><span>Avalie o atendimento</span></CardTitle><p className="text-sm text-muted-foreground">Sua opinião ajuda a melhorar nosso serviço. Escolha de 1 a 5 estrelas.</p></CardHeader><CardContent className="space-y-4"><div><div className="flex flex-wrap items-center gap-2" role="group" aria-label="Nota do atendimento">{[1,2,3,4,5].map((n) => (<button type="button" key={n} onClick={() => setNota(n)} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`} aria-pressed={nota === n} className={`flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 ${n <= nota ? "border-amber-400 bg-amber-100 text-amber-500 shadow-sm dark:bg-amber-950/50" : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-900"}`}><Star className={`h-7 w-7 ${n <= nota ? "fill-current" : ""}`} /></button>))}</div><p className="mt-2 text-sm font-medium text-foreground" aria-live="polite">{nota === 0 ? "Toque em uma estrela para dar sua nota" : ({1:"1 estrela — Muito ruim",2:"2 estrelas — Ruim",3:"3 estrelas — Regular",4:"4 estrelas — Bom",5:"5 estrelas — Excelente"} as Record<number,string>)[nota]}</p></div><div className="space-y-1.5"><label htmlFor="avaliacao-comentario" className="text-sm font-medium">Comentário <span className="font-normal text-muted-foreground">(opcional)</span></label><Textarea id="avaliacao-comentario" rows={3} placeholder="Conte como foi sua experiência..." value={avaliacaoComentario} onChange={(e) => setAvaliacaoComentario(e.target.value)} disabled={avaliar.isPending} /></div><Button disabled={nota < 1 || avaliar.isPending} onClick={() => avaliar.mutate()} className="h-12 w-full text-base font-semibold shadow-sm transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2">{avaliar.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Enviando avaliação...</> : <><CheckCircle2 className="mr-2 h-5 w-5" />{nota < 1 ? "Escolha uma nota para continuar" : "Enviar minha avaliação"}</>}</Button></CardContent></Card>)}
      {exibirAvisoReabertura && !isManager && chamado.solicitante_id === user.id && roles.includes("colaborador") && (<Card className="border-sky-200 bg-sky-50/40"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><div className="font-medium">{prazoReaberturaExpirado ? "Prazo para reabrir encerrado" : "O problema continua?"}</div><div className="text-sm text-muted-foreground">{podeReabrir ? "Você pode reabrir este chamado até 48 horas após a resolução." : prazoReaberturaExpirado ? "Após 48 horas, este chamado não pode mais ser reaberto. Se o problema persistir, use o acesso Abrir chamado no menu." : "A reabertura deste chamado deve ser feita pelo solicitante em até 48 horas após a resolução."}</div></div>{podeReabrir && <Button variant="outline" onClick={() => setConfirmacaoReabertura(true)} disabled={reabrir.isPending}><RotateCcw className="mr-2 h-4 w-4" />Reabrir chamado</Button>}</CardContent></Card>)}
      {jaAvaliado && (<Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-[#9C1917]" />Avaliação</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex gap-1">{[1,2,3,4,5].map((n) => (<Star key={n} className={`h-5 w-5 ${n <= (chamado.avaliacao_nota ?? 0) ? "fill-[#9C1917] text-[#9C1917]" : "text-muted-foreground"}`} />))}</div>{chamado.avaliacao_comentario && <p className="text-sm text-muted-foreground">"{chamado.avaliacao_comentario}"</p>}</CardContent></Card>)}
      {isStaff && !isManager && (<Card><CardHeader className="pb-2"><CardTitle className="text-sm">{isManager ? "Ações do chamado" : "Ações do atendimento"}</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3">
        <div className="min-w-[180px] space-y-1"><label className="text-xs text-muted-foreground">Status</label><Select disabled={!podeAlterarChamado} value={chamado.status} onValueChange={(v) => { if (bloquearAlteracaoAtendente()) return; if (!v || !v.trim()) return; const item = STATUS.find((x) => x.v === v); if (v !== chamado.status) setConfirmacao({ campo: "status", valor: v, label: item?.l ?? v, atual: chamado.status, atualLabel: STATUS.find((x) => x.v === chamado.status)?.l ?? chamado.status }); }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[160px] space-y-1"><label className="text-xs text-muted-foreground">Prioridade</label><Select disabled={!podeAlterarPrioridade} value={chamado.prioridade} onValueChange={(v) => { if (bloquearAlteracaoAtendente()) return; const item = PRIOS.find((x) => x.v === v); if (v !== chamado.prioridade) { setJustificativaPrioridade(""); setConfirmacao({ campo: "prioridade", valor: v, label: item?.l ?? v, atual: chamado.prioridade, atualLabel: PRIOS.find((x) => x.v === chamado.prioridade)?.l ?? chamado.prioridade }); } }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{PRIOS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[220px] flex-1 space-y-1"><label className="text-xs text-muted-foreground">Atendente</label><Select disabled={isManager || !podeAlterarChamado} value={chamado.atendente_id ?? "__none__"} onValueChange={(v) => { if (bloquearAlteracaoAtendente()) return; const value = v === "__none__" ? null : v; const tecnico = value ? tecnicos.find((t: any) => t.id === value) : null; if (value !== (chamado.atendente_id ?? null)) setConfirmacao({ campo: "atendente", valor: value, label: tecnico?.nome ?? "Não atribuído", atual: chamado.atendente_id ?? "", atualLabel: (chamado.atendente as any)?.nome ?? "Não atribuído" }); }}><SelectTrigger className="h-9"><SelectValue placeholder="Não atribuído" /></SelectTrigger><SelectContent><SelectItem value="__none__">Não atribuído</SelectItem>{tecnicos.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[220px] flex-1 space-y-1"><label className="text-xs text-muted-foreground">Tipo de Chamado</label><Select disabled={!podeAlterarChamado} value={chamado.tipo_chamado_id ?? "__none__"} onValueChange={(v) => { if (bloquearAlteracaoAtendente()) return; const tipo = tiposChamado.find((t: any) => t.id === v); if (v !== (chamado.tipo_chamado_id ?? null) && v !== "__none__") setConfirmacao({ campo: "tipo", valor: v, label: tipo?.nome ?? v, atual: chamado.tipo_chamado_id ?? "", atualLabel: (chamado.tipo as any)?.nome ?? "Sem tipo definido" }); }}><SelectTrigger className="h-9"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent>{tiposChamado.map((tipo: any) => <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>)}</SelectContent></Select></div>
        {chamado.atendente_id !== user.id && (<Button variant="outline" size="sm" className="self-end" disabled={isManager || !podeAlterarChamado} onClick={() => { if (bloquearAlteracaoAtendente()) return; setConfirmacao({ campo: "atendente", valor: user.id, label: "Você", atual: chamado.atendente_id ?? "", atualLabel: (chamado.atendente as any)?.nome ?? "Não atribuído" }); }}>Atribuir a mim</Button>)}
      </CardContent></Card>)}
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Adicionar comentário</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea rows={4} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder={interno ? "Nota interna (não visível ao solicitante)" : "Escreva sua resposta…"} /><div className="flex items-center justify-between">{(isAttendant || roles.includes("admin")) ? (<label className={`flex items-center gap-2 text-xs ${paginaSomenteLeitura ? "opacity-50" : ""}`}><input type="checkbox" disabled={paginaSomenteLeitura} checked={interno} onChange={(e) => { if (bloquearAlteracaoAtendente()) return; setInterno(e.target.checked); }} />Nota interna (não visível ao solicitante)</label>) : <div /> }<Button size="sm" disabled={!comentario.trim() || comentar.isPending} onClick={() => { if (bloquearAlteracaoAtendente()) return; comentar.mutate(); }}>{comentar.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Enviar</Button></div></CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Conversas</CardTitle></CardHeader><CardContent className="space-y-3">{comentarios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}{comentarios.map((c: any) => (<div key={c.id} className={`rounded-md border-l-4 p-3 text-sm ${c.interno ? "border-[#9C1917]/40 bg-[#F4EBDD]" : "border-slate-300 bg-muted/40"}`}><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{c.autor?.nome ?? "Sistema"} {c.interno && <span className="font-medium text-[#9C1917]">(interno)</span>}</span><span>{fmt(c.criado_em)}</span></div><p className="whitespace-pre-wrap">{c.conteudo}</p></div>))}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Histórico</CardTitle></CardHeader><CardContent><ul className="space-y-2 text-sm"><li className="text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" /> Aberto em {fmt(chamado.aberto_em)}</li>{historico.map((h: any, index: number) => { const anterior = historico[index + 1]; const novoDia = !anterior || dateKey(h.criado_em) !== dateKey(anterior.criado_em); return (<li key={h.id} className={`text-muted-foreground${novoDia ? " historico-item-com-dia" : ""}`}>{novoDia && <div className="historico-dia" aria-label={`Alterações de ${dayLabel(h.criado_em, now)}`}><span>{dayLabel(h.criado_em, now)}</span></div>}<Clock className="mr-1 inline h-3 w-3" />{h.acao === "atendente_alterado" ? "Atendente alterado" : h.acao === "tipo_chamado_alterado" ? "Tipo de chamado alterado" : h.acao === "justificativa_prioridade" ? "Justificativa da prioridade" : h.acao === "solicitante_pediu_mais_ajuda" ? "Continuidade do atendimento solicitada" : h.acao.replaceAll("_", " ")}{h.acao === "justificativa_prioridade" ? ": " : ": "}<span className="text-foreground" style={{ textDecoration: "none" }}>{h.acao === "atendente_alterado" ? `${getAtendenteNome(h.de)} → ${getAtendenteNome(h.para)}` : h.acao === "tipo_chamado_alterado" ? `${getTipoChamadoNome(h.de)} → ${getTipoChamadoNome(h.para)}` : h.acao === "status_alterado" ? `${statusLabel(h.de)} → ${statusLabel(h.para)}` : h.acao === "avaliacao_registrada" || h.acao === "justificativa_prioridade" || h.acao === "solicitante_pediu_mais_ajuda" ? h.para : `${h.de || "—"} → ${h.para || "—"}`}</span><span className="ml-2 text-xs">por <strong className="no-underline">{h.autor?.nome ?? "Sistema"}{historicoRoleLabel(getHistoricoAutorRole(h)) ? ` (${historicoRoleLabel(getHistoricoAutorRole(h))})` : ""}</strong> · {fmt(h.criado_em)}</span></li>); })}</ul></CardContent></Card>
    </div><div><Card><CardContent className="space-y-3 p-4 text-sm"><Info label="Solicitante" value={(chamado.solicitante as any)?.nome} /><Info label="Departamento" value={(chamado.solicitante as any)?.departamento} /><Info label="Atendente" value={(chamado.atendente as any)?.nome ?? "Sem atendente atribuído"} /><Info label="Tipo de Chamado" value={(chamado.tipo as any)?.nome} /><Info label="Categoria" value={(chamado.categoria as any)?.nome} /><Info label="Subcategoria" value={(chamado.subcategoria as any)?.nome} /><Info label="Aberto em" value={fmt(chamado.aberto_em)} /><Info label="Resolvido em" value={fmt(chamado.resolvido_em)} />{chamado.prazo_resolucao && (<div className="border-t pt-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">SLA de resolução</div><div className={`mt-1 font-semibold ${slaClass(sla.status)}`}>{sla.label}</div><div className="mt-1 text-xs text-muted-foreground">{sla.status === "vencido" ? `Vencido há ${formatDuration(Math.floor((now - new Date(chamado.prazo_resolucao).getTime()) / 1000))}` : sla.status === "finalizado_vencido" ? "O prazo de resolução foi ultrapassado." : sla.status === "finalizado" ? "Concluído dentro do prazo." : sla.status === "finalizado_cancelado" ? "SLA encerrado por cancelamento." : `${formatDuration(sla.seconds)} restantes`}</div>{sla.status !== "pausado" && <div className="mt-1 text-[11px] text-muted-foreground">Vencimento: {fmt(chamado.prazo_resolucao)}</div>}{sla.status === "pausado" && <div className="mt-1 flex items-center gap-1 text-xs text-blue-600"><Clock className="h-3 w-3" /> Aguardando resposta do solicitante</div>}</div>)}</CardContent></Card></div></div>
    <AlertDialog open={confirmacaoReabertura} onOpenChange={setConfirmacaoReabertura}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reabrir chamado?</AlertDialogTitle><AlertDialogDescription>A avaliação atual será removida e o chamado voltará para <strong>Reaberto</strong>. O prazo de 48 horas é contado a partir da resolução original.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={reabrir.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={reabrir.isPending} onClick={() => reabrir.mutate()}>{reabrir.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Reabrir chamado</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!confirmacao} onOpenChange={(open) => !open && setConfirmacao(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar alteração</AlertDialogTitle><AlertDialogDescription>Confirma a alteração de <strong>{confirmacao?.atualLabel}</strong> para <strong>{confirmacao?.label}</strong>?{isManager && confirmacao?.campo === "prioridade" ? " Informe a justificativa para registrar a alteração no histórico." : ""}</AlertDialogDescription>{isManager && confirmacao?.campo === "prioridade" && <div className="space-y-2"><label className="text-sm font-medium" htmlFor="justificativa-prioridade">Justificativa obrigatória</label><Textarea id="justificativa-prioridade" rows={3} maxLength={1000} value={justificativaPrioridade} onChange={(e) => setJustificativaPrioridade(e.target.value)} placeholder="Explique por que a prioridade precisa ser alterada..." /></div>}</AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setConfirmacao(null)}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={isManager && confirmacao?.campo === "prioridade" && !justificativaPrioridade.trim()} onClick={() => { if (!confirmacao) return; const c = confirmacao; setConfirmacao(null); if (c.campo === "status") atualizar.mutate({ status: c.valor }); if (c.campo === "prioridade") { atualizar.mutate({ prioridade: c.valor, justificativa: isManager ? justificativaPrioridade.trim() : undefined }); setJustificativaPrioridade(""); } if (c.campo === "atendente") atualizar.mutate({ atendente_id: c.valor }); if (c.campo === "tipo") atualizar.mutate({ tipoChamadoId: c.valor }); }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>);
}

function Info({ label, value }: { label: string; value?: string | null }) { return (<div><div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5">{value || "—"}</div></div>); }