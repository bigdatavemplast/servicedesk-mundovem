import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ItsmModule = "problemas" | "mudancas" | "ativos" | "relacionamentos" | "servicos" | "catalogo" | "conhecimento" | "auditoria" | "governanca";
export type ItsmPermission = "visualizar" | "criar" | "editar" | "atribuir" | "excluir";

export function useItsmPermissions(modulo: ItsmModule) {
  return useQuery({
    queryKey: ["itsm-permissions", modulo],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return { visualizar: false, criar: false, editar: false, atribuir: false, excluir: false };

      const [{ data: permission, error: permissionError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("itsm_permissoes_usuario").select("visualizar,criar,editar,atribuir,excluir").eq("user_id", userId).eq("modulo", modulo).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (permissionError) throw permissionError;
      if (rolesError) throw rolesError;

      const admin = (roles ?? []).some((role) => role.role === "admin");
      return {
        visualizar: admin || !!permission?.visualizar,
        criar: admin || !!permission?.criar,
        editar: admin || !!permission?.editar,
        atribuir: admin || !!permission?.atribuir,
        excluir: admin || !!permission?.excluir,
      };
    },
    staleTime: 60_000,
  });
}

export function canItsmAction(permissions: ReturnType<typeof useItsmPermissions>["data"], action: ItsmPermission) {
  return !!permissions?.[action];
}
