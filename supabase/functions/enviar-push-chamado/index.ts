import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return Response.json({ error: "Método não permitido" }, { status: 405, headers });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!url || !serviceKey) throw new Error("Configuração administrativa do Supabase ausente.");
    if (!publicKey || !privateKey) return Response.json({ sent: 0, skipped: "VAPID_NOT_CONFIGURED" }, { status: 503, headers });

    const { chamadoId } = await req.json();
    if (typeof chamadoId !== "string" || !/^[0-9a-f-]{36}$/i.test(chamadoId)) return Response.json({ error: "chamadoId inválido" }, { status: 400, headers });
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: ticket, error: ticketError } = await admin.from("chamados").select("id,numero,titulo,solicitante_id").eq("id", chamadoId).maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return Response.json({ error: "Chamado não encontrado" }, { status: 404, headers });

    const { data: creatorRoles, error: creatorError } = await admin.from("user_roles").select("role").eq("user_id", ticket.solicitante_id);
    if (creatorError) throw creatorError;
    if (!(creatorRoles ?? []).some((role) => role.role === "gestor")) return Response.json({ sent: 0, skipped: "NOT_OPENED_BY_MANAGER" }, { headers });

    const { data: attendantRoles, error: attendantsError } = await admin.from("user_roles").select("user_id").eq("role", "atendente");
    if (attendantsError) throw attendantsError;
    const attendantIds = [...new Set((attendantRoles ?? []).map((role) => role.user_id))];
    if (!attendantIds.length) return Response.json({ sent: 0, skipped: "NO_ATTENDANTS" }, { headers });

    const { data: activeProfiles, error: profilesError } = await admin.from("profiles").select("id").in("id", attendantIds).eq("ativo", true);
    if (profilesError) throw profilesError;
    const activeIds = (activeProfiles ?? []).map((profile) => profile.id);
    if (!activeIds.length) return Response.json({ sent: 0, skipped: "NO_ACTIVE_ATTENDANTS" }, { headers });

    const { data: subscriptions, error: subscriptionsError } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", activeIds);
    if (subscriptionsError) throw subscriptionsError;
    if (!subscriptions?.length) return Response.json({ sent: 0, skipped: "NO_PUSH_SUBSCRIPTIONS" }, { headers });

    webpush.setVapidDetails("mailto:suporte@mundovem.com.br", publicKey, privateKey);
    const payload = JSON.stringify({ title: `Novo chamado ${ticket.numero} — Service Desk Mundo Vem`, body: ticket.titulo, url: `/chamados/${ticket.id}`, tag: `chamado-${ticket.id}` });
    let sent = 0, failed = 0;
    const expired: string[] = [];
    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 3600 });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.endpoint);
        failed += 1;
        console.error("Falha ao enviar push", sub.id, status, error);
      }
    }));
    if (expired.length) await admin.from("push_subscriptions").delete().in("endpoint", expired);
    return Response.json({ sent, failed, removedExpired: expired.length }, { headers });
  } catch (error) {
    console.error("Erro ao enviar notificações push:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Falha ao enviar notificações" }, { status: 500, headers });
  }
});
