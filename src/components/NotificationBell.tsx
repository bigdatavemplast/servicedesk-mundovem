import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useState } from "react";

export function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  const { data: notifs = [] } = useQuery({
    queryKey: ["notificacoes", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notificacoes")
        .select("id,titulo,mensagem,lida,criado_em,chamado_id")
        .eq("destinatario_id", userId)
        .order("criado_em", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(window.Notification.permission);
  }, []);

  useEffect(() => {
    const ch = supabase.channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `destinatario_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as { id: string; titulo?: string; mensagem?: string; chamado_id?: string | null };
          qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
          if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
            const browserNotification = new window.Notification(n.titulo || "Nova notificação", {
              body: n.mensagem || "Há uma nova atualização no Service Desk.",
              icon: "/favicon.ico",
              tag: n.id,
            });
            browserNotification.onclick = () => {
              window.focus();
              if (n.chamado_id) navigate({ to: "/chamados/$id", params: { id: n.chamado_id } });
              browserNotification.close();
            };
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc, navigate]);

  async function solicitarPermissao() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      const result = await window.Notification.requestPermission();
      setPermission(result);
    }
  }

  async function abrir(n: any) {
    if (!n.lida) {
      await supabase.from("notificacoes").update({ lida: true } as never).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
    }
    if (n.chamado_id) navigate({ to: "/chamados/$id", params: { id: n.chamado_id } });
  }

  async function marcarTodas() {
    await supabase.from("notificacoes").update({ lida: true } as never).eq("destinatario_id", userId).eq("lida", false);
    qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
  }

  const naoLidas = notifs.filter((n) => !n.lida).length;

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) void solicitarPermissao(); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        >
          {naoLidas > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div>
            <span className="text-sm font-semibold">Notificações</span>
            {permission === "granted" && <div className="text-[10px] text-emerald-600">Notificações do navegador ativas</div>}
            {permission === "denied" && <div className="text-[10px] text-muted-foreground">Notificações do navegador bloqueadas</div>}
          </div>
          {naoLidas > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={marcarTodas}>Marcar todas como lidas</button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações</div>}
          {notifs.map((n) => (
            <button key={n.id} onClick={() => abrir(n)}
              className={`block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60 ${!n.lida ? "bg-primary/5" : ""}`}>
              <div className="flex justify-between gap-2">
                <span className="font-medium">{n.titulo}</span>
                {!n.lida && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
              {n.mensagem && <div className="text-xs text-muted-foreground">{n.mensagem}</div>}
              <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.criado_em).toLocaleString("pt-BR")}</div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
