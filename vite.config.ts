import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Configuração oficial do projeto: mantém a prévia do Lovable (saída em dist/)
// e o deploy próprio (Vercel/Cloudflare) com o mesmo arquivo.
export default defineConfig({
  nitro: true,
});
