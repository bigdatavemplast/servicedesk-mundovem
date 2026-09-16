import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ModoAtendimento = "atendente" | "colaborador";

const STORAGE_KEY = "service_desk_modo_atendimento";

function readStoredMode(): ModoAtendimento {
  if (typeof window === "undefined") return "atendente";
  return localStorage.getItem(STORAGE_KEY) === "colaborador" ? "colaborador" : "atendente";
}

export function useModoAtendimento(userId?: string, isAtendente = false) {
  const [modo, setModo] = useState<ModoAtendimento>("atendente");

  useEffect(() => {
    if (!userId || !isAtendente) {
      setModo("atendente");
      return;
    }

    let active = true;
    const carregar = async () => {
      const stored = readStoredMode();
      const { data } = await (supabase as any)
        .from("preferencias_atendimento")
        .select("modo_ativo")
        .eq("usuario_id", userId)
        .maybeSingle();

      if (!active) return;
      const next: ModoAtendimento = data?.modo_ativo === "colaborador" || stored === "colaborador"
        ? "colaborador"
        : "atendente";
      setModo(next);
      localStorage.setItem(STORAGE_KEY, next);
    };

    void carregar();
    return () => { active = false; };
  }, [userId, isAtendente]);

  const alterarModo = useCallback(async (next: ModoAtendimento) => {
    if (!isAtendente) return;
    const { data, error } = await (supabase as any).rpc("alterar_modo_atendimento", { _modo: next });
    if (error) throw new Error(error.message);
    const confirmado: ModoAtendimento = data === "colaborador" ? "colaborador" : "atendente";
    localStorage.setItem(STORAGE_KEY, confirmado);
    setModo(confirmado);
  }, [isAtendente]);

  return {
    modo: isAtendente ? modo : "atendente" as ModoAtendimento,
    emModoColaborador: isAtendente && modo === "colaborador",
    alterarModo,
  };
}

export function limparModoAtendimento() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
