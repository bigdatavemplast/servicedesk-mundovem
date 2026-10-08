CREATE OR REPLACE FUNCTION public.atribuir_chamado(_chamado_id uuid, _atendente_id uuid)
RETURNS public.chamados
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result public.chamados;
  v_atual_atendente uuid;
  v_solicitante uuid;
  v_segmento_id uuid;
  v_grupo_atendimento_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT atendente_id, solicitante_id, segmento_id, grupo_atendimento_id
    INTO v_atual_atendente, v_solicitante, v_segmento_id, v_grupo_atendimento_id
  FROM public.chamados
  WHERE id = _chamado_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado.';
  END IF;

  IF public.has_role(v_actor, 'admin') THEN
    NULL;
  ELSIF public.has_role(v_actor, 'atendente') THEN
    IF _atendente_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Atendente só pode atribuir o chamado para si mesmo.';
    END IF;

    IF v_atual_atendente IS NOT NULL AND v_atual_atendente <> v_actor THEN
      RAISE EXCEPTION 'Somente o atendente responsável pode alterar a atribuição deste chamado.';
    END IF;

    IF v_grupo_atendimento_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
          FROM public.grupo_atendentes ga
          JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
         WHERE ga.usuario_id = v_actor
           AND ga.grupo_id = v_grupo_atendimento_id
           AND ga.ativo = TRUE
           AND g.ativo = TRUE
      ) THEN
        RAISE EXCEPTION 'Atendente só pode assumir chamados da sua fila/grupo de atendimento.';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1
        FROM public.grupo_atendentes ga
        JOIN public.grupos_atendimento g ON g.id = ga.grupo_id
       WHERE ga.usuario_id = v_actor
         AND ga.ativo = TRUE
         AND g.ativo = TRUE
         AND g.segmento_id = v_segmento_id
    ) THEN
      RAISE EXCEPTION 'Atendente só pode assumir chamados do seu setor/grupo de atendimento.';
    END IF;
  ELSIF public.has_role(v_actor, 'gestor') THEN
    IF NOT public.gestor_mesma_area(v_actor, v_solicitante) THEN
      RAISE EXCEPTION 'Você não tem permissão para atribuir este chamado.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Você não tem permissão para atribuir o chamado.';
  END IF;

  IF _atendente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _atendente_id
      AND ur.role IN ('atendente','gestor','admin')
  ) THEN
    RAISE EXCEPTION 'O responsável selecionado não possui perfil de atendimento.';
  END IF;

  UPDATE public.chamados
     SET atendente_id = _atendente_id
   WHERE id = _chamado_id
   RETURNING * INTO v_result;

  RETURN v_result;
END;
$function$;
