import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRolePermission } from "@/lib/permissions";
import { emailChamadoAberto } from "@/lib/email.service";

const prioridadeEnum = z.enum(["baixa", "media", "alta", "critica"]);

async function getAdminClient(fallback: any) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return fallback;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function hasPermission(supabase: any, userId: string, permission: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return hasAnyRolePermission((data ?? []).map((r: { role: any }) => r.role), permission as never);
}

export const criarChamadoComCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    titulo: z.string().trim().min(1).max(250),
    descricao: z.string().trim().min(1),
    prioridade: prioridadeEnum,
    tipoChamadoId: z.string().uuid(),
    segmentoId: z.string().uuid(),
    categoriaId: z.string().uuid(),
    subcategoriaId: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await hasPermission(context.supabase, context.userId, "ticket.create"))) {
      throw new Error("Você não tem permissão para criar chamados.");
    }

    const admin = await getAdminClient(context.supabase);

    const { data: tipo, error: tipoError } = await admin
      .from("tipos_chamado")
      .select("id")
      .eq("id", data.tipoChamadoId)
      .eq("ativo", true)
      .maybeSingle();
    if (tipoError) throw new Error(tipoError.message);
    if (!tipo) throw new Error("O tipo de chamado selecionado não está disponível.");

    const { data: segmento, error: segmentoError } = await admin
      .from("segmentos")
      .select("id")
      .eq("id", data.segmentoId)
      .eq("ativo", true)
      .maybeSingle();
    if (segmentoError) throw new Error(segmentoError.message);
    if (!segmento) throw new Error("O segmento selecionado não está disponível.");

    const { data: categoria, error: categoriaError } = await admin
      .from("categorias")
      .select("id,segmento_id")
      .eq("id", data.categoriaId)
      .eq("ativo", true)
      .maybeSingle();
    if (categoriaError) throw new Error(categoriaError.message);
    if (!categoria) throw new Error("A categoria selecionada não está disponível.");
    if (categoria.segmento_id !== data.segmentoId) {
      throw new Error("A categoria selecionada não pertence ao segmento informado.");
    }

    if (data.subcategoriaId) {
      const { data: subcategoria, error: subcategoriaError } = await admin
        .from("subcategorias")
        .select("id,categoria_id")
        .eq("id", data.subcategoriaId)
        .eq("ativo", true)
        .maybeSingle();
      if (subcategoriaError) throw new Error(subcategoriaError.message);
      if (!subcategoria) throw new Error("A subcategoria selecionada não está disponível.");
      if (subcategoria.categoria_id !== data.categoriaId) {
        throw new Error("A subcategoria selecionada não pertence à categoria informada.");
      }
    }

    // A fila pertence ao segmento. Quando existe uma única fila ativa para o segmento,
    // o encaminhamento é determinístico e pode ser feito já na abertura.
    // Quando existem várias filas, deixamos a fila em aberto para a etapa de
    // atribuição automática, evitando escolher uma fila arbitrariamente.
    const { data: grupos, error: gruposError } = await admin
      .from("grupos_atendimento")
      .select("id,nome,ordem")
      .eq("segmento_id", data.segmentoId)
      .eq("ativo", true)
      .order("ordem")
      .order("nome");

    if (gruposError) throw new Error(gruposError.message);

    const grupoAtendimentoId = grupos?.length === 1 ? grupos[0].id : null;

    const { data: criado, error } = await admin
      .from("chamados")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: data.prioridade,
        tipo_chamado_id: data.tipoChamadoId,
        segmento_id: data.segmentoId,
        grupo_atendimento_id: grupoAtendimentoId,
        solicitante_id: context.userId,
        categoria_id: data.categoriaId,
        subcategoria_id: data.subcategoriaId,
        numero: "",
      } as never)
      .select("id,numero,titulo,descricao,prioridade,prazo_resolucao,tipo_chamado_id,segmento_id,categoria_id,subcategoria_id,grupo_atendimento_id")
      .single();

    if (error || !criado) throw new Error(error?.message ?? "Falha ao criar chamado");

    const { data: profile } = await admin
      .from("profiles")
      .select("nome,email,departamento,area_id")
      .eq("id", context.userId)
      .maybeSingle();

    const { data: area } = profile?.area_id
      ? await (admin as any).from("areas").select("nome").eq("id", profile.area_id).maybeSingle()
      : { data: null as any };

    const n1 = process.env.SERVICE_DESK_N1_EMAIL;
    if (n1) {
      await emailChamadoAberto({
        para: n1,
        numero: criado.numero,
        titulo: criado.titulo,
        solicitante: profile?.nome ?? context.userId,
        area: area?.nome ?? profile?.departamento ?? "Sem área",
        prioridade: criado.prioridade,
        descricao: criado.descricao,
        prazoSla: criado.prazo_resolucao,
        link: `${process.env.SERVICE_DESK_PUBLIC_URL || process.env.APP_URL || ""}/chamados/${criado.id}`,
      });
    }

    return criado;
  });
