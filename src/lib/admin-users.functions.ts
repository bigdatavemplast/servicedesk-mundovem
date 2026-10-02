import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/types/roles";

async function assertPermission(supabase: any, userId: string, permission: Parameters<typeof hasPermission>[1]) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const allowed = (data ?? []).some((r: { role: Role }) => hasPermission(r.role, permission));
  if (!allowed) throw new Error("Forbidden: permissão insuficiente");
}

const roleEnum = z.enum(["colaborador", "atendente", "gestor", "admin"]);

async function resolveOrganizacao(supabase: any, departamento: string | null | undefined, areaId: string | null | undefined) {
  let departamentoNome = departamento?.trim() || null;
  let departamentoId: string | null = null;
  let area: { id: string; nome: string; departamento_id?: string | null } | null = null;

  if (areaId) {
    const { data, error } = await supabase.from("areas").select("id,nome,departamento_id").eq("id", areaId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Área selecionada não encontrada.");
    area = data;
  }

  if (departamentoNome) {
    const { data, error } = await supabase.from("departamentos").upsert({ nome: departamentoNome, ativo: true }, { onConflict: "nome" }).select("id,nome").single();
    if (error) throw new Error(error.message);
    departamentoId = data.id;
    departamentoNome = data.nome;
  } else if (area?.departamento_id) {
    const { data, error } = await supabase.from("departamentos").select("id,nome").eq("id", area.departamento_id).maybeSingle();
    if (error) throw new Error(error.message);
    departamentoId = data?.id ?? null;
    departamentoNome = data?.nome ?? null;
  }

  if (area?.departamento_id && departamentoId && area.departamento_id !== departamentoId) {
    throw new Error("A área selecionada não pertence ao departamento informado.");
  }

  return { departamentoNome, departamentoId, area };
}

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(255),
    senha: z.string().min(6).max(128),
    departamento: z.string().trim().max(120).optional().nullable(),
    areaId: z.string().uuid().optional().nullable(),
    role: roleEnum
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "users.manage");
    const organizacao = await resolveOrganizacao(context.supabase, data.departamento, data.areaId);

    const { data: result, error } = await context.supabase.functions.invoke("admin-user-auth", {
      body: {
        action: "create",
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        departamento: organizacao.departamentoNome,
        departamentoId: organizacao.departamentoId,
        areaId: data.areaId ?? null,
        role: data.role,
      },
    });
    if (error) throw new Error(error.message);
    if (result?.error) throw new Error(result.error);
    return { id: result.id };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(255).optional(),
    departamento: z.string().trim().max(120).nullable().optional(),
    areaId: z.string().uuid().nullable().optional(),
    ativo: z.boolean().optional(),
    senha: z.string().min(6).max(128).optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "users.manage");

    if (data.email || data.senha) {
      const { data: result, error } = await context.supabase.functions.invoke("admin-user-auth", {
        body: { action: "update", id: data.id, email: data.email, senha: data.senha },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
    }

    if (data.nome !== undefined || data.email !== undefined || data.ativo !== undefined || data.departamento !== undefined || data.areaId !== undefined) {
      const { error } = await context.supabase.from("profiles").update({
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
      } as never).eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    if (data.departamento !== undefined || data.areaId !== undefined) {
      const current = await context.supabase.from("profiles").select("departamento,area_id").eq("id", data.id).maybeSingle();
      if (current.error) throw new Error(current.error.message);
      const organizacao = await resolveOrganizacao(
        context.supabase,
        data.departamento !== undefined ? data.departamento : current.data?.departamento ?? null,
        data.areaId !== undefined ? data.areaId : current.data?.area_id ?? null,
      );
      const { error } = await context.supabase.from("profiles").update({
        departamento: organizacao.departamentoNome,
        departamento_id: organizacao.departamentoId,
        area_id: data.areaId !== undefined ? data.areaId : organizacao.area?.id ?? null,
      } as never).eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "users.manage");
    if (data.id === context.userId) throw new Error("Você não pode excluir a si mesmo");

    const { data: result, error } = await context.supabase.functions.invoke("admin-user-auth", {
      body: { action: "delete", id: data.id },
    });
    if (error) throw new Error(error.message);
    if (result?.error) throw new Error(result.error);
    return { ok: true };
  });

export const definirPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), role: roleEnum, add: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "roles.manage");
    if (data.add) {
      const { error } = await context.supabase.from("user_roles").insert({ user_id: data.userId, role: data.role } as never);
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
