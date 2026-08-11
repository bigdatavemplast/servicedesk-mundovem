import { generateText } from "ai";
import { createLovableAiGatewayProvider, MODELO_CHAT } from "@/lib/ai-gateway.server";

/** Títulos padrão (sem significado) que podem ser substituídos por um título inteligente. */
const TITULOS_PADRAO = new Set(["nova conversa", "nova conversa ia"]);

const TAMANHO_MAX_TITULO = 60;

/** Uma conversa só recebe título automático enquanto ainda tiver o título padrão. */
export function tituloEhPadrao(titulo: string | null | undefined): boolean {
  if (!titulo) return true;
  return TITULOS_PADRAO.has(titulo.trim().toLowerCase());
}

/** Fallback: versão limpa e curta da primeira mensagem do usuário. */
function tituloFallback(mensagem: string): string {
  const limpo = mensagem.replace(/\s+/g, " ").trim();
  if (!limpo) return "Nova conversa";
  if (limpo.length <= TAMANHO_MAX_TITULO) return limpo;
  return limpo.slice(0, TAMANHO_MAX_TITULO).trimEnd() + "…";
}

/** Higieniza a resposta da IA: uma linha, sem aspas/pontuação final, tamanho limitado. */
function limparTitulo(texto: string): string {
  let t = (texto.split("\n")[0] ?? "").trim();
  t = t.replace(/^["'«»“”'`]+|["'«»“”'`]+$/g, "").trim();
  t = t.replace(/[.!?…]+$/g, "").trim();
  if (!t) return "";
  if (t.length <= TAMANHO_MAX_TITULO) return t;
  return t.slice(0, TAMANHO_MAX_TITULO).trimEnd() + "…";
}

/**
 * Gera um título curto e descritivo (3 a 8 palavras) para a conversa a partir
 * da primeira mensagem do usuário. Se a IA falhar, usa um resumo limpo da
 * própria mensagem como fallback. Nunca lança erro.
 */
export async function gerarTituloConversa(
  primeiraMensagem: string,
  apiKey: string,
): Promise<string> {
  const fallback = tituloFallback(primeiraMensagem);
  if (!primeiraMensagem.trim()) return fallback;

  try {
    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text } = await generateText({
      model: gateway(MODELO_CHAT),
      system:
        "Você gera títulos para conversas de um service desk corporativo. " +
        "A partir da primeira mensagem do usuário, responda APENAS com um título curto e descritivo " +
        "em português, de 3 a 8 palavras, que resuma o assunto da conversa. " +
        "Sem aspas, sem pontuação final, sem prefixos como 'Título:'. " +
        "Não inclua nomes de pessoas, e-mails, senhas ou dados sensíveis.",
      prompt: primeiraMensagem.slice(0, 500),
      // Sem maxOutputTokens: o modelo do gateway rejeita o parâmetro max_tokens.
      // O tamanho é garantido pelo prompt (3 a 8 palavras) e pelo limparTitulo.
      providerOptions: { lovable: { reasoningEffort: "none" } },
    });
    return limparTitulo(text) || fallback;
  } catch (erro) {
    console.error("[assistente] falha ao gerar título, usando fallback", erro);
    return fallback;
  }
}
