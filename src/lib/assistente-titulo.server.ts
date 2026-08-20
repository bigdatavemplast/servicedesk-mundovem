import { generateText } from "ai";
import { createAiProvider, MODELO_CHAT } from "@/lib/ai-gateway.server";

const TITULOS_PADRAO = new Set(["nova conversa", "nova conversa ia"]);
const TAMANHO_MAX_TITULO = 60;

type AiConfig = {
  apiKey: string;
  baseURL: string;
  model?: string;
};

export function tituloEhPadrao(titulo: string | null | undefined): boolean {
  if (!titulo) return true;
  return TITULOS_PADRAO.has(titulo.trim().toLowerCase());
}

function tituloFallback(mensagem: string): string {
  const limpo = mensagem.replace(/\s+/g, " ").trim();
  if (!limpo) return "Nova conversa";
  if (limpo.length <= TAMANHO_MAX_TITULO) return limpo;
  return limpo.slice(0, TAMANHO_MAX_TITULO).trimEnd() + "…";
}

function limparTitulo(texto: string): string {
  let t = (texto.split("\n")[0] ?? "").trim();
  t = t.replace(/^["'«»“”'`]+|["'«»“”'`]+$/g, "").trim();
  t = t.replace(/[.!?…]+$/g, "").trim();
  if (!t) return "";
  if (t.length <= TAMANHO_MAX_TITULO) return t;
  return t.slice(0, TAMANHO_MAX_TITULO).trimEnd() + "…";
}

export async function gerarTituloConversa(
  primeiraMensagem: string,
  ai: AiConfig,
): Promise<string> {
  const fallback = tituloFallback(primeiraMensagem);
  if (!primeiraMensagem.trim()) return fallback;

  try {
    const gateway = createAiProvider({
      apiKey: ai.apiKey,
      baseURL: ai.baseURL,
      name: "ai-provider",
    });
    const { text } = await generateText({
      model: gateway(ai.model ?? MODELO_CHAT),
      system:
        "Você gera títulos para conversas de um service desk corporativo. " +
        "A partir da primeira mensagem do usuário, responda APENAS com um título curto e descritivo " +
        "em português, de 3 a 8 palavras, que resuma o assunto da conversa. " +
        "Sem aspas, sem pontuação final, sem prefixos como 'Título:'. " +
        "Não inclua nomes de pessoas, e-mails, senhas ou dados sensíveis.",
      prompt: primeiraMensagem.slice(0, 500),
    });
    return limparTitulo(text) || fallback;
  } catch (erro) {
    console.error("[assistente] falha ao gerar título, usando fallback", erro);
    return fallback;
  }
}
