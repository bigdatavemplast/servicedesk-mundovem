import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: any) => r.role === "admin")) throw new Error("Forbidden: admin only");
}

const roleEnum = z.enum(["colaborador", "atendente", "gestor", "admin"]);

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      nome: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(255),
      senha: z.string().min(6).max(128),
      departamento: z.string().trim().max(120).optional().nullable(),
      areaId: z.string().uuid().optional().nullable(),
      role: roleEnum,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const uid = created.user.id;
    let departamento = data.departamento ?? null;
    let areaId = data.areaId ?? null;
    if (!areaId && departamento) {
      const { data: area } = await (supabaseAdmin as any)
        .from("areas")
        .upsert({ nome: departamento.trim(), ativo: true }, { onConflict: "nome" })
        .select("id,nome")
        .single();
      areaId = area?.id ?? null;
    }
    if (areaId) {
      const { data: area } = await (supabaseAdmin as any).from("areas").select("nome").eq("id", areaId).maybeSingle();
      if (area?.nome) departamento = area.nome;
    }
    const { error: pErr } = await supabaseAdmin.from("profiles").upsert({
      id: uid,
      nome: data.nome,
      email: data.email,
      departamento,
      area_id: areaId,
      ativo: true,
    } as never);
    if (pErr) throw new Error(pErr.message);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role } as never);
    if (rErr) throw new Error(rErr.message);
    return { id: uid };
  });

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      nome: z.string().trim().min(1).max(120).optional(),
      email: z.string().trim().email().max(255).optional(),
      departamento: z.string().trim().max(120).nullable().optional(),
      areaId: z.string().uuid().nullable().optional(),
      ativo: z.boolean().optional(),
      senha: z.string().min(6).max(128).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authUpdate: any = {};
    if (data.email) authUpdate.email = data.email;
    if (data.senha) authUpdate.password = data.senha;
    if (Object.keys(authUpdate).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, authUpdate);
      if (error) throw new Error(error.message);
    }

    const profUpdate: any = {};
    if (data.nome !== undefined) profUpdate.nome = data.nome;
    if (data.email !== undefined) profUpdate.email = data.email;
    if (data.departamento !== undefined) profUpdate.departamento = data.departamento;
    if (data.areaId !== undefined) {
      let areaId = data.areaId;
      if (!areaId && data.departamento) {
        const { data: area } = await (supabaseAdmin as any)
          .from("areas")
          .upsert({ nome: data.departamento.trim(), ativo: true }, { onConflict: "nome" })
          .select("id,nome")
          .single();
        areaId = area?.id ?? null;
      }
      profUpdate.area_id = areaId;
      if (areaId) {
        const { data: area } = await (supabaseAdmin as any).from("areas").select("nome").eq("id", areaId).maybeSingle();
        if (area?.nome) profUpdate.departamento = area.nome;
      }
    }
    if (data.ativo !== undefined) profUpdate.ativo = data.ativo;
    if (Object.keys(profUpdate).length) {
      const { error } = await supabaseAdmin.from("profiles").update(profUpdate as never).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const excluirUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const definirPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), role: roleEnum, add: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.add) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role } as never);
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      if (data.userId === context.userId && data.role === "admin") {
        throw new Error("Você não pode remover seu próprio papel de admin");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
