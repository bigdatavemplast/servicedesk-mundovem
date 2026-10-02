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

export const atualizarPerfilAdministrativo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    nome: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(255).optional(),
    departamento: z.string().trim().max(120).nullable().optional(),
    areaId: z.string().uuid().nullable().optional(),
    ativo: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "users.manage");

    const profUpdate: Record<string, unknown> = {};
    if (data.nome !== undefined) profUpdate.nome = data.nome;
    if (data.email !== undefined) profUpdate.email = data.email;
    if (data.ativo !== undefined) profUpdate.ativo = data.ativo;

    if (data.departamento !== undefined || data.areaId !== undefined) {
      const { data: current, error: currentError } = await context.supabase
        .from("profiles")
        .select("departamento,departamento_id,area_id")
        .eq("id", data.id)
        .maybeSingle();
      if (currentError) throw new Error(currentError.message);

      const departamentoNome = data.departamento !== undefined
        ? data.departamento?.trim() || null
        : current?.departamento ?? null;
      const areaId = data.areaId !== undefined ? data.areaId : current?.area_id ?? null;

      let departamentoId: string | null = null;
      let area: { id: string; nome: string; departamento_id?: string | null } | null = null;

      if (areaId) {
        const { data: areaData, error: areaError } = await context.supabase
          .from("areas")
          .select("id,nome,departamento_id")
          .eq("id", areaId)
          .maybeSingle();
        if (areaError) throw new Error(areaError.message);
        if (!areaData) throw new Error("Área selecionada não encontrada.");
        area = areaData;
      }

      let departamentoFinal = departamentoNome;
      if (departamentoNome) {
        const { data: dep, error: depError } = await context.supabase
          .from("departamentos")
          .upsert({ nome: departamentoNome, ativo: true }, { onConflict: "nome" })
          .select("id,nome")
          .single();
        if (depError) throw new Error(depError.message);
        departamentoId = dep.id;
        departamentoFinal = dep.nome;
      } else if (area?.departamento_id) {
        const { data: dep, error: depError } = await context.supabase
          .from("departamentos")
          .select("id,nome")
          .eq("id", area.departamento_id)
          .maybeSingle();
        if (depError) throw new Error(depError.message);
        departamentoId = dep?.id ?? null;
        departamentoFinal = dep?.nome ?? null;
      }

      if (area?.departamento_id && departamentoId && area.departamento_id !== departamentoId) {
        throw new Error("A área selecionada não pertence ao departamento informado.");
      }

      profUpdate.departamento = departamentoFinal;
      profUpdate.departamento_id = departamentoId;
      profUpdate.area_id = areaId;
    }

    if (Object.keys(profUpdate).length) {
      const { error } = await context.supabase
        .from("profiles")
        .update(profUpdate as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
