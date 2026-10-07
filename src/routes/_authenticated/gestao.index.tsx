import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Clock3,
  Gauge,
  Headphones,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/gestao/")({
  head: () => ({
    meta: [{ title: "Gestão | Mundo Vem Service Desk" }],
  }),

  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      throw redirect({ to: "/auth" });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    if (
      !(roles ?? []).some((r) =>
        ["gestor", "admin"].includes(String(r.role)),
      )
    ) {
      throw redirect({ to: "/dashboard" });
    }
  },

  component: GestaoPage,
});

type Chamado = {
  id: string;
  status: string;
  prioridade: string;
  criado_em: string;
  resolvido_em: string | null;
  sla_resolucao_violado: boolean;
  prazo_resolucao: string | null;
  primeira_chamada_resolvida: boolean | null;
  escalonado: boolean;
  atendimento_abandonado: boolean;
  tempo_atendimento_minutos: number | null;
  custo_atendimento: number | null;
  categoria_id: string | null;
  atendente_id: string | null;
  segmento_id: string | null;
  sla_tempo_pausado_segundos: number | null;
  escalonado_em: string | null;
  escalonamento_nivel: number | null;
};

type Segmento = {
  id: string;
  nome: string;
};

type Capacidade = {
  usuario_id: string | null;
  grupo_atendimento_id: string | null;
  horas_disponiveis_semana: number;
  custo_hora: number;
  ativo: boolean;
};

type CsatResult = {
  media_csat: number | null;
  total_avaliacoes: number;
};

const CLOSED = ["resolvido", "fechado"];
const CANCELLED = "cancelado";

const since = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const pct = (n: number, d: number) =>
  d ? Math.round((n / d) * 100) : null;

const hours = (value: number | null) => {
  if (value == null) return "—";

  return value < 1
    ? `${Math.round(value * 60)} min`
    : `${value.toFixed(1)} h`;
};

const money = (value: number | null) =>
  value == null
    ? "—"
    : value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

const areaStored = () => {
  try {
    const value = JSON.parse(
      localStorage.getItem("service_desk_segmento") || "null",
    );

    return value?.id ? String(value.id) : "";
  } catch {
    return "";
  }
};

function Kpi({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: any;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold">
            {value}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            {hint}
          </p>
        </div>

        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function GestaoPage() {
  const [dias, setDias] = useState("30");
  const [segmentoId, setSegmentoId] = useState(areaStored());
  const { data: user } = useQuery({ queryKey: ["gestao-current-user"], queryFn: async () => { const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user; } });
  const { data: roles = [] } = useQuery({ queryKey: ["gestao-my-roles", user?.id], enabled: !!user?.id, queryFn: async () => { const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id); if (error) throw error; return (data ?? []).map((r) => String(r.role)); } });
  const isGestor = roles.includes("gestor") && !roles.includes("admin");
  const { data: perfilGestor } = useQuery({ queryKey: ["gestao-gestor-profile", user?.id], enabled: isGestor && !!user?.id, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("area_id").eq("id", user!.id).maybeSingle(); if (error) throw error; return data as { area_id: string | null } | null; } });

  const days = Number(dias);

  const inicio = useMemo(
    () => since(days),
    [days],
  );

  const { data: segmentos = [] } = useQuery({
    queryKey: ["gestao-segmentos"],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("segmentos")
        .select("id,nome")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");

      if (error) throw error;

      return data as Segmento[];
    },

    staleTime: 5 * 60 * 1000,
  });

  const { data: areaGestor } = useQuery({ queryKey: ["gestao-gestor-area-name", perfilGestor?.area_id], enabled: isGestor && !!perfilGestor?.area_id, queryFn: async () => { const { data, error } = await supabase.from("areas").select("id,nome,ativo").eq("id", perfilGestor!.area_id!).maybeSingle(); if (error) throw error; return data as { id: string; nome: string; ativo: boolean } | null; } });
  const normalizarNomeArea = (nome: string) => nome.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const segmentoGestor = areaGestor ? segmentos.find((segmento) => normalizarNomeArea(segmento.nome) === normalizarNomeArea(areaGestor.nome)) : null;
  const segmentoValido = isGestor
    ? (segmentoGestor?.id || "")
    : (segmentos.some((segmento) => segmento.id === segmentoId) ? segmentoId : segmentos[0]?.id || "");

  useEffect(() => {
    if (
      segmentoValido &&
      segmentoValido !== segmentoId
    ) {
      setSegmentoId(segmentoValido);
    }
  }, [segmentoValido, segmentoId]);

  useQuery({
    queryKey: ["gestao-atualizar-abandonos"],

    enabled: !loadingRoles && (!isGestor || !!segmentoGestor),

    queryFn: async () => {
      const { error } = await (
        supabase as any
      ).rpc("gestao_atualizar_abandonos");

      if (error) throw error;

      return true;
    },

    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    data: chamados = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "gestao-chamados",
      days,
      segmentoValido,
      inicio,
    ],

    enabled: !loadingRoles && (!isGestor || !!segmentoGestor),

    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      )
        .from("chamados")
        .select(
          "id,status,prioridade,criado_em,resolvido_em,sla_resolucao_violado,prazo_resolucao,primeira_chamada_resolvida,escalonado,atendimento_abandonado,tempo_atendimento_minutos,custo_atendimento,categoria_id,atendente_id,segmento_id,sla_tempo_pausado_segundos,escalonado_em,escalonamento_nivel",
        )
        .eq("segmento_id", segmentoValido)
        .gte("criado_em", inicio)
        .order("criado_em", {
          ascending: true,
        });

      if (error) throw error;

      return data as Chamado[];
    },
  });

  const { data: backlogAnterior = [] } = useQuery({
    queryKey: [
      "gestao-backlog",
      segmentoValido,
      inicio,
    ],

    enabled: !loadingRoles && (!isGestor || !!segmentoGestor),

    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      )
        .from("chamados")
        .select(
          "id,status,criado_em,resolvido_em",
        )
        .eq("segmento_id", segmentoValido)
        .lt("criado_em", inicio)
        .or(
          `resolvido_em.is.null,resolvido_em.gte.${inicio}`,
        );

      if (error) throw error;

      return data || [];
    },
  });

  const {
    data: csatData,
    isLoading: csatLoading,
    error: csatError,
  } = useQuery<CsatResult>({
    queryKey: [
      "gestao-csat",
      segmentoValido,
      inicio,
    ],

    enabled: !!segmentoValido,

    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      ).rpc("gestao_csat", {
        _segmento_id: segmentoValido,
        _inicio: inicio,
      });

      if (error) throw error;

      const resultado = Array.isArray(data)
        ? data[0]
        : data;

      return {
        media_csat:
          resultado?.media_csat != null
            ? Number(resultado.media_csat)
            : null,

        total_avaliacoes:
          resultado?.total_avaliacoes != null
            ? Number(resultado.total_avaliacoes)
            : 0,
      };
    },

    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const agentIds = useMemo(
    () =>
      Array.from(
        new Set(
          chamados
            .map(
              (chamado) =>
                chamado.atendente_id,
            )
            .filter(Boolean),
        ),
      ) as string[],

    [chamados],
  );

  const { data: profiles = [] } = useQuery({
    queryKey: [
      "gestao-profiles",
      agentIds.join(","),
    ],

    enabled: agentIds.length > 0,

    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,nome,email")
        .in("id", agentIds);

      if (error) throw error;

      return data || [];
    },
  });

  const profileMap = useMemo(
    () =>
      Object.fromEntries(
        (profiles as any[]).map(
          (profile) => [
            profile.id,
            profile.nome ||
              profile.email ||
              profile.id,
          ],
        ),
      ),

    [profiles],
  );

  const { data: grupos = [] } = useQuery({
    queryKey: [
      "gestao-grupos",
      segmentoValido,
    ],

    enabled: !!segmentoValido,

    queryFn: async () => {
      const { data, error } = await (
        supabase as any
      )
        .from("grupos_atendimento")
        .select("id")
        .eq(
          "segmento_id",
          segmentoValido,
        )
        .eq("ativo", true);

      if (error) throw error;

      return data || [];
    },
  });

  const grupoIds = useMemo(
    () =>
      grupos.map(
        (grupo: any) => grupo.id,
      ),
    [grupos],
  );

  const { data: capacidade = [] } =
    useQuery({
      queryKey: [
        "gestao-capacidade",
        segmentoValido,
        agentIds.join(","),
        grupoIds.join(","),
      ],

      enabled:
        !!segmentoValido &&
        (agentIds.length > 0 ||
          grupoIds.length > 0),

      queryFn: async () => {
        let query = (supabase as any)
          .from("gestao_capacidade")
          .select(
            "usuario_id,grupo_atendimento_id,horas_disponiveis_semana,custo_hora,ativo",
          )
          .eq("ativo", true);

        const filters: string[] = [];

        if (agentIds.length) {
          filters.push(
            `usuario_id.in.(${agentIds.join(",")})`,
          );
        }

        if (grupoIds.length) {
          filters.push(
            `grupo_atendimento_id.in.(${grupoIds.join(",")})`,
          );
        }

        if (!filters.length) {
          return [];
        }

        query = query.or(
          filters.join(","),
        );

        const { data, error } =
          await query;

        if (error) throw error;

        return data as Capacidade[];
      },
    });

  const { data: categorias = [] } =
    useQuery({
      queryKey: [
        "gestao-categorias",
      ],

      queryFn: async () => {
        const { data, error } =
          await supabase
            .from("categorias")
            .select("id,nome")
            .eq("ativo", true);

        if (error) throw error;

        return data || [];
      },

      staleTime: 5 * 60 * 1000,
    });

  const catMap = useMemo(
    () =>
      Object.fromEntries(
        (categorias as any[]).map(
          (categoria) => [
            categoria.id,
            categoria.nome,
          ],
        ),
      ),

    [categorias],
  );

  const areaNome =
    segmentos.find(
      (segmento) =>
        segmento.id ===
        segmentoValido,
    )?.nome || "Área";

  const m = useMemo(() => {
    const resolved = chamados.filter(
      (chamado) =>
        chamado.status !==
          CANCELLED &&
        CLOSED.includes(
          String(
            chamado.status,
          ).toLowerCase(),
        ),
    );

    const encerradosComData =
      resolved.filter(
        (chamado) =>
          !!chamado.resolvido_em,
      );

    const fcrE = chamados.filter(
      (chamado) =>
        chamado.primeira_chamada_resolvida !==
        null,
    );

    const fcr = pct(
      fcrE.filter(
        (chamado) =>
          chamado.primeira_chamada_resolvida ===
          true,
      ).length,

      fcrE.length,
    );

    const tmas =
      encerradosComData.map(
        (chamado) => {
          if (
            chamado.tempo_atendimento_minutos !=
            null
          ) {
            return (
              Number(
                chamado.tempo_atendimento_minutos,
              ) / 60
            );
          }

          return Math.max(
            0,

            (new Date(
              chamado.resolvido_em!,
            ).getTime() -
              new Date(
                chamado.criado_em,
              ).getTime()) /
              3600000 -

              Number(
                chamado.sla_tempo_pausado_segundos ||
                  0,
              ) /
                3600,
          );
        },
      );

    const tma = tmas.length
      ? tmas.reduce(
          (total, value) =>
            total + value,
          0,
        ) / tmas.length
      : null;

    const slaE =
      encerradosComData.filter(
        (chamado) =>
          chamado.prazo_resolucao ||
          chamado.sla_resolucao_violado,
      );

    const sla = pct(
      slaE.filter(
        (chamado) =>
          !chamado.sla_resolucao_violado &&
          (!chamado.prazo_resolucao ||
            new Date(
              chamado.resolvido_em!,
            ) <=
              new Date(
                chamado.prazo_resolucao,
              )),
      ).length,

      slaE.length,
    );

    const cost =
      chamados
        .map(
          (chamado) =>
            chamado.custo_atendimento,
        )
        .filter(
          (
            value,
          ): value is number =>
            value != null,
        );

    const costTotal = cost.length
      ? cost.reduce(
          (total, value) =>
            total + value,
          0,
        )
      : null;

    const costResolved =
      resolved
        .map(
          (chamado) =>
            chamado.custo_atendimento,
        )
        .filter(
          (
            value,
          ): value is number =>
            value != null,
        );

    const costPer =
      costResolved.length &&
      resolved.length
        ? costResolved.reduce(
            (total, value) =>
              total + value,
            0,
          ) / resolved.length
        : null;

    const used =
      chamados.reduce(
        (total, chamado) =>
          total +
          Number(
            chamado.tempo_atendimento_minutos ||
              0,
          ),
        0,
      ) / 60;

    const capacity =
      capacidade.reduce(
        (total, item) =>
          total +
          Number(
            item.horas_disponiveis_semana,
          ),
        0,
      ) *
      (days / 7);

    const utilization = capacity
      ? (used / capacity) * 100
      : null;

    const quality =
      csatData?.media_csat != null &&
      fcr != null
        ? (Number(
            csatData.media_csat,
          ) /
            5) *
            50 +
          fcr * 0.5
        : null;

    const escalonados =
      chamados.filter(
        (chamado) =>
          chamado.escalonado ===
            true ||
          chamado.escalonado_em !==
            null ||
          Number(
            chamado.escalonamento_nivel ||
              0,
          ) > 1,
      );

    const abandonados =
      chamados.filter(
        (chamado) =>
          chamado.atendimento_abandonado &&
          !CLOSED.includes(
            String(
              chamado.status,
            ).toLowerCase(),
          ) &&
          chamado.status !==
            CANCELLED,
      );

    return {
      resolved: resolved.length,

      backlog: chamados.filter(
        (chamado) =>
          !CLOSED.includes(
            String(
              chamado.status,
            ).toLowerCase(),
          ) &&
          chamado.status !==
            CANCELLED,
      ).length,

      fcr,

      tma,

      sla,

      costTotal,

      costPer,

      utilization,

      quality,

      escal: pct(
        escalonados.length,
        chamados.length,
      ),

      escalonados:
        escalonados.length,

      abandon: pct(
        abandonados.length,
        chamados.length,
      ),
    };
  }, [
    csatData,
    capacidade,
    chamados,
    days,
  ]);

  const trend = useMemo(() => {
    const map = new Map<
      string,
      {
        periodo: string;
        abertos: number;
        resolvidos: number;
        backlog: number;
      }
    >();

    for (
      let i = days - 1;
      i >= 0;
      i--
    ) {
      const date = new Date();

      date.setDate(
        date.getDate() - i,
      );

      const key = date
        .toISOString()
        .slice(0, 10);

      map.set(key, {
        periodo: key.slice(5),
        abertos: 0,
        resolvidos: 0,
        backlog: 0,
      });
    }

    chamados.forEach(
      (chamado) => {
        const aberto = map.get(
          chamado.criado_em.slice(
            0,
            10,
          ),
        );

        if (aberto) {
          aberto.abertos++;
        }

        if (chamado.resolvido_em) {
          const resolvido =
            map.get(
              chamado.resolvido_em.slice(
                0,
                10,
              ),
            );

          if (resolvido) {
            resolvido.resolvidos++;
          }
        }
      },
    );

    let backlog =
      backlogAnterior.filter(
        (chamado: any) =>
          !CLOSED.includes(
            String(
              chamado.status,
            ).toLowerCase(),
          ) &&
          chamado.status !==
            CANCELLED,
      ).length;

    return [...map.values()].map(
      (item) => {
        backlog = Math.max(
          0,
          backlog +
            item.abertos -
            item.resolvidos,
        );

        return {
          ...item,
          backlog,
        };
      },
    );
  }, [
    backlogAnterior,
    chamados,
    days,
  ]);

  const priorities = [
    "baixa",
    "media",
    "alta",
    "critica",
  ].map((prioridade) => ({
    prioridade,

    total: chamados.filter(
      (chamado) =>
        chamado.prioridade ===
        prioridade,
    ).length,
  }));

  const agents = useMemo(() => {
    const map = new Map<
      string,
      {
        agente: string;
        total: number;
        resolvidos: number;
      }
    >();

    chamados
      .filter(
        (chamado) =>
          chamado.atendente_id,
      )
      .forEach((chamado) => {
        const id =
          chamado.atendente_id!;

        const item =
          map.get(id) || {
            agente:
              profileMap[id] ||
              "Atendente",

            total: 0,
            resolvidos: 0,
          };

        item.total++;

        if (chamado.resolvido_em) {
          item.resolvidos++;
        }

        map.set(id, item);
      });

    return [...map.values()]
      .sort(
        (a, b) =>
          b.resolvidos -
          a.resolvidos,
      )
      .slice(0, 10);
  }, [
    chamados,
    profileMap,
  ]);

  const categories = useMemo(() => {
    const map = new Map<
      string,
      number
    >();

    chamados.forEach(
      (chamado) => {
        const name =
          chamado.categoria_id
            ? catMap[
                chamado.categoria_id
              ] ||
              "Sem categoria"
            : "Sem categoria";

        map.set(
          name,
          (map.get(name) || 0) +
            1,
        );
      },
    );

    return [...map]
      .map(
        ([
          categoria,
          total,
        ]) => ({
          categoria,
          total,
        }),
      )
      .sort(
        (a, b) =>
          b.total - a.total,
      )
      .slice(0, 8);
  }, [
    chamados,
    catMap,
  ]);

  if (loadingRoles || (isGestor && !segmentoGestor)) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">Carregando indicadores de gestão…</div>
    );
  }

  if (!segmentoValido) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>
              Selecione uma área
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Carregando indicadores de gestão…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardHeader>
            <CardTitle>
              Erro ao carregar Gestão
            </CardTitle>
          </CardHeader>

          <CardContent>
            Não foi possível consultar
            os chamados.
          </CardContent>
        </Card>
      </div>
    );
  }

  const csatValue =
    csatLoading
      ? "..."
      : csatData?.media_csat !=
          null
        ? `${Number(
            csatData.media_csat,
          ).toFixed(1)}/5`
        : "—";

  const csatHint = csatError
    ? "Erro ao consultar avaliações"
    : `${csatData?.total_avaliacoes ?? 0} avaliações da área`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Gestão do Service Desk
          </h1>

          <p className="text-sm text-muted-foreground">
            Indicadores exclusivamente
            da área{" "}
            <strong>
              {areaNome}
            </strong>
            .
          </p>
        </div>

        <div className="flex gap-2">
          <Select
            value={
              segmentoValido
            }
            onValueChange={
              setSegmentoId
            }
            disabled={isGestor}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {segmentos.map(
                (segmento) => (
                  <SelectItem
                    key={
                      segmento.id
                    }
                    value={
                      segmento.id
                    }
                  >
                    {
                      segmento.nome
                    }
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>

          <Select
            value={dias}
            onValueChange={
              setDias
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="7">
                Últimos 7 dias
              </SelectItem>

              <SelectItem value="15">
                Últimos 15 dias
              </SelectItem>

              <SelectItem value="30">
                Últimos 30 dias
              </SelectItem>

              <SelectItem value="90">
                Últimos 90 dias
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Volume"
          value={String(
            m.resolved,
          )}
          hint={`${m.resolved} resolvidos + fechados · ${areaNome}`}
          icon={Headphones}
        />

        <Kpi
          title="FCR"
          value={
            m.fcr == null
              ? "—"
              : `${m.fcr}%`
          }
          hint="resolução na primeira chamada"
          icon={Zap}
        />

        <Kpi
          title="TMA"
          value={hours(
            m.tma,
          )}
          hint="tempo médio efetivamente trabalhado"
          icon={Clock3}
        />

        <Kpi
          title="SLA"
          value={
            m.sla == null
              ? "—"
              : `${m.sla}%`
          }
          hint="conformidade em encerrados"
          icon={ShieldCheck}
        />

        <Kpi
          title="CSAT"
          value={
            csatValue
          }
          hint={
            csatHint
          }
          icon={Star}
        />

        <Kpi
          title="Escalonamento"
          value={
            m.escal == null
              ? "—"
              : `${m.escal}%`
          }
          hint={`${m.escalonados} chamados escalonados`}
          icon={
            TrendingUp
          }
        />

        <Kpi
          title="Abandono"
          value={
            m.abandon == null
              ? "—"
              : `${m.abandon}%`
          }
          hint="30 dias sem ação do atendimento"
          icon={
            Activity
          }
        />

        <Kpi
          title="Backlog"
          value={String(
            m.backlog,
          )}
          hint="não encerrados"
          icon={Gauge}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              Custos
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Total registrado
            </p>

            <p className="text-xl font-bold">
              {money(
                m.costTotal,
              )}
            </p>

            <p className="mt-2 text-sm text-muted-foreground">
              Por resolvido
            </p>

            <p className="text-lg font-semibold">
              {money(
                m.costPer,
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Capacidade
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              Utilização
            </p>

            <p className="text-xl font-bold">
              {m.utilization ==
              null
                ? "—"
                : `${m.utilization.toFixed(1)}%`}
            </p>

            <Badge variant="outline">
              {
                capacidade.length
              }{" "}
              parâmetros
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Qualidade
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-muted-foreground">
              CSAT + FCR
            </p>

            <p className="text-xl font-bold">
              {m.quality ==
              null
                ? "—"
                : `${m.quality.toFixed(0)}/100`}
            </p>

            <p className="text-xs text-muted-foreground">
              CSAT:{" "}
              {csatData?.media_csat ==
              null
                ? "—"
                : Number(
                    csatData.media_csat,
                  ).toFixed(1)}{" "}
              · FCR:{" "}
              {m.fcr == null
                ? "—"
                : `${m.fcr}%`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Abertura x resolução
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={trend}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="periodo" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="abertos"
                    name="Abertos"
                    strokeWidth={2}
                  />

                  <Line
                    type="monotone"
                    dataKey="resolvidos"
                    name="Resolvidos"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Backlog acumulado
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={trend}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="periodo" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="backlog"
                    name="Backlog"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Volume por prioridade
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    priorities
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="prioridade" />

                  <YAxis allowDecimals={false} />

                  <Tooltip />

                  <Bar
                    dataKey="total"
                    name="Chamados"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Produtividade por atendente
            </CardTitle>
          </CardHeader>

          <CardContent>
            {agents.length ? (
              <div className="space-y-2">
                {agents.map(
                  (agent) => (
                    <div
                      key={
                        agent.agente
                      }
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />

                        <span className="text-sm font-medium">
                          {
                            agent.agente
                          }
                        </span>
                      </div>

                      <Badge variant="outline">
                        {
                          agent.resolvidos
                        }{" "}
                        resolvidos /{" "}
                        {
                          agent.total
                        }{" "}
                        total
                      </Badge>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum chamado
                atribuído no
                período.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Volume por categoria
          </CardTitle>
        </CardHeader>

        <CardContent>
          {categories.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map(
                (category) => (
                  <div
                    key={
                      category.categoria
                    }
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm">
                      {
                        category.categoria
                      }
                    </span>

                    <Badge>
                      {
                        category.total
                      }
                    </Badge>
                  </div>
                ),
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum dado de
              categoria no
              período.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
