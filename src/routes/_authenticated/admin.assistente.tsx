import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bot, MessageSquare, Search, ShieldAlert, User } from "lucide-react";
import { listarConversasAdmin, carregarMensagens } from "@/lib/assistente.functions";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/assistente")({
  head: () => ({
    meta: [
      { title: "Conversas do Assistente | Admin | Mundo Vem Service Desk" },
      {
        name: "description",
        content:
          "Auditoria administrativa das conversas do Assistente Inteligente de todos os colaboradores.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Conversas do Assistente | Admin | Mundo Vem Service Desk" },
      {
        property: "og:description",
        content: "Histórico de conversas do Assistente Inteligente identificado por usuário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminConversasAssistente,
});

function formatarData(data: string | null) {
  if (!data) return "";
  return new Date(data).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Visualização read-only das mensagens de uma conversa (uso administrativo). */
function ConversaReadOnly({ conversaId }: { conversaId: string }) {
  const buscarMensagens = useServerFn(carregarMensagens);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "conversas-ia", conversaId],
    queryFn: () => buscarMensagens({ data: { conversationId: conversaId } }),
  });

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center py-16">
        <Shimmer>Carregando conversa...</Shimmer>
      </div>
    );
  }

  if (!data) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Conversa não encontrada.
      </p>
    );
  }

  if (data.mensagens.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Esta conversa ainda não tem mensagens.
      </p>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {data.mensagens.map((m) => (
        <div
          key={m.id}
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            m.role === "user"
              ? "ml-auto bg-primary text-primary-foreground"
              : "mr-auto bg-muted"
          }`}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
            {m.role === "user" ? "Colaborador" : "Assistente"}
          </p>
          <p className="whitespace-pre-wrap">{m.content}</p>
        </div>
      ))}
    </div>
  );
}

function AdminConversasAssistente() {
  const buscarConversasAdmin = useServerFn(listarConversasAdmin);
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const { data: conversas = [], isLoading, isError } = useQuery({
    queryKey: ["admin", "conversas-ia"],
    queryFn: () => buscarConversasAdmin(),
  });

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return conversas;
    return conversas.filter((c) =>
      [c.title ?? "", c.dono?.nome ?? "", c.dono?.email ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [conversas, busca]);

  const conversaSelecionada = conversas.find((c) => c.id === selecionada) ?? null;

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Acesso restrito a administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Conversas do Assistente</h1>
          <p className="text-sm text-muted-foreground">
            Histórico de conversas de todos os colaboradores (somente leitura).
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por usuário, e-mail ou assunto..."
          className="pl-9"
          aria-label="Buscar conversas"
        />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="min-h-0 overflow-y-auto rounded-lg border bg-background">
          {isLoading ? (
            <div className="grid place-items-center py-16">
              <Shimmer>Carregando conversas...</Shimmer>
            </div>
          ) : filtradas.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma conversa encontrada.
            </p>
          ) : (
            <div className="divide-y">
              {filtradas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelecionada(c.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
                    c.id === selecionada ? "bg-accent" : "hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{c.title ?? "Nova conversa"}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {c.dono ? `${c.dono.nome} (${c.dono.email})` : "Usuário removido"}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Atualizada em {formatarData(c.updated_at ?? c.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col rounded-lg border bg-background">
          {conversaSelecionada ? (
            <>
              <div className="border-b px-4 py-3">
                <p className="truncate text-sm font-semibold">
                  {conversaSelecionada.title ?? "Nova conversa"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {conversaSelecionada.dono
                    ? `${conversaSelecionada.dono.nome} (${conversaSelecionada.dono.email})`
                    : "Usuário removido"}
                </p>
              </div>
              <ConversaReadOnly conversaId={conversaSelecionada.id} />
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                Selecione uma conversa na lista ao lado para visualizar o histórico de
                mensagens.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
