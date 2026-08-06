import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect } from "react";

export function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifs = [] } = useQuery({
    queryKey: ["notificacoes", userId],
    queryFn: async () => {
      const { data } = await supabase.from("notificacoes")
        .select("id,titulo,mensagem,lida,criado_em,chamado_id")
        .eq("destinatario_id", userId)
        .order("criado_em", { ascending: false }).limit(20);
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const ch = supabase.channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes", filter: `destinatario_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notificacoes", userId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  const naoLidas = notifs.filter((n) => !n.lida).length;

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
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
