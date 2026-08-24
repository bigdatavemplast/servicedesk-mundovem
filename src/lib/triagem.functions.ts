import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRolePermission } from "@/lib/permissions";
import type { Role } from "@/types/roles";

const nivelEnum = z.enum(["N1", "N2", "N3"]);
const complexidadeEnum = z.enum(["baixa", "media", "alta"]);

type SupabaseLike = any;

async function getAdminClient(fallback: SupabaseLike) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fallback;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getRoles(supabase: SupabaseLike, userId: string): Promise<Role[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: Role }) => row.role);
}

async function canTriage(supabase: SupabaseLike, userId: string) {
  const roles = await getRoles(supabase, userId);
  return roles.includes("admin") || hasAnyRolePermission(roles, "ticket.assign");
}

async function validateAttendantLevel(
  admin: SupabaseLike,
  ticket: any,
  atendenteId: string,
) {
  if (await admin.from("user_roles").select("role").eq("user_id", atendenteId).then((r: any) =>
    (r.data ?? []).some((row: { role: Role }) => row.role === "admin")
  )) {
    return;
  }

  if (!ticket.grupo_atendimento_id) {
    throw new Error("O chamado ainda não possui grupo de atendimento.");
  }

  const { data, error } = await admin
    .from("grupo_atendentes")
    .select("nivel_atendimento")
    .eq("grupo_id", ticket.grupo_atendimento_id)
    .eq("usuario_id", atendenteId)
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("O atendente selecionado não pertence ao grupo ativo deste chamado.");
  }

  const required = ticket.nivel_atendimento ?? "N1";
  const available = data.nivel_atendimento ?? "N1";
  const requiredNumber = Number(required.slice(1));
  const availableNumber = Number(available.slice(1));

  if (availableNumber < requiredNumber) {
    throw new Error(`O atendente selecionado é ${available} e o chamado requer ${required}.`);
  }
}

/**
 * Registra a decisão de triagem sem obrigar uma atribuição definitiva.
 * A classificação (categoria/subcategoria/tipo) continua separada da triagem.
 */
export const registrarTriagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        chamadoId: z.string().uuid(),
        nivelAtendimento: nivelEnum,
        complexidade: complexidadeEnum,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseLike;
    const admin = await getAdminClient(supabase);

    if (!(await canTriage(supabase, context.userId))) {
      throw new Error("Você não tem permissão para fazer a triagem deste chamado.");
    }

    const { data: ticket, error: ticketError } = await admin
      .from("chamados")
      .select("id,numero,status,grupo_atendimento_id,nivel_atendimento,complexidade,triagem_por,triagem_em")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) {
      throw new Error(ticketError?.message ?? "Chamado não encontrado.");
    }

    const { data: updated, error } = await admin
      .from("chamados")
      .update({
        nivel_atendimento: data.nivelAtendimento,
        complexidade: data.complexidade,
        triagem_por: context.userId,
        triagem_em: new Date().toISOString(),
        status: "em_triagem",
      } as never)
      .eq("id", data.chamadoId)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Falha ao registrar a triagem.");
    }

    return { ok: true, chamado: updated };
  });

/**
 * Encaminha um chamado triado para um atendente compatível com o nível requerido.
 */
export const encaminharChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        chamadoId: z.string().uuid(),
        atendenteId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseLike;
    const admin = await getAdminClient(supabase);

    if (!(await canTriage(supabase, context.userId))) {
      throw new Error("Você não tem permissão para encaminhar este chamado.");
    }

    const { data: ticket, error: ticketError } = await admin
      .from("chamados")
      .select("id,numero,status,grupo_atendimento_id,nivel_atendimento,complexidade,atendente_id")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) {
      throw new Error(ticketError?.message ?? "Chamado não encontrado.");
    }

    if (!ticket.nivel_atendimento) {
      throw new Error("Faça a triagem do chamado antes de encaminhá-lo.");
    }

    await validateAttendantLevel(admin, ticket, data.atendenteId);

    const { data: updated, error } = await admin
      .from("chamados")
      .update({
        atendente_id: data.atendenteId,
        status: "em_andamento",
      } as never)
      .eq("id", data.chamadoId)
      .select("*")
      .single();

    if (error || !updated) {
      throw new Error(error?.message ?? "Falha ao encaminhar o chamado.");
    }

    return { ok: true, chamado: updated };
  });
