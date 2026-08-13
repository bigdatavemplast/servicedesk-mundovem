import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { emailInteracao } from "@/lib/email.service";

export default defineTool({
  name: "comentar_chamado",
  title: "Comentar chamado",
  description:
    "Adiciona um comentário a um chamado existente. Use interno=true para uma nota visível apenas para a equipe de atendimento.",
  inputSchema: {
    numero: z.string().trim().min(1).describe("Número do chamado (ex.: SD-00042) ou o id UUID."),
    mensagem: z.string().trim().min(1).describe("Texto do comentário."),
    interno: z.boolean().default(false).describe("Se verdadeiro, o comentário é uma nota interna."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ numero, mensagem, interno }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(numero);

    const { data: chamado, error: findError } = await supabase
      .from("chamados")
      .select("id, numero, titulo, status, prioridade, solicitante_id, sla_pausado")
      .eq(isUuid ? "id" : "numero", numero)
      .maybeSingle();

    if (findError) return { content: [{ type: "text", text: findError.message }], isError: true };
    if (!chamado) {
      return {
        content: [{ type: "text", text: `Chamado "${numero}" não encontrado ou sem permissão de acesso.` }],
        isError: true,
      };
    }

    const { data, error } = await supabase
      .from("comentarios_chamado")
      .insert({
        chamado_id: chamado.id,
        autor_id: ctx.getUserId() as string,
        conteudo: mensagem,
        interno: interno ?? false,
      })
      .select("id, conteudo, interno, criado_em")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!interno) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", ctx.getUserId() as string);
      const staff = (roles ?? []).some((r: any) => ["atendente", "gestor", "admin"].includes(r.role));
      if (staff && chamado.solicitante_id !== ctx.getUserId()) {
        const { data: solicitante } = await supabase.from("profiles").select("nome,email").eq("id", chamado.solicitante_id).maybeSingle();
        const { data: autor } = await supabase.from("profiles").select("nome").eq("id", ctx.getUserId() as string).maybeSingle();
        if (solicitante?.email) {
          const origin = process.env.SERVICE_DESK_PUBLIC_URL || process.env.APP_URL || "";
          await emailInteracao({
            para: solicitante.email,
            numero: chamado.numero,
            titulo: chamado.titulo,
            autor: autor?.nome ?? "Atendimento",
            mensagem: mensagem,
            status: chamado.status,
            slaStatus: chamado.sla_pausado ? "Pausado" : "Em contagem",
            link: `${origin}/chamados/${chamado.id}`,
          });
        }
      }
    }

    return {
      content: [{ type: "text", text: `Comentário adicionado ao chamado ${chamado.numero}.` }],
      structuredContent: { comentario: data },
    };
  },
});
