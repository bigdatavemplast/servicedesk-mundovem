import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const STATUS = [
  "aberto",
  "em_andamento",
  "aguardando_usuario",
  "aguardando_terceiro",
  "resolvido",
  "fechado",
  "cancelado",
] as const;

export default defineTool({
  name: "listar_chamados",
  title: "Listar chamados",
  description:
    "Lista os chamados do Service Desk visíveis para o usuário autenticado, com filtros opcionais de status, prioridade e busca por título.",
  inputSchema: {
    status: z.enum(STATUS).optional().describe("Filtrar por status do chamado."),
    prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional().describe("Filtrar por prioridade."),
    busca: z.string().trim().min(1).optional().describe("Texto para buscar no título do chamado."),
    limite: z.number().int().min(1).max(50).default(20).describe("Quantidade máxima de chamados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, prioridade, busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("chamados")
      .select("id, numero, titulo, status, prioridade, aberto_em, resolvido_em, atendente_id, solicitante_id")
      .order("aberto_em", { ascending: false })
      .limit(limite ?? 20);

    if (status) query = query.eq("status", status);
    if (prioridade) query = query.eq("prioridade", prioridade);
    if (busca) query = query.ilike("titulo", `%${busca}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { chamados: data ?? [], total: data?.length ?? 0 },
    };
  },
});
