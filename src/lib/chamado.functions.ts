import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  emailChamadoAberto,
  emailInteracao,
  emailChamadoFechado,
  emailChamadoResolvido,
} from "@/lib/email.service.server";
import { hasAnyRolePermission } from "@/lib/permissions";
import type { Role } from "@/types/roles";

async function getAdminClient(fallback: any) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fallback;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getRoles(supabase: any, userId: string): Promise<Role[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: Role }) => r.role);
}

async function hasPermission(supabase: any, userId: string, permission: Parameters<typeof hasAnyRolePermission>[1]) {
  return hasAnyRolePermission(await getRoles(supabase, userId), permission);
}

type TipoNotificacao = "chamado_aberto" | "chamado_atribuido" | "comentario_adicionado" | "status_alterado" | "sla_proximo" | "sla_vencido" | "chamado_resolvido";

async function criarNotificacao(admin: any, args: { destinatarioId: string; tipo: TipoNotificacao; titulo: string; mensagem: string; chamadoId?: string | null }) {
  const { data, error } = await admin.from("notificacoes").insert({ destinatario_id: args.destinatarioId, tipo: args.tipo, titulo: args.titulo, mensagem: args.mensagem, chamado_id: args.chamadoId ?? null } as never).select("id").single();
  if (error) throw new Error(`Falha ao criar notificação: ${error.message}`);
  return !!data;
}

async function canAccessTicket(supabase: any, userId: string, ticket: any) {
  const roles = await getRoles(supabase, userId);
  if (roles.includes("admin")) return true;
  if (roles.includes("atendente")) return hasAnyRolePermission(roles, "ticket.view.queue");
  if (roles.includes("gestor")) {
    const { data: perfil, error: perfilError } = await supabase.from("profiles").select("area_id").eq("id", userId).maybeSingle();
    if (perfilError) throw new Error(perfilError.message);
    if (perfil?.area_id) {
      const { data: area, error: areaError } = await supabase.from("areas").select("nome").eq("id", perfil.area_id).maybeSingle();
      if (areaError) throw new Error(areaError.message);
      const areaNome = String(area?.nome ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (areaNome === "ti") return true;
    }
    const { data: ok, error } = await supabase.rpc("gestor_mesma_area", { _gestor_id: userId, _colaborador_id: ticket.solicitante_id });
    if (error) throw new Error(error.message);
    return !!ok;
  }
  return ticket.solicitante_id === userId;
}

async function canEditFilaTicket(supabase: any, userId: string, ticket: any) {
  const roles = await getRoles(supabase, userId);
  if (roles.includes("admin")) return true;
  if (roles.includes("gestor")) return canAccessTicket(supabase, userId, ticket);
  if (!roles.includes("atendente")) return false;
  return ticket.atendente_id == null || ticket.atendente_id === userId;
}

export const criarChamado = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({
  titulo: z.string().trim().min(1).max(250), descricao: z.string().trim().min(1), prioridade: z.enum(["baixa", "media", "alta", "critica"]),
  tipoChamadoId: z.string().uuid(), categoriaId: z.string().uuid().nullable(), subcategoriaId: z.string().uuid().nullable(),
}).parse(d)).handler(async ({ data, context }) => {
  if (!(await hasPermission(context.supabase, context.userId, "ticket.create"))) throw new Error("Você não tem permissão para criar chamados.");
  const admin = await getAdminClient(context.supabase);
  const { data: criado, error } = await admin.from("chamados").insert({ titulo: data.titulo, descricao: data.descricao, prioridade: data.prioridade, tipo_chamado_id: data.tipoChamadoId, solicitante_id: context.userId, categoria_id: data.categoriaId, subcategoria_id: data.subcategoriaId, numero: "" } as never).select("id,numero,titulo,descricao,prioridade,prazo_resolucao,tipo_chamado_id").single();
  if (error || !criado) throw new Error(error?.message ?? "Falha ao criar chamado");
  await criarNotificacao(admin, { destinatarioId: context.userId, tipo: "chamado_aberto", titulo: "Chamado " + criado.numero + " aberto", mensagem: `Seu chamado "${criado.titulo}" foi registrado com sucesso.`, chamadoId: criado.id });
  return criado;
});

export const comentarChamado = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ chamadoId: z.string().uuid(), conteudo: z.string().trim().min(1), interno: z.boolean().default(false) }).parse(d)).handler(async ({ data, context }) => {
  const supabase = context.supabase as any; const admin = await getAdminClient(supabase);
  const { data: ticket, error: ticketError } = await admin.from("chamados").select("id,numero,titulo,status,prioridade,prazo_resolucao,sla_pausado,solicitante_id,atendente_id").eq("id", data.chamadoId).maybeSingle();
  if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Chamado não encontrado");
  const isRequester = ticket.solicitante_id === context.userId;
  const canInteract = isRequester || await canEditFilaTicket(supabase, context.userId, ticket);
  if (!canInteract) throw new Error("Somente o solicitante, o admin, o gestor com acesso ao chamado ou o atendente autorizado pode comentar neste chamado.");
  if (data.interno && !isRequester && !(await hasPermission(supabase, context.userId, "ticket.comment.internal"))) throw new Error("Nota interna disponível somente para atendimento.");
  if (data.interno && isRequester) throw new Error("Solicitantes não podem adicionar notas internas.");
  if (data.interno && !(await hasPermission(supabase, context.userId, "ticket.comment.internal"))) throw new Error("Nota interna disponível somente para atendimento.");
  const { data: inserted, error } = await admin.from("comentarios_chamado").insert({ chamado_id: data.chamadoId, autor_id: context.userId, conteudo: data.conteudo, interno: data.interno } as never).select("id,conteudo,interno,criado_em").single();
  if (error || !inserted) throw new Error(error?.message ?? "Falha ao registrar comentário");
  return inserted;
});

export const atualizarChamado = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({
  chamadoId: z.string().uuid(), status: z.enum(["aberto", "em_andamento", "aguardando_usuario", "aguardando_terceiro", "resolvido", "fechado", "reaberto", "cancelado"]).optional(), prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(), atendenteId: z.string().uuid().nullable().optional(), tipoChamadoId: z.string().uuid().optional(),
}).parse(d)).handler(async ({ data, context }) => {
  const supabase = context.supabase as any; const admin = await getAdminClient(supabase);
  const { data: ticket, error: ticketError } = await admin.from("chamados").select("*").eq("id", data.chamadoId).maybeSingle();
  if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Chamado não encontrado");
  const isRequester = ticket.solicitante_id === context.userId;
  const roles = await getRoles(supabase, context.userId);
  const isAdmin = roles.includes("admin");
  const isGestor = roles.includes("gestor");
  const canEditFila = await canEditFilaTicket(supabase, context.userId, ticket);

  if (!isAdmin && !isGestor && !canEditFila) {
    if (data.status === "reaberto" && isRequester) {
      if (ticket.status !== "fechado" || !ticket.fechado_em) throw new Error("Somente chamados fechados podem ser reabertos.");
      if (Date.now() - new Date(ticket.fechado_em).getTime() > 48 * 60 * 60 * 1000) throw new Error("O prazo de 2 dias para reabrir o chamado expirou.");
    } else {
      throw new Error("Somente o admin, o gestor com acesso ao chamado ou o atendente autorizado pode alterar este chamado.");
    }
  }

  if (!(await canAccessTicket(supabase, context.userId, ticket))) throw new Error("Você não tem permissão para alterar este chamado.");
  if (data.status === "reaberto") {
    if (!isRequester && !isAdmin) throw new Error("Somente o solicitante pode reabrir o chamado.");
    if (ticket.status !== "fechado" || !ticket.fechado_em) throw new Error("Somente chamados fechados podem ser reabertos.");
    if (Date.now() - new Date(ticket.fechado_em).getTime() > 48 * 60 * 60 * 1000) throw new Error("O prazo de 2 dias para reabrir o chamado expirou.");
  } else if (data.status !== undefined && !isGestor && !(await hasPermission(supabase, context.userId, "ticket.update.status"))) {
    throw new Error("Somente a equipe de atendimento pode alterar o status do chamado.");
  }
  if (data.prioridade !== undefined && !isGestor && !(await hasPermission(supabase, context.userId, "ticket.update.priority"))) throw new Error("Você não tem permissão para alterar a prioridade.");
  if (data.atendenteId !== undefined && !isGestor && !(await hasPermission(supabase, context.userId, "ticket.assign"))) throw new Error("Você não tem permissão para atribuir o chamado.");
  if (data.tipoChamadoId !== undefined && !isGestor && !(await hasPermission(supabase, context.userId, "ticket.update.status"))) throw new Error("Você não tem permissão para alterar o tipo de chamado.");
  if (data.atendenteId !== undefined && data.atendenteId !== null) {
    const { data: targetRoles, error: targetError } = await admin.from("user_roles").select("role").eq("user_id", data.atendenteId);
    if (targetError) throw new Error(targetError.message);
    if (!(targetRoles ?? []).some((r: { role: Role }) => hasAnyRolePermission([r.role], "ticket.view.queue"))) throw new Error("O responsável selecionado não possui perfil de atendimento.");
  }
  const patch: Record<string, any> = {}; const historico: any[] = [];
  if (data.status && data.status !== ticket.status) {
    patch.status = data.status; historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: data.status === "reaberto" ? "chamado_reaberto" : "status_alterado", de: ticket.status, para: data.status });
    if (data.status === "resolvido") patch.resolvido_em = new Date().toISOString();
    if (data.status === "fechado") patch.fechado_em = new Date().toISOString();
    if (data.status === "reaberto") { patch.reaberto_em = new Date().toISOString(); patch.sla_pausado = false; patch.atendente_id = ticket.atendente_id ?? null; }
  }
  if (data.prioridade && data.prioridade !== ticket.prioridade) { patch.prioridade = data.prioridade; historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: "prioridade_alterada", de: ticket.prioridade, para: data.prioridade }); }
  if (data.atendenteId !== undefined && data.atendenteId !== ticket.atendente_id) { patch.atendente_id = data.atendenteId; historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: "atendente_alterado", de: ticket.atendente_id ?? "", para: data.atendenteId ?? "" }); }
  if (data.tipoChamadoId !== undefined && data.tipoChamadoId !== ticket.tipo_chamado_id) { patch.tipo_chamado_id = data.tipoChamadoId; historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: "tipo_chamado_alterado", de: ticket.tipo_chamado_id ?? "", para: data.tipoChamadoId }); }
  if (!Object.keys(patch).length) return { ok: true, chamado: ticket };

  let updated: any;
  if (data.atendenteId !== undefined && !isGestor) {
    const { data: assigned, error: assignError } = await supabase.rpc("atribuir_chamado", {
      _chamado_id: data.chamadoId,
      _atendente_id: data.atendenteId,
    });
    if (assignError || !assigned) throw new Error(assignError?.message ?? "Falha ao atribuir chamado");
    updated = assigned;

    const otherPatch = { ...patch };
    delete otherPatch.atendente_id;
    if (Object.keys(otherPatch).length) {
      const { data: restUpdated, error: restError } = await admin.from("chamados").update(otherPatch as never).eq("id", data.chamadoId).select("*").single();
      if (restError || !restUpdated) throw new Error(restError?.message ?? "Falha ao atualizar chamado");
      updated = restUpdated;
    }
  } else {
    const { data: restUpdated, error: updateError } = await admin.from("chamados").update(patch as never).eq("id", data.chamadoId).select("*").single();
    if (updateError || !restUpdated) throw new Error(updateError?.message ?? "Falha ao atualizar chamado");
    updated = restUpdated;
  }

  if (data.atendenteId !== undefined && updated.atendente_id !== data.atendenteId) throw new Error("A atribuição não foi persistida no chamado.");
  if (historico.length) { const { error: histError } = await admin.from("historico_chamado").insert(historico as never); if (histError) throw new Error(histError.message); }
  return { ok: true, chamado: updated };
});

export const avaliarChamado = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ chamadoId: z.string().uuid(), nota: z.number().int().min(1).max(5), comentario: z.string().nullable().optional() }).parse(d)).handler(async ({ data, context }) => {
  const admin = await getAdminClient(context.supabase as any);
  const { data: ticket, error } = await admin.from("chamados").select("id,numero,titulo,status,solicitante_id,avaliacao_nota").eq("id", data.chamadoId).maybeSingle();
  if (error || !ticket) throw new Error(error?.message ?? "Chamado não encontrado");
  if (ticket.solicitante_id !== context.userId) throw new Error("Somente o solicitante pode avaliar o chamado.");
  if (ticket.status !== "resolvido") throw new Error("O chamado precisa estar resolvido para ser avaliado.");
  if (ticket.avaliacao_nota != null) throw new Error("Este chamado já foi avaliado.");
  const { error: rpcError } = await (context.supabase as any).rpc("avaliar_chamado", { _chamado_id: data.chamadoId, _nota: data.nota, _comentario: data.comentario ?? null });
  if (rpcError) throw new Error(rpcError.message);
  return { ok: true, status: "fechado" };
});
