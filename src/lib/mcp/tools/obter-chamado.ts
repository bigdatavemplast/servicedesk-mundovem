import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "obter_chamado",
  title: "Obter chamado",
  description:
    "Retorna os detalhes completos de um chamado (por número SD-XXXXX ou id), incluindo comentários e histórico.",
  inputSchema: {
    numero: z.string().trim().min(1).describe("Número do chamado (ex.: SD-00042) ou o id UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ numero }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(numero);

    const { data: chamado, error } = await supabase
      .from("chamados")
      .select("*")
      .eq(isUuid ? "id" : "numero", numero)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!chamado) {
      return {
        content: [{ type: "text", text: `Chamado "${numero}" não encontrado ou sem permissão de acesso.` }],
        isError: true,
      };
    }

    const [{ data: comentarios }, { data: historico }] = await Promise.all([
      supabase
        .from("comentarios_chamado")
        .select("id, conteudo, interno, criado_em, autor_id")
        .eq("chamado_id", chamado.id)
        .order("criado_em"),
      supabase
        .from("historico_chamado")
        .select("id, acao, criado_em")
        .eq("chamado_id", chamado.id)
        .order("criado_em"),
    ]);

    const payload = { chamado, comentarios: comentarios ?? [], historico: historico ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
