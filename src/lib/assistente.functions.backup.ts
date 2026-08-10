import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Lista as conversas do usuário logado. */
export const listarConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(60);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Cria uma nova conversa e devolve o id. */
export const criarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_conversations")
      .insert({ user_id: context.userId })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: data.id as string };
  });

/** Exclui uma conversa do usuário logado. */
export const excluirConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Conversa inválida");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_conversations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Carrega o histórico persistido de uma conversa. */
export const carregarMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversationId: string }) => {
    if (!input?.conversationId) throw new Error("Conversa inválida");
    return input;
  })
  .handler(async ({ data, context }) => {
    // A separação por usuário é garantida pelo RLS: colaboradores só leem as
    // próprias conversas; admin/atendente podem consultar qualquer conversa.
    const { data: conversa, error: erroConversa } = await context.supabase
      .from("ai_conversations")
      .select("id, title")
      .eq("id", data.conversationId)
      .maybeSingle();

    if (erroConversa) throw new Error(erroConversa.message);
    if (!conversa) return null;

    const { data: mensagens, error } = await context.supabase
      .from("ai_messages")
      .select("id, role, content, fontes, confianca, created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return {
      conversa: { id: conversa.id as string, title: (conversa.title as string | null) ?? null },
      mensagens: (mensagens ?? []).map((m) => ({
        id: m.id as string,
        role: m.role as string,
        content: m.content as string,
        fontes: (Array.isArray(m.fontes) ? m.fontes : []) as Array<{
          origem: string;
          ref_id: string;
          titulo: string;
          similaridade: number;
        }>,
        confianca: m.confianca as number | null,
      })),
    };
  });

/** [Admin] Lista as conversas de todos os usuários, identificando o dono de cada uma. */
export const listarConversasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");

    const { data: conversas, error } = await context.supabase
      .from("ai_conversations")
      .select("id, title, user_id, created_at, updated_at")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(300);

    if (error) throw new Error(error.message);

    const donoIds = [...new Set((conversas ?? []).map((c) => c.user_id as string))];
    let perfis: Array<{ id: string; nome: string; email: string }> = [];
    if (donoIds.length) {
      const { data } = await context.supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", donoIds);
      perfis = data ?? [];
    }
    const mapaDonos = new Map(
      perfis.map((p) => [p.id, { nome: p.nome, email: p.email }]),
    );

    return (conversas ?? []).map((c) => ({
      id: c.id as string,
      title: (c.title as string | null) ?? null,
      created_at: (c.created_at as string | null) ?? null,
      updated_at: (c.updated_at as string | null) ?? null,
      dono: mapaDonos.get(c.user_id as string) ?? null,
    }));
  });
