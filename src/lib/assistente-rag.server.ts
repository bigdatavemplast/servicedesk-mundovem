import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { gerarEmbedding } from "./ai-gateway.server";

export type Fonte = {
  origem: "base_conhecimento" | "chamado" | "documento";
  ref_id: string;
  titulo: string;
  similaridade: number;
};

export type ContextoRag = {
  fontes: Fonte[];
  bloco: string;
  confianca: number;
};

const LIMITE_SIMILARIDADE = 0.55;

/** Busca semântica unificada (Base de conhecimento > chamados resolvidos > documentos). */
export async function buscarContexto(
  supabase: SupabaseClient<Database>,
  pergunta: string,
  apiKey: string,
): Promise<ContextoRag> {
  let embedding: number[];
  try {
    embedding = await gerarEmbedding(pergunta, apiKey);
  } catch (erro) {
    console.error("[assistente] embedding falhou", erro);
    return { fontes: [], bloco: "", confianca: 0 };
  }

  const { data, error } = await supabase.rpc("match_conhecimento", {
    query_embedding: embedding as unknown as string,
    match_threshold: LIMITE_SIMILARIDADE,
    match_count: 8,
  });

  if (error) {
    console.error("[assistente] busca semântica falhou", error);
    return { fontes: [], bloco: "", confianca: 0 };
  }

  const linhas = (data ?? []) as Array<{
    origem: string;
    ref_id: string;
    titulo: string;
    conteudo: string | null;
    similarity: number;
  }>;

  const fontes: Fonte[] = linhas.map((l) => ({
    origem: l.origem as Fonte["origem"],
    ref_id: l.ref_id,
    titulo: l.titulo,
    similaridade: Number(l.similarity.toFixed(4)),
  }));

  const bloco = linhas
    .map((l, i) => {
      const rotulo =
        l.origem === "base_conhecimento"
          ? "Base de conhecimento"
          : l.origem === "chamado"
            ? "Chamado resolvido"
            : "Documento interno";
      return `[${i + 1}] (${rotulo}) ${l.titulo}\n${(l.conteudo ?? "").slice(0, 2500)}`;
    })
    .join("\n\n---\n\n");

  const confianca = linhas.length ? Number(Math.max(...linhas.map((l) => l.similarity)).toFixed(4)) : 0;

  return { fontes, bloco, confianca };
}

/** Prompt de sistema do Assistente Mundo Vem. */
export function montarSystemPrompt(contexto: ContextoRag, nomeUsuario: string | null) {
  return [
    "Você é o Assistente Inteligente do Mundo Vem Service Desk (empresa Vemplast).",
    "Responda SEMPRE em português do Brasil, de forma objetiva, cordial e passo a passo quando fizer sentido.",
    "Seu papel é apoiar colaboradores em dúvidas de TI, processos internos, ERP Senior e uso do portal de chamados,",
    "reduzindo aberturas desnecessárias de chamados.",
    "",
    "REGRAS:",
    "1. Baseie-se prioritariamente no CONTEXTO abaixo. Cite as fontes usadas com os marcadores [1], [2] etc.",
    "2. Se o contexto não trouxer a resposta, diga com clareza que não encontrou essa informação na base interna,",
    "   ofereça o melhor direcionamento geral e sugira abrir um chamado em /chamados/novo.",
    "3. Nunca invente números de chamado, políticas, prazos, valores ou telas que não estejam no contexto.",
    "4. Não solicite nem repita senhas, tokens ou dados sensíveis.",
    "5. Use markdown (listas, negrito, blocos de código) para deixar a resposta fácil de seguir.",
    "6. Mantenha respostas curtas: no máximo cerca de 250 palavras, salvo se o usuário pedir mais detalhe.",
    nomeUsuario ? `\nUsuário atual: ${nomeUsuario}.` : "",
    "",
    contexto.bloco
      ? `CONTEXTO RECUPERADO:\n${contexto.bloco}`
      : "CONTEXTO RECUPERADO: (nenhum trecho relevante encontrado na base interna)",
  ].join("\n");
}
