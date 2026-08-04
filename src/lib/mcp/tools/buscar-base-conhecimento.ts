import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "buscar_base_conhecimento",
  title: "Buscar na base de conhecimento",
  description:
    "Busca artigos publicados na base de conhecimento do Service Desk por termo no título ou conteúdo.",
  inputSchema: {
    termo: z.string().trim().min(2).describe("Termo de busca."),
    limite: z.number().int().min(1).max(20).default(5).describe("Quantidade máxima de artigos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ termo, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    // Escapa curingas/reservados do PostgREST para o termo não alterar a lógica do filtro.
    const termoSeguro = termo.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/[(),.:"']/g, " ");
    const { data, error } = await supabase
      .from("base_conhecimento")
      .select("id, titulo, conteudo, criado_em")
      .or(`titulo.ilike."%${termoSeguro}%",conteudo.ilike."%${termoSeguro}%"`)
      .limit(limite ?? 5);


    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) {
      return { content: [{ type: "text", text: `Nenhum artigo encontrado para "${termo}".` }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { artigos: data },
    };
  },
});
