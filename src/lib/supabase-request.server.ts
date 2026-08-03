import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/**
 * Cria um client Supabase autenticado como o usuário do token Bearer (respeita RLS).
 * Usado nas rotas HTTP do assistente, onde não há middleware de server function.
 */
export function criarClientDoToken(token: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Configuração do backend ausente");

  return createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

/** Valida o header Authorization e devolve o client + id do usuário. */
export async function autenticarRequisicao(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (token.split(".").length !== 3) return null;

  const supabase = criarClientDoToken(token);
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;

  return { supabase, userId: data.claims.sub as string };
}
