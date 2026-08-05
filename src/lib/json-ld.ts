/**
 * Serializa um objeto para JSON-LD seguro em <script>.
 * Escapa caracteres que poderiam encerrar a tag ou iniciar comentários HTML,
 * sem alterar o conteúdo semântico do JSON.
 */
export function serializarJsonLd(dados: unknown): string {
  return JSON.stringify(dados)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
