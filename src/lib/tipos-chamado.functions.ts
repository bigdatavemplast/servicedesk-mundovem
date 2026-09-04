import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasPermission, type Role } from "@/lib/permissions";
import type { TipoChamado, TipoChamadoInsert, TipoChamadoUpdate } from "@/lib/types/tipos-chamado";

const tipoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do tipo de chamado.").max(100),
  descricao: z.string().trim().max(1000).nullable().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().min(0).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

/** Revalida a permissão de gestão usando o cliente derivado do token da requisição. */
async function requireManager(client: any, userId: string) {
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(`Não foi possível verificar as permissões: ${error.message}`);

  const allowed = (data ?? []).some(({ role }: { role: Role }) => hasPermission(role, "service_desk.manage"));
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
  .middleware([requireSupabaseAuth])
  .inputValidator(tipoSchema)
  .handler(async ({ data, context }): Promise<TipoChamado> => {
    await requireManager(context.supabase, context.userId);
    const { data: created, error } = await (context.supabase as any)
      .from("tipos_chamado")
      .insert(data as TipoChamadoInsert)
      .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
      .single();

    if (error) throw new Error(error.code === "23505" ? "Já existe um tipo de chamado com esse nome." : error.message);
    return created as TipoChamado;
  });

export const atualizarTipoChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema.merge(tipoSchema.partial()))
  .handler(async ({ data, context }): Promise<TipoChamado> => {
    await requireManager(context.supabase, context.userId);
    const { id, ...changes } = data;
    const { data: updated, error } = await (context.supabase as any)
      .from("tipos_chamado")
      .update(changes as TipoChamadoUpdate)
      .eq("id", id)
      .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
      .single();

    if (error) throw new Error(error.code === "23505" ? "Já existe um tipo de chamado com esse nome." : error.message);
    return updated as TipoChamado;
  });

export const alterarAtivoTipoChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema.extend({ ativo: z.boolean() }))
  .handler(async ({ data, context }): Promise<TipoChamado> => {
    await requireManager(context.supabase, context.userId);
    const { data: updated, error } = await (context.supabase as any)
      .from("tipos_chamado")
      .update({ ativo: data.ativo })
      .eq("id", data.id)
      .select("id, nome, descricao, ativo, ordem, criado_em, atualizado_em")
      .single();

    if (error) throw new Error(error.message);
    return updated as TipoChamado;
  });

export const excluirTipoChamado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idSchema)
  .handler(async ({ data, context }): Promise<void> => {
    await requireManager(context.supabase, context.userId);
    const { count, error: countError } = await (context.supabase as any)
      .from("chamados")
      .select("id", { count: "exact", head: true })
      .eq("tipo_chamado_id", data.id);

    if (countError) throw new Error(`Não foi possível verificar os chamados vinculados: ${countError.message}`);
    if ((count ?? 0) > 0) {
      throw new Error("Não é possível excluir este tipo porque existem chamados vinculados. Desative-o para impedir novos usos.");
    }

    const { error } = await (context.supabase as any).from("tipos_chamado").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
  });

