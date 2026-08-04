import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buscarContexto, type Fonte } from "./assistente-rag.server";

type Ctx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  apiKey: string;
  /** Acumula fontes citadas durante a conversa para exibir na UI. */
  registrarFontes: (fontes: Fonte[]) => void;
};

const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;

/** Ferramentas que o assistente usa para conduzir a conversa de forma autônoma. */
export function criarFerramentasAssistente(ctx: Ctx) {
  return {
    buscar_conhecimento: tool({
      description:
        "Busca semântica na base interna (artigos da base de conhecimento, chamados resolvidos e documentos). " +
        "Use SEMPRE antes de sugerir diagnóstico ou abrir chamado.",
      inputSchema: z.object({
        consulta: z.string().describe("O problema ou dúvida do usuário, em linguagem natural"),
      }),
      execute: async ({ consulta }) => {
        const contexto = await buscarContexto(ctx.supabase, consulta, ctx.apiKey);
        ctx.registrarFontes(contexto.fontes);
        return {
          confianca: contexto.confianca,
          suficiente: contexto.confianca >= 0.62,
          trechos: contexto.bloco.slice(0, 8000) || null,
          fontes: contexto.fontes.map((f) => ({ titulo: f.titulo, origem: f.origem })),
        };
      },
    }),

    listar_categorias: tool({
      description:
        "Lista categorias e subcategorias ativas para classificar um chamado. Use antes de criar_chamado.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: categorias }, { data: subcategorias }] = await Promise.all([
          ctx.supabase.from("categorias").select("id, nome").eq("ativo", true).order("ordem"),
          ctx.supabase
            .from("subcategorias")
            .select("id, nome, categoria_id")
            .eq("ativo", true)
            .order("ordem"),
        ]);
        return {
          categorias: (categorias ?? []).map((c) => ({
            id: c.id,
            nome: c.nome,
            subcategorias: (subcategorias ?? [])
              .filter((s) => s.categoria_id === c.id)
              .map((s) => ({ id: s.id, nome: s.nome })),
          })),
        };
      },
    }),

    listar_meus_chamados: tool({
      description: "Lista os chamados do usuário atual, opcionalmente filtrando por status.",
      inputSchema: z.object({
        status: z.string().nullable().describe("Status exato ou null para todos"),
      }),
      execute: async ({ status }) => {
        let q = ctx.supabase
          .from("chamados")
          .select("numero, titulo, status, prioridade, aberto_em")
          .eq("solicitante_id", ctx.userId)
          .order("aberto_em", { ascending: false })
          .limit(15);
        if (status) q = q.eq("status", status as never);
        const { data, error } = await q;
        if (error) return { erro: error.message, chamados: [] };
        return { chamados: data ?? [] };
      },
    }),

    consultar_chamado: tool({
      description: "Consulta um chamado específico pelo número (ex.: SD-00042).",
      inputSchema: z.object({ numero: z.string() }),
      execute: async ({ numero }) => {
        const { data, error } = await ctx.supabase
          .from("chamados")
          .select(
            "numero, titulo, descricao, status, prioridade, aberto_em, respondido_em, resolvido_em, prazo_resolucao",
          )
          .eq("numero", numero.trim().toUpperCase())
          .maybeSingle();
        if (error) return { erro: error.message };
        if (!data) return { encontrado: false };
        return { encontrado: true, chamado: data };
      },
    }),

    criar_chamado: tool({
      description:
        "Abre um chamado no Service Desk. Só chame DEPOIS de o usuário confirmar explicitamente o resumo.",
      inputSchema: z.object({
        titulo: z.string(),
        descricao: z.string(),
        prioridade: z.enum(PRIORIDADES),
        categoria_id: z.string().nullable(),
        subcategoria_id: z.string().nullable(),
      }),
      execute: async ({ titulo, descricao, prioridade, categoria_id, subcategoria_id }) => {
        const { data, error } = await ctx.supabase
          .from("chamados")
          .insert({
            titulo: titulo.slice(0, 150),
            descricao,
            prioridade,
            solicitante_id: ctx.userId,
            categoria_id: categoria_id ?? null,
            subcategoria_id: subcategoria_id ?? null,
          } as never)
          .select("id, numero")
          .single();
        if (error) return { ok: false, erro: error.message };
        return { ok: true, numero: data.numero, id: data.id };
      },
    }),
  };
}
