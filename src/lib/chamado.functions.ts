import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  emailChamadoAberto,
  emailInteracao,
  emailChamadoFechado,
} from "@/lib/email.service";
import { hasAnyRolePermission } from "@/lib/permissions";
import type { Role } from "@/types/roles";

const prioridadeEnum = z.enum(["baixa", "media", "alta", "critica"]);

const statusEnum = z.enum([
  "aberto",
  "em_andamento",
  "aguardando_usuario",
  "aguardando_terceiro",
  "resolvido",
  "fechado",
  "reaberto",
  "cancelado",
]);

async function getAdminClient(fallback: any) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fallback;
  }

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );

  return supabaseAdmin;
}

async function getRoles(
  supabase: any,
  userId: string,
): Promise<Role[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((r: { role: Role }) => r.role);
}

async function hasPermission(
  supabase: any,
  userId: string,
  permission: Parameters<typeof hasAnyRolePermission>[1],
) {
  const roles = await getRoles(supabase, userId);

  return hasAnyRolePermission(roles, permission);
}

async function canAccessTicket(
  supabase: any,
  userId: string,
  ticket: any,
) {
  const roles = await getRoles(supabase, userId);

  if (roles.includes("admin")) {
    return true;
  }

  if (roles.includes("atendente")) {
    return hasAnyRolePermission(roles, "ticket.view.queue");
  }

  if (roles.includes("gestor")) {
    const { data: ok, error } = await supabase.rpc(
      "gestor_mesma_area",
      {
        _gestor_id: userId,
        _colaborador_id: ticket.solicitante_id,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    return !!ok;
  }

  return ticket.solicitante_id === userId;
}

/* ============================================================
 * CRIAR CHAMADO
 * ============================================================ */

export const criarChamado = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        titulo: z.string().trim().min(1).max(250),
        descricao: z.string().trim().min(1),
        prioridade: prioridadeEnum,
        tipoChamadoId: z.string().uuid(),
        categoriaId: z.string().uuid().nullable(),
        subcategoriaId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (
      !(await hasPermission(
        context.supabase,
        context.userId,
        "ticket.create",
      ))
    ) {
      throw new Error(
        "Você não tem permissão para criar chamados.",
      );
    }

    const admin = await getAdminClient(context.supabase);

    const {
      data: tipo,
      error: tipoError,
    } = await admin
      .from("tipos_chamado")
      .select("id")
      .eq("id", data.tipoChamadoId)
      .eq("ativo", true)
      .maybeSingle();

    if (tipoError) {
      throw new Error(tipoError.message);
    }

    if (!tipo) {
      throw new Error(
        "O tipo de chamado selecionado não está disponível.",
      );
    }

    const {
      data: criado,
      error,
    } = await admin
      .from("chamados")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        tipo_chamado_id: data.tipoChamadoId,
        solicitante_id: context.userId,
        categoria_id: data.categoriaId,
        subcategoria_id: data.subcategoriaId,
        numero: "",
      } as never)
      .select(
        "id,numero,titulo,descricao,prioridade,prazo_resolucao,tipo_chamado_id",
      )
      .single();

    if (error || !criado) {
      throw new Error(
        error?.message ?? "Falha ao criar chamado",
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("nome,email,departamento,area_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: area } = profile?.area_id
      ? await (admin as any)
          .from("areas")
          .select("nome")
          .eq("id", profile.area_id)
          .maybeSingle()
      : { data: null as any };

    const n1 = process.env.SERVICE_DESK_N1_EMAIL;

    if (n1) {
      await emailChamadoAberto({
        para: n1,
        numero: criado.numero,
        titulo: criado.titulo,
        solicitante:
          profile?.nome ?? context.userId,
        area:
          area?.nome ??
          profile?.departamento ??
          "Sem área",
        prioridade: criado.prioridade,
        descricao: criado.descricao,
        prazoSla: criado.prazo_resolucao,
        link: `${
          process.env.SERVICE_DESK_PUBLIC_URL ||
          process.env.APP_URL ||
          ""
        }/chamados/${criado.id}`,
      });
    }

    return criado;
  });

/* ============================================================
 * COMENTAR CHAMADO
 * ============================================================ */

export const comentarChamado = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        chamadoId: z.string().uuid(),
        conteudo: z.string().trim().min(1),
        interno: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const admin = await getAdminClient(supabase);

    const {
      data: ticket,
      error: ticketError,
    } = await admin
      .from("chamados")
      .select(
        "id,numero,titulo,status,prioridade,prazo_resolucao,sla_pausado,solicitante_id",
      )
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) {
      throw new Error(
        ticketError?.message ??
          "Chamado não encontrado",
      );
    }

    if (
      !(await canAccessTicket(
        supabase,
        context.userId,
        ticket,
      ))
    ) {
      throw new Error(
        "Você não tem permissão para interagir neste chamado.",
      );
    }

    if (
      data.interno &&
      !(await hasPermission(
        supabase,
        context.userId,
        "ticket.comment.internal",
      ))
    ) {
      throw new Error(
        "Nota interna disponível somente para atendimento.",
      );
    }

    const {
      data: inserted,
      error,
    } = await admin
      .from("comentarios_chamado")
      .insert({
        chamado_id: data.chamadoId,
        autor_id: context.userId,
        conteudo: data.conteudo,
        interno: data.interno,
      } as never)
      .select(
        "id,conteudo,interno,criado_em",
      )
      .single();

    if (error || !inserted) {
      throw new Error(
        error?.message ??
          "Falha ao registrar comentário",
      );
    }

    if (
      !data.interno &&
      (await hasPermission(
        supabase,
        context.userId,
        "ticket.view.queue",
      )) &&
      ticket.solicitante_id !== context.userId
    ) {
      const {
        data: solicitante,
      } = await admin
        .from("profiles")
        .select("nome,email")
        .eq("id", ticket.solicitante_id)
        .maybeSingle();

      const {
        data: autor,
      } = await admin
        .from("profiles")
        .select("nome")
        .eq("id", context.userId)
        .maybeSingle();

      if (solicitante?.email) {
        await emailInteracao({
          para: solicitante.email,
          numero: ticket.numero,
          titulo: ticket.titulo,
          autor:
            autor?.nome ?? "Atendimento",
          mensagem: data.conteudo,
          status: ticket.status,
          slaStatus: ticket.sla_pausado
            ? "Pausado"
            : "Em contagem",
          link: `${
            process.env.SERVICE_DESK_PUBLIC_URL ||
            process.env.APP_URL ||
            ""
          }/chamados/${ticket.id}`,
        });
      }
    }

    return inserted;
  });

/* ============================================================
 * ATUALIZAR CHAMADO
 *
 * Inclui:
 * - alteração de status
 * - alteração de prioridade
 * - atribuição
 * - alteração de tipo
 * - REABERTURA
 *
 * A reabertura é confirmada pelo registro retornado
 * pelo próprio banco após o UPDATE.
 * ============================================================ */

export const atualizarChamado = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        chamadoId: z.string().uuid(),
        status: statusEnum.optional(),
        prioridade: prioridadeEnum.optional(),
        atendenteId: z.string().uuid().nullable().optional(),
        tipoChamadoId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const admin = await getAdminClient(supabase);

    /* --------------------------------------------------------
     * Busca o chamado atual
     * -------------------------------------------------------- */

    const {
      data: ticket,
      error: ticketError,
    } = await admin
      .from("chamados")
      .select("*")
      .eq("id", data.chamadoId)
      .maybeSingle();

    if (ticketError || !ticket) {
      throw new Error(
        ticketError?.message ??
          "Chamado não encontrado",
      );
    }

    const isRequester =
      ticket.solicitante_id === context.userId;

    /* --------------------------------------------------------
     * Permissão de acesso
     * -------------------------------------------------------- */

    if (
      !(await canAccessTicket(
        supabase,
        context.userId,
        ticket,
      ))
    ) {
      throw new Error(
        "Você não tem permissão para alterar este chamado.",
      );
    }

    /* --------------------------------------------------------
     * REABERTURA
     *
     * Regra:
     * - somente solicitante
     * - somente chamado fechado
     * - precisa possuir fechado_em
     * - máximo 48 horas
     * -------------------------------------------------------- */

    if (data.status === "reaberto") {
      if (!isRequester) {
        throw new Error(
          "Somente o solicitante pode reabrir o chamado.",
        );
      }

      if (
        ticket.status !== "fechado" ||
        !ticket.fechado_em
      ) {
        throw new Error(
          "Somente chamados fechados podem ser reabertos.",
        );
      }

      const elapsed =
        Date.now() -
        new Date(ticket.fechado_em).getTime();

      const limite48Horas =
        48 * 60 * 60 * 1000;

      if (elapsed > limite48Horas) {
        throw new Error(
          "O prazo de 2 dias para reabrir este chamado expirou.",
        );
      }
    } else if (
      data.status !== undefined &&
      !(await hasPermission(
        supabase,
        context.userId,
        "ticket.update.status",
      ))
    ) {
      throw new Error(
        "Você não tem permissão para alterar o status.",
      );
    }

    /* --------------------------------------------------------
     * PRIORIDADE
     * -------------------------------------------------------- */

    if (
      data.prioridade !== undefined &&
      !(await hasPermission(
        supabase,
        context.userId,
        "ticket.update.priority",
      ))
    ) {
      throw new Error(
        "Você não tem permissão para alterar a prioridade.",
      );
    }

    /* --------------------------------------------------------
     * ATRIBUIÇÃO
     * -------------------------------------------------------- */

    if (
      data.atendenteId !== undefined &&
      !(await hasPermission(
        supabase,
        context.userId,
        "ticket.assign",
      ))
    ) {
      throw new Error(
        "Você não tem permissão para atribuir o chamado.",
      );
    }

    /* --------------------------------------------------------
     * TIPO
     * -------------------------------------------------------- */

    if (
      data.tipoChamadoId !== undefined &&
      !(await hasPermission(
        supabase,
        context.userId,
        "ticket.update.status",
      ))
    ) {
      throw new Error(
        "Você não tem permissão para alterar o tipo de chamado.",
      );
    }

    if (data.tipoChamadoId !== undefined) {
      const {
        data: tipo,
        error: tipoError,
      } = await admin
        .from("tipos_chamado")
        .select("id")
        .eq("id", data.tipoChamadoId)
        .eq("ativo", true)
        .maybeSingle();

      if (tipoError) {
        throw new Error(tipoError.message);
      }

      if (!tipo) {
        throw new Error(
          "O tipo de chamado selecionado não está disponível.",
        );
      }
    }

    /* --------------------------------------------------------
     * VALIDA RESPONSÁVEL
     * -------------------------------------------------------- */

    if (
      data.atendenteId !== undefined &&
      data.atendenteId !== null
    ) {
      const {
        data: targetRoles,
        error: targetError,
      } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.atendenteId);

      if (targetError) {
        throw new Error(
          targetError.message,
        );
      }

      if (
        !(targetRoles ?? []).some(
          (r: { role: Role }) =>
            hasAnyRolePermission(
              [r.role],
              "ticket.view.queue",
            ),
        )
      ) {
        throw new Error(
          "O responsável selecionado não possui perfil de atendimento.",
        );
      }
    }

    /* --------------------------------------------------------
     * MONTA UPDATE
     * -------------------------------------------------------- */

    const patch: Record<string, any> = {};
    const historico: any[] = [];

    /* --------------------------------------------------------
     * STATUS
     * -------------------------------------------------------- */

    if (
      data.status &&
      data.status !== ticket.status
    ) {
      patch.status = data.status;

      historico.push({
        chamado_id: data.chamadoId,
        autor_id: context.userId,
        acao:
          data.status === "reaberto"
            ? "chamado_reaberto"
            : "status_alterado",
        de: ticket.status,
        para: data.status,
      });

      if (data.status === "resolvido") {
        patch.resolvido_em =
          new Date().toISOString();
      }

      if (data.status === "fechado") {
        patch.fechado_em =
          new Date().toISOString();
      }

      /* ------------------------------------------------------
       * REABERTURA
       *
       * - registra reaberto_em
       * - retira pausa do SLA
       * - mantém atendente anterior
       * ------------------------------------------------------ */

      if (data.status === "reaberto") {
        patch.reaberto_em =
          new Date().toISOString();

        patch.sla_pausado = false;

        patch.atendente_id =
          ticket.atendente_id ?? null;
      }
    }

    /* --------------------------------------------------------
     * PRIORIDADE
     * -------------------------------------------------------- */

    if (
      data.prioridade &&
      data.prioridade !== ticket.prioridade
    ) {
      patch.prioridade = data.prioridade;

      historico.push({
        chamado_id: data.chamadoId,
        autor_id: context.userId,
        acao: "prioridade_alterada",
        de: ticket.prioridade,
        para: data.prioridade,
      });
    }

    /* --------------------------------------------------------
     * ATENDENTE
     * -------------------------------------------------------- */

    if (
      data.atendenteId !== undefined &&
      data.atendenteId !== ticket.atendente_id
    ) {
      patch.atendente_id =
        data.atendenteId;

      historico.push({
        chamado_id: data.chamadoId,
        autor_id: context.userId,
        acao: "atendente_alterado",
        de:
          ticket.atendente_id ?? "",
        para:
          data.atendenteId ?? "",
      });
    }

    /* --------------------------------------------------------
     * TIPO
     * -------------------------------------------------------- */

    if (
      data.tipoChamadoId !== undefined &&
      data.tipoChamadoId !==
        ticket.tipo_chamado_id
    ) {
      patch.tipo_chamado_id =
        data.tipoChamadoId;

      historico.push({
        chamado_id: data.chamadoId,
        autor_id: context.userId,
        acao: "tipo_chamado_alterado",
        de:
          ticket.tipo_chamado_id ?? "",
        para: data.tipoChamadoId,
      });
    }

    /* --------------------------------------------------------
     * NADA PARA ATUALIZAR
     * -------------------------------------------------------- */

    if (!Object.keys(patch).length) {
      return {
        ok: true,
        chamado: ticket,
      };
    }

    /* --------------------------------------------------------
     * UPDATE + CONFIRMAÇÃO DO BANCO
     *
     * Esta é a correção principal.
     * Não retornamos sucesso apenas porque o UPDATE não deu
     * erro. Pegamos o registro efetivamente persistido.
     * -------------------------------------------------------- */

    const {
      data: updatedTicket,
      error: updateError,
    } = await admin
      .from("chamados")
      .update(patch as never)
      .eq("id", data.chamadoId)
      .select("*")
      .single();

    if (updateError || !updatedTicket) {
      throw new Error(
        updateError?.message ??
          "Falha ao atualizar o chamado.",
      );
    }

    /* --------------------------------------------------------
     * CONFIRMA ESPECIFICAMENTE A REABERTURA
     * -------------------------------------------------------- */

    if (
      data.status === "reaberto" &&
      updatedTicket.status !== "reaberto"
    ) {
      throw new Error(
        "O banco não confirmou a reabertura do chamado.",
      );
    }

    if (
      data.status === "reaberto" &&
      !updatedTicket.reaberto_em
    ) {
      throw new Error(
        "O banco confirmou o status, mas não registrou a data de reabertura.",
      );
    }

    /* --------------------------------------------------------
     * CONFIRMA SLA
     * -------------------------------------------------------- */

    if (
      data.status === "reaberto" &&
      updatedTicket.sla_pausado !== false
    ) {
      throw new Error(
        "O chamado foi reaberto, mas o SLA continua pausado.",
      );
    }

    /* --------------------------------------------------------
     * HISTÓRICO
     * -------------------------------------------------------- */

    if (historico.length) {
      const {
        error: historicoError,
      } = await admin
        .from("historico_chamado")
        .insert(historico as never);

      if (historicoError) {
        throw new Error(
          historicoError.message,
        );
      }
    }

    /* --------------------------------------------------------
     * E-MAIL DE FECHAMENTO
     * -------------------------------------------------------- */

    if (
      data.status === "fechado" &&
      ticket.status !== "fechado"
    ) {
      const {
        data: solicitante,
      } = await admin
        .from("profiles")
        .select("email")
        .eq("id", ticket.solicitante_id)
        .maybeSingle();

      const {
        data: autor,
      } = await admin
        .from("profiles")
        .select("nome")
        .eq("id", context.userId)
        .maybeSingle();

      if (solicitante?.email) {
        await emailChamadoFechado({
          para: solicitante.email,
          numero: ticket.numero,
          titulo: ticket.titulo,
          autor:
            autor?.nome ?? "Atendimento",
          link: `${
            process.env.SERVICE_DESK_PUBLIC_URL ||
            process.env.APP_URL ||
            ""
          }/chamados/${ticket.id}`,
        });
      }
    }

    /* --------------------------------------------------------
     * RETORNO
     *
     * Agora a tela recebe o chamado que realmente está
     * persistido no banco.
     * -------------------------------------------------------- */

    return {
      ok: true,
      chamado: updatedTicket,
    };
  });

/* ============================================================
 * AVALIAR CHAMADO
 * ============================================================ */

export const avaliarChamado = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        chamadoId: z.string().uuid(),
        nota: z.number().int().min(1).max(5),
        comentario: z
          .string()
          .trim()
          .max(2000)
          .optional()
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;

    const {
      data: resultado,
      error,
    } = await supabase.rpc(
      "avaliar_chamado",
      {
        _chamado_id: data.chamadoId,
        _nota: data.nota,
        _comentario:
          data.comentario?.trim() || null,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    if (
      !resultado?.ok ||
      resultado.status !== "fechado"
    ) {
      throw new Error(
        "O banco não confirmou o fechamento do chamado.",
      );
    }

    return resultado;
  });
