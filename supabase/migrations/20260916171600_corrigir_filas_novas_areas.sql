-- ============================================================
-- Service Desk - corrigir filas das novas áreas
-- Mantém áreas já configuradas sem alteração.
-- Garante uma fila utilizável somente para segmentos ativos que
-- ainda não possuem fila ou possuem fila sem nenhum atendente.
-- ============================================================

DO $$
DECLARE
  v_segmento RECORD;
  v_grupo_id UUID;
BEGIN
  FOR v_segmento IN
    SELECT id, nome
    FROM public.segmentos
    WHERE ativo = TRUE
  LOOP
    -- Só cria uma fila padrão se a área ainda não possuir nenhuma fila ativa.
    SELECT g.id
      INTO v_grupo_id
    FROM public.grupos_atendimento g
    WHERE g.segmento_id = v_segmento.id
      AND g.ativo = TRUE
    ORDER BY g.ordem, g.nome
    LIMIT 1;

    IF v_grupo_id IS NULL THEN
      INSERT INTO public.grupos_atendimento (segmento_id, nome, descricao, ativo, ordem)
      VALUES (
        v_segmento.id,
        'Atendimento Geral',
        'Fila padrão da área',
        TRUE,
        1
      )
      ON CONFLICT (segmento_id, nome) DO UPDATE
        SET ativo = TRUE
      RETURNING id INTO v_grupo_id;
    END IF;

    -- Se a área possui fila, mas nenhuma pessoa está vinculada a ela,
    -- disponibiliza os perfis de atendimento existentes para a fila.
    -- Filas que já possuem atendentes não são alteradas.
    IF NOT EXISTS (
      SELECT 1
      FROM public.grupo_atendentes ga
      WHERE ga.grupo_id = v_grupo_id
        AND ga.ativo = TRUE
    ) THEN
      INSERT INTO public.grupo_atendentes (grupo_id, usuario_id, ativo)
      SELECT v_grupo_id, ur.user_id, TRUE
      FROM public.user_roles ur
      WHERE ur.role IN ('atendente', 'gestor', 'admin')
      ON CONFLICT (grupo_id, usuario_id) DO UPDATE
        SET ativo = TRUE;
    END IF;
  END LOOP;
END $$;
