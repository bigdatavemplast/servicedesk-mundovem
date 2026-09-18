import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasAnyRolePermission } from "@/lib/permissions";
import { emailChamadoAberto } from "@/lib/email.service";

const prioridadeEnum = z.enum(["baixa", "media", "alta", "critica"]);
const impactoEnum = z.enum(["empresa", "departamento", "usuario"]);
const urgenciaEnum = z.enum(["critica", "alta", "media", "baixa"]);
type Impacto = z.infer<typeof impactoEnum>;
type Urgencia = z.infer<typeof urgenciaEnum>;
type Prioridade = z.infer<typeof prioridadeEnum>;

type TipoFluxo =
  | "incidente"
  | "acesso"
  | "duvida"
  | "solicitacao"
  | "requisicao"
  | "triagem"
  | "melhoria"
  | "projeto";

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

function normalizarTipo(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/**
 * O tipo do chamado define o fluxo operacional e, portanto, a família de SLA.
 * Não agrupamos Acesso/Dúvida/Solicitação em Requisição porque cada um possui
 * prazo próprio no modelo ITIL definido para o Service Desk.
 */
function determinarFluxo(nome: string): TipoFluxo {
  const tipo = normalizarTipo(nome);

  if (tipo.includes("incidente") || tipo.includes("falha") || tipo.includes("erro")) return "incidente";
  if (tipo.includes("acesso")) return "acesso";
  if (tipo.includes("duvida") || tipo.includes("informacao") || tipo.includes("orientacao")) return "duvida";
  if (tipo.includes("solicitacao")) return "solicitacao";
  if (tipo.includes("requis")) return "requisicao";
  if (tipo.includes("melhoria")) return "melhoria";
  if (tipo.includes("projeto")) return "projeto";
  if (tipo.includes("triagem") || tipo.includes("outro") || tipo.includes("outros")) return "triagem";

  return "triagem";
}

function calcularPrioridade(impacto: Impacto, urgencia: Urgencia): Prioridade {
  const impactoNivel: Record<Impacto, number> = { empresa: 3, departamento: 2, usuario: 1 };
  const urgenciaNivel: Record<Urgencia, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
  const i = impactoNivel[impacto];
  const u = urgenciaNivel[urgencia];

  if (i === 3 && u >= 3) return "critica";
  if (i === 2 && u === 4) return "critica";
  if ((i === 3 && u === 2) || (i === 2 && u === 3) || (i === 1 && u === 4)) return "alta";
  if ((i === 3 && u === 1) || (i === 2 && u === 2) || (i === 1 && u === 3)) return "media";
  return "baixa";
}

export const criarChamadoComCatalogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    titulo: z.string().trim().min(1).max(250),
    descricao: z.string().trim().min(1),
    prioridade: prioridadeEnum.optional(),
    impacto: impactoEnum.optional(),
    urgencia: urgenciaEnum.optional(),
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
      .select("id,nome")
      .eq("id", data.tipoChamadoId)
      .eq("ativo", true)
      .maybeSingle();

    if (tipoError) throw new Error(tipoError.message);
    if (!tipo) throw new Error("O tipo de chamado selecionado não está disponível.");

    const fluxo = determinarFluxo(tipo.nome);
    const impacto = fluxo === "incidente" ? data.impacto : null;
    const urgencia = fluxo === "incidente" ? data.urgencia : null;

    if (fluxo === "incidente" && (!impacto || !urgencia)) {
      throw new Error("Para incidentes, informe impacto e urgência para calcular a prioridade.");
    }

    const prioridadeCalculada: Prioridade = fluxo === "incidente"
      ? calcularPrioridade(impacto!, urgencia!)
      : (data.prioridade ?? (fluxo === "projeto" ? "baixa" : "media"));

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

    const { data: grupos, error: gruposError } = await admin
      .from("grupos_atendimento")
      .select("id,nome,ordem,prefixo")
      .eq("segmento_id", data.segmentoId)
      .eq("ativo", true)
      .order("ordem")
      .order("nome");

    if (gruposError) throw new Error(gruposError.message);
    if (!grupos?.length) throw new Error("O segmento selecionado não possui uma fila ativa.");
    if (grupos.length !== 1) throw new Error("O segmento selecionado possui mais de uma fila ativa.");

    const grupoAtendimentoId = grupos[0].id;

    // Projetos não usam SLA operacional. O prazo do projeto será tratado
    // posteriormente por deadline/milestone, separado do motor de Service Desk.
    let regrasSla: any = null;

    if (fluxo !== "projeto") {
      const { data: regras, error: regraSlaError } = await admin.rpc("selecionar_regra_sla", {
        p_tipo_fluxo: fluxo,
        p_segmento_id: data.segmentoId,
        p_categoria_id: data.categoriaId,
        p_prioridade: prioridadeCalculada,
        p_impacto: impacto,
        p_urgencia: urgencia,
      });

      if (regraSlaError) {
        throw new Error(`Não foi possível determinar o SLA: ${regraSlaError.message}`);
      }

      regrasSla = regras;
    }

    const regraAplicada = Array.isArray(regrasSla) ? regrasSla[0] : regrasSla;

    if (!regraAplicada && fluxo !== "projeto") {
      throw new Error(`Não existe uma regra de SLA configurada para o fluxo ${fluxo}.`);
    }

    const { data: criado, error } = await admin
      .from("chamados")
      .insert({
        titulo: data.titulo,
        descricao: data.descricao,
        prioridade: prioridadeCalculada,
        impacto,
        urgencia,
        tipo_fluxo: fluxo,
        sla_regra_id: regraAplicada?.id ?? null,
        sla_tempo_resposta_segundos: regraAplicada?.tempo_resposta_segundos ?? null,
        sla_tempo_resolucao_segundos: regraAplicada?.tempo_resolucao_segundos ?? null,
        sla_tempo_pausado_segundos: 0,
        tipo_chamado_id: data.tipoChamadoId,
        segmento_id: data.segmentoId,
        grupo_atendimento_id: grupoAtendimentoId,
        solicitante_id: context.userId,
        categoria_id: data.categoriaId,
        subcategoria_id: data.subcategoriaId,
        numero: "",
      } as never)
      .select("id,numero,titulo,descricao,prioridade,impacto,urgencia,tipo_fluxo,sla_regra_id,sla_tempo_resposta_segundos,sla_tempo_resolucao_segundos,prazo_resolucao,tipo_chamado_id,segmento_id,categoria_id,subcategoria_id,grupo_atendimento_id")
      .single();

    if (error || !criado) throw new Error(error?.message ?? "Falha ao criar chamado");

    if (fluxo !== "projeto") {
      const { error: eventoError } = await admin.rpc("registrar_evento_sla", {
        p_chamado_id: criado.id,
        p_sla_regra_id: regraAplicada?.id ?? null,
        p_tipo: "iniciado",
        p_motivo: `SLA aplicado: ${regraAplicada.nome}`,
        p_usuario_id: context.userId,
      });

      if (eventoError) {
        throw new Error(`Chamado criado, mas não foi possível registrar o evento de SLA: ${eventoError.message}`);
      }
    }

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
