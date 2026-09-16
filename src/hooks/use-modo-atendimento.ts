import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ModoAtendimento = "atendente" | "colaborador";

const STORAGE_KEY = "service_desk_modo_atendimento";

function readStoredMode(): ModoAtendimento {
  if (typeof window === "undefined") return "atendente";
  return localStorage.getItem(STORAGE_KEY) === "colaborador" ? "colaborador" : "atendente";
}

export function useModoAtendimento(userId?: string, isAtendente = false) {
  const [modo, setModo] = useState<ModoAtendimento>(() => isAtendente ? readStoredMode() : "atendente");

  useEffect(() => {
    if (!userId || !isAtendente) {
      setModo("atendente");
      return;
    }

    let active = true;
    const carregar = async () => {
      const stored = readStoredMode();
      const { data, error } = await supabase
        .from("preferencias_atendimento")
        .select("modo_ativo")
        .eq("usuario_id", userId)
        .maybeSingle();

      if (!active) return;

      const next: ModoAtendimento = error
        ? stored
        : data?.modo_ativo === "colaborador"
          ? "colaborador"
          : "atendente";

      setModo(next);
      localStorage.setItem(STORAGE_KEY, next);
    };

    void carregar();
    return () => { active = false; };
  }, [userId, isAtendente]);

  const alterarModo = useCallback(async (next: ModoAtendimento) => {
    if (!isAtendente || !userId) return;

    setModo(next);
    localStorage.setItem(STORAGE_KEY, next);

    const { error: rpcError } = await supabase.rpc("alterar_modo_atendimento", {
      _modo: next,
    });

    if (!rpcError) return;

    const { error: upsertError } = await supabase
      .from("preferencias_atendimento")
      .upsert(
        {
          usuario_id: userId,
          modo_ativo: next,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "usuario_id" },
      );

    if (!upsertError) return;

    const { data: persisted } = await supabase
      .from("preferencias_atendimento")
      .select("modo_ativo")
      .eq("usuario_id", userId)
      .maybeSingle();

    const fallback: ModoAtendimento = persisted?.modo_ativo === "colaborador" ? "colaborador" : "atendente";
    setModo(fallback);
    localStorage.setItem(STORAGE_KEY, fallback);
    throw new Error(rpcError.message || upsertError.message);
  }, [isAtendente, userId]);

  return {
    modo: isAtendente ? modo : "atendente" as ModoAtendimento,
    emModoColaborador: isAtendente && modo === "colaborador",
    alterarModo,
  };
}

export function limparModoAtendimento() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
