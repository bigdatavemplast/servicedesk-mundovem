
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emailChamadoAberto, emailInteracao, emailChamadoFechado } from "@/lib/email.service";

const prioridadeEnum = z.enum(["baixa", "media", "alta", "critica"]);

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function isStaff(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).some((r: any) => ["atendente", "gestor", "admin"].includes(r.role));
}

async function isAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).some((r: any) => r.role === "admin");
}

async function canAccessTicket(supabase: any, userId: string, ticket: any) {
  if (ticket.solicitante_id === userId) return true;
  if (await isAdmin(supabase, userId)) return true;

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const values = (roles ?? []).map((r: any) => r.role);
  if (values.includes("atendente")) return true;

  if (values.includes("gestor")) {
    const { data: ok } = await supabase.rpc("gestor_mesma_area", {
      _gestor_id: userId,
      _colaborador_id: ticket.solicitante_id,
    });
    return !!ok;
  }

  return false;
}

export const criarChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      titulo: z.string().trim().min(1).max(250),
      descricao: z.string().trim().min(1),
      prioridade: prioridadeEnum,
      categoriaId: z.string().uuid().nullable(),
      subcategoriaId: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await getAdminClient();

    const { data: criado, error } = await admin
      .from("chamados")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        solicitante_id: context.userId,
        categoria_id: data.categoriaId,
        subcategoria_id: data.subcategoriaId,
        numero: "",
      } as never)
      .select("id,numero,titulo,descricao,prioridade,prazo_resolucao")
      .single();

    if (error || !criado) throw new Error(error?.message ?? "Falha ao criar chamado");

    const { data: profile } = await admin
      .from("profiles")
      .select("nome,email,departamento,area_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: area } = profile?.area_id
      ? await (admin as any).from("areas").select("nome").eq("id", profile.area_id).maybeSingle()
      : { data: null as any };

    const n1 = process.env.SERVICE_DESK_N1_EMAIL;
    if (n1) {
      const origin = process.env.SERVICE_DESK_PUBLIC_URL || process.env.APP_URL || "";
      await emailChamadoAberto({
        para: n1,
        numero: criado.numero,
        titulo: criado.titulo,
        solicitante: profile?.nome ?? context.userId,
        area: area?.nome ?? profile?.departamento ?? "Sem área",
        prioridade: criado.prioridade,
        descricao: criado.descricao,
        prazoSla: criado.prazo_resolucao,
        link: `${origin}/chamados/${criado.id}`,
      });
    }

    return criado;
  });

export const comentarChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      chamadoId: z.string().uuid(),
      conteudo: z.string().trim().min(1),
      interno: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const admin = await getAdminClient();

    const { data: ticket, error: ticketError } = await admin
      .from("chamados")
      .select("id,numero,titulo,status,prioridade,prazo_resolucao,sla_pausado,sla_tempo_restante_segundos,solicitante_id")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Chamado não encontrado");
    if (!(await canAccessTicket(supabase, context.userId, ticket))) {
      throw new Error("Você não tem permissão para interagir neste chamado.");
    }

    const { data: inserted, error } = await admin
      .from("comentarios_chamado")
      .insert({
        chamado_id: data.chamadoId,
        autor_id: context.userId,
        conteudo: data.conteudo,
        interno: data.interno,
      } as never)
      .select("id,conteudo,interno,criado_em")
      .single();

    if (error || !inserted) throw new Error(error?.message ?? "Falha ao registrar comentário");

    if (!data.interno && await isStaff(supabase, context.userId) && ticket.solicitante_id !== context.userId) {
      const { data: solicitante } = await admin
        .from("profiles")
        .select("nome,email")
        .eq("id", ticket.solicitante_id)
        .maybeSingle();
      const { data: atualizado } = await admin
        .from("chamados")
        .select("status,sla_pausado")
        .eq("id", ticket.id)
        .maybeSingle();

      if (solicitante?.email) {
        const origin = process.env.SERVICE_DESK_PUBLIC_URL || process.env.APP_URL || "";
        const slaStatus = atualizado?.sla_pausado ? "Pausado" : "Em contagem";
        await emailInteracao({
          para: solicitante.email,
          numero: ticket.numero,
          titulo: ticket.titulo,
          autor: (await admin.from("profiles").select("nome").eq("id", context.userId).maybeSingle()).data?.nome ?? "Atendimento",
          mensagem: data.conteudo,
          status: atualizado?.status ?? ticket.status,
          slaStatus,
          link: `${origin}/chamados/${ticket.id}`,
        });
      }
    }

    return inserted;
  });

export const atualizarChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      chamadoId: z.string().uuid(),
      status: z.string().optional(),
      prioridade: prioridadeEnum.optional(),
      atendenteId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const admin = await getAdminClient();

    const { data: ticket, error: ticketError } = await admin
      .from("chamados")
      .select("*")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Chamado não encontrado");
    if (!(await canAccessTicket(supabase, context.userId, ticket))) {
      throw new Error("Você não tem permissão para alterar este chamado.");
    }

    const patch: any = {};
    const historico: any[] = [];

    if (data.status && data.status !== ticket.status) {
      patch.status = data.status;
      historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: "status_alterado", de: ticket.status, para: data.status });
      if (data.status === "resolvido") patch.resolvido_em = new Date().toISOString();
      if (data.status === "fechado") patch.fechado_em = new Date().toISOString();
    }
    if (data.prioridade && data.prioridade !== ticket.prioridade) {
      patch.prioridade = data.prioridade;
      historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: "prioridade_alterada", de: ticket.prioridade, para: data.prioridade });
    }
    if (data.atendenteId !== undefined && data.atendenteId !== ticket.atendente_id) {
      patch.atendente_id = data.atendenteId;
      historico.push({ chamado_id: data.chamadoId, autor_id: context.userId, acao: "atendente_alterado", de: ticket.atendente_id ?? "", para: data.atendenteId ?? "" });
    }

    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await admin.from("chamados").update(patch as never).eq("id", data.chamadoId);
    if (error) throw new Error(error.message);
    if (historico.length) await admin.from("historico_chamado").insert(historico as never);

    if (data.status === "fechado" && ticket.status !== "fechado") {
      const { data: solicitante } = await admin
        .from("profiles")
        .select("email")
        .eq("id", ticket.solicitante_id)
        .maybeSingle();
      const { data: autor } = await admin
        .from("profiles")
        .select("nome")
        .eq("id", context.userId)
        .maybeSingle();

      if (solicitante?.email) {
        const origin = process.env.SERVICE_DESK_PUBLIC_URL || process.env.APP_URL || "";
        await emailChamadoFechado({
          para: solicitante.email,
          numero: ticket.numero,
          titulo: ticket.titulo,
          autor: autor?.nome ?? "Atendimento",
          link: `${origin}/chamados/${ticket.id}`,
        });
      }
    }

    return { ok: true };
  });
