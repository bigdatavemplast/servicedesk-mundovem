CREATE TABLE public.projetos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 titulo text NOT NULL CHECK(length(trim(titulo)) BETWEEN 1 AND 180), objetivo text NOT NULL DEFAULT '',
 area_id uuid REFERENCES public.areas(id), gerente_id uuid REFERENCES public.profiles(id), sponsor text NOT NULL DEFAULT '',
 inicio date NOT NULL, fim date NOT NULL, status text NOT NULL DEFAULT 'planejamento' CHECK(status IN ('planejamento','em_andamento','suspenso','concluido','cancelado')),
 farol text NOT NULL DEFAULT 'verde' CHECK(farol IN ('verde','amarelo','vermelho')),
 criado_por uuid NOT NULL REFERENCES public.profiles(id), criado_em timestamptz NOT NULL DEFAULT now(), CHECK(fim >= inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.projetos_numero_seq TO authenticated, service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.projeto_compartilhamentos (
 projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
 usuario_id uuid NOT NULL REFERENCES public.profiles(id), permissao text NOT NULL CHECK(permissao IN ('leitura','edicao')),
 PRIMARY KEY(projeto_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_compartilhamentos TO authenticated;
GRANT ALL ON public.projeto_compartilhamentos TO service_role;
ALTER TABLE public.projeto_compartilhamentos ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.projeto_fases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
 nome text NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 120), ordem integer NOT NULL DEFAULT 0, UNIQUE(id, projeto_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_fases TO authenticated;
GRANT ALL ON public.projeto_fases TO service_role;
ALTER TABLE public.projeto_fases ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.projeto_tarefas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
 fase_id uuid, titulo text NOT NULL CHECK(length(trim(titulo)) BETWEEN 1 AND 180), descricao text NOT NULL DEFAULT '',
 responsavel_id uuid REFERENCES public.profiles(id), inicio date NOT NULL, fim date NOT NULL,
 progresso integer NOT NULL DEFAULT 0 CHECK(progresso BETWEEN 0 AND 100), marco boolean NOT NULL DEFAULT false,
 predecessora_id uuid, ordem integer NOT NULL DEFAULT 0, UNIQUE(id, projeto_id),
 FOREIGN KEY(fase_id, projeto_id) REFERENCES public.projeto_fases(id, projeto_id),
 FOREIGN KEY(predecessora_id, projeto_id) REFERENCES public.projeto_tarefas(id, projeto_id),
 CHECK(fim >= inicio), CHECK(predecessora_id IS NULL OR predecessora_id <> id), CHECK(NOT marco OR inicio = fim)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefas TO authenticated;
GRANT ALL ON public.projeto_tarefas TO service_role;
ALTER TABLE public.projeto_tarefas ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.projeto_atualizacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
 autor_id uuid NOT NULL REFERENCES public.profiles(id), entregas text NOT NULL DEFAULT '', proximos_passos text NOT NULL DEFAULT '',
 impedimentos text NOT NULL DEFAULT '', criado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(length(trim(entregas || proximos_passos || impedimentos)) > 0)
);
GRANT SELECT, INSERT ON public.projeto_atualizacoes TO authenticated;
GRANT ALL ON public.projeto_atualizacoes TO service_role;
ALTER TABLE public.projeto_atualizacoes ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.projeto_e_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND ativo) AND public.has_role(auth.uid(),'admin');
$$;
REVOKE ALL ON FUNCTION public.projeto_e_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projeto_e_admin() TO authenticated, service_role;
CREATE FUNCTION public.projeto_acesso(p_projeto uuid, p_edicao boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND ativo) AND
 (public.projeto_e_admin() OR EXISTS(SELECT 1 FROM public.projeto_compartilhamentos WHERE projeto_id=p_projeto AND usuario_id=auth.uid() AND (NOT p_edicao OR permissao='edicao')));
$$;
REVOKE ALL ON FUNCTION public.projeto_acesso(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projeto_acesso(uuid,boolean) TO authenticated, service_role;
CREATE POLICY projetos_ler ON public.projetos FOR SELECT TO authenticated USING(public.projeto_acesso(id));
CREATE POLICY projetos_criar ON public.projetos FOR INSERT TO authenticated WITH CHECK(public.projeto_e_admin() AND criado_por=auth.uid());
CREATE POLICY projetos_editar ON public.projetos FOR UPDATE TO authenticated USING(public.projeto_e_admin()) WITH CHECK(public.projeto_e_admin());
CREATE POLICY compartilhamentos_ler ON public.projeto_compartilhamentos FOR SELECT TO authenticated USING(public.projeto_e_admin() OR usuario_id=auth.uid());
CREATE POLICY compartilhamentos_admin ON public.projeto_compartilhamentos FOR ALL TO authenticated USING(public.projeto_e_admin()) WITH CHECK(public.projeto_e_admin());
CREATE POLICY fases_ler ON public.projeto_fases FOR SELECT TO authenticated USING(public.projeto_acesso(projeto_id));
CREATE POLICY fases_admin ON public.projeto_fases FOR ALL TO authenticated USING(public.projeto_e_admin()) WITH CHECK(public.projeto_e_admin());
CREATE POLICY tarefas_ler ON public.projeto_tarefas FOR SELECT TO authenticated USING(public.projeto_acesso(projeto_id));
CREATE POLICY tarefas_admin ON public.projeto_tarefas FOR ALL TO authenticated USING(public.projeto_e_admin()) WITH CHECK(public.projeto_e_admin());
CREATE POLICY atualizacoes_ler ON public.projeto_atualizacoes FOR SELECT TO authenticated USING(public.projeto_acesso(projeto_id));
CREATE POLICY atualizacoes_criar ON public.projeto_atualizacoes FOR INSERT TO authenticated WITH CHECK(public.projeto_acesso(projeto_id,true) AND autor_id=auth.uid());
CREATE INDEX projeto_tarefas_projeto_idx ON public.projeto_tarefas(projeto_id);
CREATE INDEX projeto_compartilhamentos_usuario_idx ON public.projeto_compartilhamentos(usuario_id);
CREATE INDEX projeto_atualizacoes_projeto_idx ON public.projeto_atualizacoes(projeto_id,criado_em);
CREATE FUNCTION public.projeto_validar_tarefa() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_fim date; v_ciclo boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.projeto_id::text,0));
 IF NEW.predecessora_id IS NOT NULL THEN
  SELECT fim INTO v_fim FROM public.projeto_tarefas WHERE id=NEW.predecessora_id AND projeto_id=NEW.projeto_id;
  IF v_fim IS NULL OR NEW.inicio <= v_fim THEN RAISE EXCEPTION 'A tarefa deve começar após a conclusão da predecessora.'; END IF;
  WITH RECURSIVE cadeia AS (SELECT id, predecessora_id FROM public.projeto_tarefas WHERE id=NEW.predecessora_id UNION SELECT t.id,t.predecessora_id FROM public.projeto_tarefas t JOIN cadeia c ON t.id=c.predecessora_id)
  SELECT EXISTS(SELECT 1 FROM cadeia WHERE id=NEW.id) INTO v_ciclo;
  IF v_ciclo THEN RAISE EXCEPTION 'A dependência cria um ciclo.'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.projeto_tarefas WHERE predecessora_id=NEW.id AND inicio <= NEW.fim) THEN RAISE EXCEPTION 'O término conflita com uma tarefa sucessora.'; END IF;
 IF NEW.responsavel_id IS NOT NULL AND NOT (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.responsavel_id AND role='admin') OR EXISTS(SELECT 1 FROM public.projeto_compartilhamentos WHERE projeto_id=NEW.projeto_id AND usuario_id=NEW.responsavel_id)) THEN RAISE EXCEPTION 'Compartilhe o projeto com o responsável antes de atribuir a tarefa.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.projeto_validar_tarefa() FROM PUBLIC, anon;
CREATE TRIGGER projeto_validar_tarefa BEFORE INSERT OR UPDATE ON public.projeto_tarefas FOR EACH ROW EXECUTE FUNCTION public.projeto_validar_tarefa();
CREATE FUNCTION public.projeto_atualizar_progresso(p_tarefa uuid,p_progresso integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tarefa public.projeto_tarefas;
BEGIN
 SELECT * INTO v_tarefa FROM public.projeto_tarefas WHERE id=p_tarefa FOR UPDATE;
 IF NOT FOUND OR NOT public.projeto_acesso(v_tarefa.projeto_id,true) OR (NOT public.projeto_e_admin() AND v_tarefa.responsavel_id IS DISTINCT FROM auth.uid()) THEN RAISE EXCEPTION 'Sem permissão para atualizar esta tarefa.'; END IF;
 IF p_progresso IS NULL OR p_progresso NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Informe um progresso entre 0 e 100.'; END IF;
 UPDATE public.projeto_tarefas SET progresso=p_progresso WHERE id=p_tarefa;
END $$;
REVOKE ALL ON FUNCTION public.projeto_atualizar_progresso(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.projeto_atualizar_progresso(uuid,integer) TO authenticated, service_role;