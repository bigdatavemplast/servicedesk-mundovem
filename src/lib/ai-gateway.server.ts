import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const AI_BASE_URL_PADRAO = "https://api.groq.com/openai/v1";
export const MODELO_CHAT_PADRAO = "openai/gpt-oss-120b";

export function createAiProvider(config: {
  apiKey: string;
  baseURL?: string;
  name?: string;
}) {
  return createOpenAICompatible({
    name: config.name ?? "ai-provider",
    baseURL: config.baseURL ?? AI_BASE_URL_PADRAO,
    apiKey: config.apiKey,
  });
}

/** Compatibilidade temporária para consumidores legados. */
export function createLovableAiGatewayProvider(apiKey: string) {
  return createAiProvider({
    apiKey,
    baseURL: "https://ai.gateway.lovable.dev/v1",
    name: "lovable",
  });
}

export const MODELO_CHAT = MODELO_CHAT_PADRAO;

/**
 * Gera embedding por endpoint OpenAI-compatible.
 * O provider de embeddings permanece separado do provider de chat.
 */
export async function gerarEmbedding(
  texto: string,
  config: { apiKey: string; baseURL: string; modelo: string },
): Promise<number[]> {
  const baseURL = config.baseURL.replace(/\/$/, "");
  const resposta = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelo,
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

  if (!embedding) throw new Error("Resposta de embedding sem vetor");
  return embedding;
}
