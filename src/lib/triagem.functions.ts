import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRolePermission } from "@/lib/permissions";
import type { Role } from "@/types/roles";

type SupabaseLike = any;

async function getAdminClient(fallback: SupabaseLike) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fallback;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getRoles(supabase: SupabaseLike, userId: string): Promise<Role[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { role: Role }) => row.role);
}

async function canTriage(supabase: SupabaseLike, userId: string) {
  const roles = await getRoles(supabase, userId);
  return roles.includes("admin") || hasAnyRolePermission(roles, "ticket.assign");
}

/** Registra somente quem fez a triagem e quando. A classificação permanece no catálogo/ITIL. */
export const registrarTriagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ chamadoId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseLike;
    const admin = await getAdminClient(supabase);

    if (!(await canTriage(supabase, context.userId))) {
      throw new Error("Você não tem permissão para fazer a triagem deste chamado.");
    }

    const { data: ticket, error: ticketError } = await admin
      .from("chamados")
      .select("id,numero,status,triagem_por,triagem_em")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Chamado não encontrado.");

    const { data: updated, error } = await admin
      .from("chamados")
      .update({ triagem_por: context.userId, triagem_em: new Date().toISOString(), status: "em_triagem" } as never)
      .eq("id", data.chamadoId)
      .select("*")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Falha ao registrar a triagem.");
    return { ok: true, chamado: updated };
  });

/** Encaminha após a triagem; o banco valida grupo e mantém o nível técnico no vínculo do atendente. */
export const encaminharChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ chamadoId: z.string().uuid(), atendenteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as SupabaseLike;
    const admin = await getAdminClient(supabase);

    if (!(await canTriage(supabase, context.userId))) {
      throw new Error("Você não tem permissão para encaminhar este chamado.");
    }

    const { data: ticket, error: ticketError } = await admin
      .from("chamados")
      .select("id,numero,status,grupo_atendimento_id,atendente_id,triagem_por")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) throw new Error(ticketError?.message ?? "Chamado não encontrado.");
    if (!ticket.triagem_por) throw new Error("Faça a triagem do chamado antes de encaminhá-lo.");

    const { data: updated, error } = await admin
      .from("chamados")
      .update({ atendente_id: data.atendenteId, status: "em_andamento" } as never)
      .eq("id", data.chamadoId)
      .select("*")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Falha ao encaminhar o chamado.");
    return { ok: true, chamado: updated };
  });
