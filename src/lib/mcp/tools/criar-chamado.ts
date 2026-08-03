import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "criar_chamado",
  title: "Abrir chamado",
  description:
    "Abre um novo chamado no Service Desk em nome do usuário autenticado. O número SD-XXXXX é gerado automaticamente.",
  inputSchema: {
    titulo: z.string().trim().min(3).describe("Título curto e objetivo do chamado."),
    descricao: z.string().trim().min(3).describe("Descrição detalhada do problema ou solicitação."),
    prioridade: z
      .enum(["baixa", "media", "alta", "critica"])
      .default("media")
      .describe("Prioridade do chamado."),
    categoria_id: z.string().uuid().optional().describe("Id da categoria (opcional)."),
    subcategoria_id: z.string().uuid().optional().describe("Id da subcategoria (opcional)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ titulo, descricao, prioridade, categoria_id, subcategoria_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("chamados")
      .insert({
        titulo,
        descricao,
        prioridade: prioridade ?? "media",
        solicitante_id: ctx.getUserId() as string,
        categoria_id: categoria_id ?? null,
        subcategoria_id: subcategoria_id ?? null,
        numero: "", // gerado pelo trigger
      })
      .select("id, numero, titulo, status, prioridade, aberto_em")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [
        {
          type: "text",
          text: `Chamado ${data?.numero ?? ""} criado com sucesso.\n${JSON.stringify(data, null, 2)}`,
        },
      ],
      structuredContent: { chamado: data },
    };
  },
});
