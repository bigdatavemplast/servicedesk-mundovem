import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { hasPermission, type Role } from "@/lib/permissions";
import type { TipoChamado, TipoChamadoInsert, TipoChamadoUpdate } from "@/lib/types/tipos-chamado";

const tipoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do tipo de chamado.").max(100),
  descricao: z.string().trim().max(1000).nullable().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

function assertCanManage(role: Role) {
  if (!hasPermission(role, "service_desk.manage")) {
    throw new Error("Você não tem permissão para gerenciar tipos de chamado.");
  }
}

async function requireManager() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) throw new Error(`Não foi possível verificar as permissões: ${error.message}`);

  const allowed = (data ?? []).some(({ role }) => {
    try {
      assertCanManage(role as Role);
      return true;
    } catch {
      return false;
    }
  });

  if (!allowed) throw new Error("Você não tem permissão para gerenciar tipos de chamado.");
}

export const listarTiposChamado = createServerFn({ method: "GET" }).handler(async (): Promise<TipoChamado[]> => {
  const { data, error } = await supabase
    .from("tipos_chamado")
    .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error(`Não foi possível carregar os tipos de chamado: ${error.message}`);
  return (data ?? []) as TipoChamado[];
});

export const criarTipoChamado = createServerFn({ method: "POST" })
  .inputValidator(tipoSchema)
  .handler(async ({ data }): Promise<TipoChamado> => {
    await requireManager();
    const { data: created, error } = await supabase
      .from("tipos_chamado")
      .insert(data as TipoChamadoInsert)
      .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
      .single();

    if (error) throw new Error(error.code === "23505" ? "Já existe um tipo de chamado com esse nome." : error.message);
    return created as TipoChamado;
  });

export const atualizarTipoChamado = createServerFn({ method: "POST" })
  .inputValidator(idSchema.merge(tipoSchema.partial()))
  .handler(async ({ data }): Promise<TipoChamado> => {
    await requireManager();
    const { id, ...changes } = data;
    const { data: updated, error } = await supabase
      .from("tipos_chamado")
      .update(changes as TipoChamadoUpdate)
      .eq("id", id)
      .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
      .single();

    if (error) throw new Error(error.code === "23505" ? "Já existe um tipo de chamado com esse nome." : error.message);
    return updated as TipoChamado;
  });

export const alterarAtivoTipoChamado = createServerFn({ method: "POST" })
  .inputValidator(idSchema.extend({ ativo: z.boolean() }))
  .handler(async ({ data }): Promise<TipoChamado> => {
    await requireManager();
    const { data: updated, error } = await supabase
      .from("tipos_chamado")
      .update({ ativo: data.ativo })
      .eq("id", data.id)
      .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
      .single();

    if (error) throw new Error(error.message);
    return updated as TipoChamado;
  });

export const excluirTipoChamado = createServerFn({ method: "POST" })
  .inputValidator(idSchema)
  .handler(async ({ data }): Promise<void> => {
    await requireManager();
    const { count, error: countError } = await supabase
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("tipo_chamado_id", data.id);

    if (countError) throw new Error(`Não foi possível verificar os chamados vinculados: ${countError.message}`);
    if ((count ?? 0) > 0) {
      throw new Error("Não é possível excluir este tipo porque existem chamados vinculados. Desative-o para impedir novos usos.");
    }

    const { error } = await supabase.from("tipos_chamado").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });
