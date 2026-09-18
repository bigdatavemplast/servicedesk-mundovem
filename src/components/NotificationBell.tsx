import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { Bell, BellRing, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useRef, useState } from "react";

const NOME_APP = "Service Desk Mundo Vem";
const LOGO_MUNDO_VEM = "/favicon.png";
const PAGE_SIZE = 20;
const PUSH_POLL_INTERVAL = 5_000;

function montarNotificacao(titulo?: string, mensagem?: string) {
  const tituloOriginal = titulo?.trim() || "Nova atualização";
  const mensagemOriginal = mensagem?.trim() || "Há uma nova atualização no Service Desk.";
  return { title: `${NOME_APP} • ${tituloOriginal}`, body: mensagemOriginal };
}

type NotificacaoRecebida = {
  id: string;
  titulo?: string;
  mensagem?: string;
  chamado_id?: string | null;
};

export function NotificationBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [page, setPage] = useState(0);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<Event | null>(null);
  const idsComPush = useRef<Set<string>>(new Set());

  const { data: total = 0 } = useQuery({
    queryKey: ["notificacoes-total", userId],
    queryFn: async () => {
      const { count, error } = await supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("destinatario_id", userId);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  const { data: naoLidasTotal = 0 } = useQuery({
    queryKey: ["notificacoes-nao-lidas", userId],
    queryFn: async () => {
      const { count, error } = await supabase.from("notificacoes").select("id", { count: "exact", head: true }).eq("destinatario_id", userId).eq("lida", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 15_000,
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["notificacoes", userId, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const { data, error } = await supabase.from("notificacoes").select("id,titulo,mensagem,lida,criado_em,chamado_id").eq("destinatario_id", userId).order("criado_em", { ascending: false }).range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(window.Notification.permission);
  }, []);

  const emitirPush = (n: NotificacaoRecebida) => {
    if (idsComPush.current.has(n.id)) return;
    if (typeof window === "undefined" || !("Notification" in window) || window.Notification.permission !== "granted") return;
    idsComPush.current.add(n.id);
    const conteudo = montarNotificacao(n.titulo, n.mensagem);
    const browserNotification = new window.Notification(conteudo.title, {
      body: conteudo.body,
      icon: LOGO_MUNDO_VEM,
      badge: LOGO_MUNDO_VEM,
      tag: `service-desk-${n.id}`,
      renotify: true,
      silent: false,
    });
    browserNotification.onclick = () => {
      window.focus();
      if (n.chamado_id) navigate({ to: "/chamados/$id", params: { id: n.chamado_id } });
      browserNotification.close();
    };
  };

  const invalidarNotificacoes = () => {
    void qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
    void qc.invalidateQueries({ queryKey: ["notificacoes-total", userId] });
    void qc.invalidateQueries({ queryKey: ["notificacoes-nao-lidas", userId] });
  };

  useEffect(() => {
    let ativo = true;
    const buscarNovasNotificacoes = async () => {
      if (!ativo) return;
      const limite = new Date(Date.now() - 60_000).toISOString();
      const { data, error } = await supabase.from("notificacoes").select("id,titulo,mensagem,chamado_id,criado_em").eq("destinatario_id", userId).gte("criado_em", limite).order("criado_em", { ascending: true });
      if (error || !ativo) return;
      for (const n of data ?? []) emitirPush(n);
      if ((data ?? []).length > 0) invalidarNotificacoes();
    };
    void buscarNovasNotificacoes();
    const intervalo = window.setInterval(() => { void buscarNovasNotificacoes(); }, PUSH_POLL_INTERVAL);
    return () => { ativo = false; window.clearInterval(intervalo); };
  }, [userId, navigate]);

  useEffect(() => {
    const channel = supabase.channel(`notif-${userId}-${Date.now()}`).on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "notificacoes",
    }, (payload) => {
      const n = payload.new as NotificacaoRecebida & { destinatario_id?: string };
      if (n.destinatario_id !== userId) return;
      invalidarNotificacoes();
      emitirPush(n);
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, navigate]);

  useEffect(() => {
    const capturarPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", capturarPrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturarPrompt);
  }, []);

  async function instalarAplicativo() {
    if (deferredInstallPrompt) {
      const evento = deferredInstallPrompt as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
      };
      await evento.prompt();
      await evento.userChoice;
      setDeferredInstallPrompt(null);
      return;
    }

    const navegador = navigator.userAgent.toLowerCase();
    const eChrome = navegador.includes("chrome") || navegador.includes("edg/");
    const eFirefox = navegador.includes("firefox");

    if (eChrome) {
      window.alert('O Service Desk já está preparado para instalação. Abra o menu ⋮ e procure por "Transmitir, salvar e compartilhar" > "Instalar página como app" ou "Instalar Service Desk".');
      return;
    }

    if (eFirefox) {
      window.alert("O Firefox não oferece instalação de PWA pelo botão deste site. Use o Chrome ou Microsoft Edge para instalar o Service Desk como aplicativo.");
      return;
    }

    window.alert('Abra o menu do navegador e procure por "Instalar Service Desk" ou "Instalar este site como aplicativo".');
  }

  async function solicitarPermissao() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      const result = await window.Notification.requestPermission();
      setPermission(result);
    } else {
      setPermission(window.Notification.permission);
    }
  }

  async function abrir(n: any) {
    if (!n.lida) {
      await supabase.from("notificacoes").update({ lida: true } as never).eq("id", n.id);
      invalidarNotificacoes();
    }
    if (n.chamado_id) navigate({ to: "/chamados/$id", params: { id: n.chamado_id } });
  }

  async function marcarTodas() {
    await supabase.from("notificacoes").update({ lida: true } as never).eq("destinatario_id", userId).eq("lida", false);
    invalidarNotificacoes();
  }

  const naoLidas = naoLidasTotal;
  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={instalarAplicativo}
        className="fixed bottom-5 left-5 z-50 h-11 gap-2 rounded-full px-4 font-semibold shadow-lg"
        title="Instalar o Service Desk no computador"
      >
        <Download className="h-4 w-4" />
        <span>Instalar Service Desk</span>
      </Button>

      <Popover open={open} onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPage(0);
          void solicitarPermissao();
        }
      }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : "Notificações"}>
            {naoLidas > 0 ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            {naoLidas > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">{naoLidas}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <span className="text-sm font-semibold">Notificações</span>
              {permission === "granted" && <div className="text-[10px] text-emerald-600">Notificações do navegador ativas</div>}
              {permission === "denied" && <div className="text-[10px] text-muted-foreground">Notificações do navegador bloqueadas</div>}
            </div>
            {naoLidas > 0 && <button className="text-xs text-primary hover:underline" onClick={marcarTodas}>Marcar todas como lidas</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações</div>}
            {notifs.map((n) => (
              <button key={n.id} onClick={() => abrir(n)} className={`block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60 ${!n.lida ? "bg-primary/5" : ""}`}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{n.titulo}</span>
                  {!n.lida && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                {n.mensagem && <div className="text-xs text-muted-foreground">{n.mensagem}</div>}
                <div className="mt-1 text-[10px] text-muted-foreground">{new Date(n.criado_em).toLocaleString("pt-BR")}</div>
              </button>
            ))}
          </div>
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between border-t px-3 py-2">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
              <span className="text-[11px] text-muted-foreground">Página {page + 1} de {totalPaginas}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPaginas - 1} onClick={() => setPage((p) => Math.min(totalPaginas - 1, p + 1))}>Próxima</Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
