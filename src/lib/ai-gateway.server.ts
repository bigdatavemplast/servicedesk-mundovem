import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Provider do Lovable AI Gateway (troca de provedor sem mexer na UI). */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

/** Modelo de chat padrão do Assistente. */
export const MODELO_CHAT = "openai/gpt-5.6-sol";

/** Modelo de embeddings (1536 dimensões, igual às colunas do banco). */
export const MODELO_EMBEDDING = "openai/text-embedding-3-small";

/** Gera o embedding de um texto usando o Lovable AI Gateway. */
export async function gerarEmbedding(texto: string, apiKey: string): Promise<number[]> {
  const resposta = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODELO_EMBEDDING,
      input: texto.slice(0, 8000),
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw Object.assign(new Error(`Falha ao gerar embedding: ${detalhe}`), {
      status: resposta.status,
    });
  }

  const json = (await resposta.json()) as { data?: Array<{ embedding: number[] }> };
  const embedding = json.data?.[0]?.embedding;
  if (!embedding) throw new Error("Resposta de embedding sem vetor");
  return embedding;
}
