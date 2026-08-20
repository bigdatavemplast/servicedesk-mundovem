import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Provedor compatível com a API OpenAI.
 *
 * O Assistente usa esta camada para não acoplar a aplicação a um provedor
 * específico. Configure a URL/modelo/chave no servidor, nunca no frontend.
 */
export function createAiProvider(config: {
  apiKey: string;
  baseURL: string;
  name?: string;
}) {
  return createOpenAICompatible({
    name: config.name ?? "ai-provider",
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });
}

/** Compatibilidade temporária para os consumidores atuais do Assistente. */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createAiProvider({
    apiKey,
    baseURL: "https://ai.gateway.lovable.dev/v1",
    name: "lovable",
  });
}

/** Modelo de chat atual. O provedor pode ser substituído por configuração. */
export const MODELO_CHAT = "openai/gpt-5.6-sol";

/** Modelo de embeddings atual (1536 dimensões). */
export const MODELO_EMBEDDING = "openai/text-embedding-3-small";

/**
 * Gera embedding através de um endpoint compatível com a API OpenAI.
 * A URL e a chave ficam no servidor e podem ser trocadas sem alterar o RAG.
 */
export async function gerarEmbedding(
  texto: string,
  config: { apiKey: string; baseURL: string; modelo?: string },
): Promise<number[]> {
  const baseURL = config.baseURL.replace(/\/$/, "");
  const resposta = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelo ?? MODELO_EMBEDDING,
      input: texto.slice(0, 8000),
    }),
  });

  if (!resposta.ok) {
    const detalhe = await resposta.text();
    throw Object.assign(new Error(`Falha ao gerar embedding: ${detalhe}`), {
      status: resposta.status,
    });
  }

  const json = (await resposta.json()) as {
    data?: Array<{ embedding: number[] }>;
  };
  const embedding = json.data?.[0]?.embedding;

  if (!embedding) {
    throw new Error("Resposta de embedding sem vetor");
  }

  return embedding;
}
