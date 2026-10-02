import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@/types/roles";

const roleEnum = z.enum(["colaborador", "atendente", "gestor", "admin"]);

export const definirPapel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    role: roleEnum,
    add: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (rolesError) throw new Error(rolesError.message);

    const allowed = (roles ?? []).some((r: { role: Role }) => hasPermission(r.role, "roles.manage"));
    if (!allowed) throw new Error("Forbidden: permissão insuficiente");

    if (data.add) {
      const { error } = await context.supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role } as never);
      if (error && !String(error.message).toLowerCase().includes("duplicate")) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role as any);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
