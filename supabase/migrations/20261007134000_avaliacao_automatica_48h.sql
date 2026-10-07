-- Avaliação automática após 48 horas
CREATE OR REPLACE FUNCTION public.avaliar_chamado(_chamado_id uuid,_nota integer,_comentario text default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_chamado public.chamados%rowtype; v_agora timestamptz:=now(); v_nota integer; v_comentario text; v_automatica boolean:=false;
BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado.'; END IF;
IF _nota<1 OR _nota>5 THEN RAISE EXCEPTION 'A nota deve estar entre 1 e 5.'; END IF;
SELECT * INTO v_chamado FROM public.chamados WHERE id=_chamado_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Chamado não encontrado.'; END IF;
IF v_chamado.solicitante_id<>auth.uid() THEN RAISE EXCEPTION 'Somente o solicitante pode avaliar o chamado.'; END IF;
IF v_chamado.status<>'resolvido' THEN RAISE EXCEPTION 'O chamado precisa estar resolvido para ser avaliado.'; END IF;
IF v_chamado.avaliacao_nota IS NOT NULL THEN RAISE EXCEPTION 'Este chamado já foi avaliado.'; END IF;
IF v_chamado.resolvido_em IS NULL THEN RAISE EXCEPTION 'O chamado não possui data de resolução válida.'; END IF;
IF v_chamado.resolvido_em<=v_agora-interval '48 hours' THEN
v_nota:=5; v_comentario:='Avaliação automática: o colaborador não avaliou o chamado dentro de 48 horas após a resolução.'; v_automatica:=true;
ELSE v_nota:=_nota; v_comentario:=nullif(trim(coalesce(_comentario,'')),''); END IF;
UPDATE public.chamados SET avaliacao_nota=v_nota,avaliacao_comentario=v_comentario,status='fechado',fechado_em=v_agora,sla_pausado=false WHERE id=_chamado_id;
INSERT INTO public.historico_chamado(chamado_id,autor_id,acao,de,para) VALUES(_chamado_id,CASE WHEN v_automatica THEN NULL ELSE auth.uid() END,CASE WHEN v_automatica THEN 'avaliacao_automatica' ELSE 'avaliacao_registrada' END,'resolvido',CASE WHEN v_automatica THEN 'fechado — 5 estrelas automáticas' ELSE format('fechado — %s estrelas',v_nota) END);
RETURN jsonb_build_object('ok',true,'status','fechado','avaliacao_nota',v_nota,'avaliacao_automatica',v_automatica,'fechado_em',v_agora);
END;$function$;

CREATE OR REPLACE FUNCTION public.auto_avaliar_chamados_expirados()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $function$
DECLARE v_chamado public.chamados%rowtype; v_agora timestamptz:=now();
BEGIN
FOR v_chamado IN SELECT * FROM public.chamados WHERE status='resolvido' AND avaliacao_nota IS NULL AND resolvido_em IS NOT NULL AND resolvido_em<=v_agora-interval '48 hours' FOR UPDATE
LOOP
UPDATE public.chamados SET avaliacao_nota=5,avaliacao_comentario='Avaliação automática: o colaborador não avaliou o chamado dentro de 48 horas após a resolução.',status='fechado',fechado_em=coalesce(fechado_em,v_agora),sla_pausado=false WHERE id=v_chamado.id;
INSERT INTO public.historico_chamado(chamado_id,autor_id,acao,de,para) VALUES(v_chamado.id,NULL,'avaliacao_automatica','resolvido','fechado — 5 estrelas automáticas');
END LOOP;
END;$function$;