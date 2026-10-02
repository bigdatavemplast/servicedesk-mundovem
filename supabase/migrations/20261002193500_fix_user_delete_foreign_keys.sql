-- Preserve historical records while allowing a profile/auth user to be deleted.
alter table public.anexos_chamado alter column autor_id drop not null;
alter table public.chamados alter column solicitante_id drop not null;
alter table public.comentarios_chamado alter column autor_id drop not null;

alter table public.itsm_aprovacoes drop constraint itsm_aprovacoes_aprovador_id_fkey;
alter table public.itsm_aprovacoes add constraint itsm_aprovacoes_aprovador_id_fkey foreign key (aprovador_id) references public.profiles(id) on delete set null;

alter table public.itsm_artigos_conhecimento drop constraint itsm_artigos_conhecimento_autor_id_fkey;
alter table public.itsm_artigos_conhecimento add constraint itsm_artigos_conhecimento_autor_id_fkey foreign key (autor_id) references public.profiles(id) on delete set null;

alter table public.itsm_artigos_conhecimento drop constraint itsm_artigos_conhecimento_revisor_id_fkey;
alter table public.itsm_artigos_conhecimento add constraint itsm_artigos_conhecimento_revisor_id_fkey foreign key (revisor_id) references public.profiles(id) on delete set null;

alter table public.itsm_auditoria drop constraint itsm_auditoria_usuario_id_fkey;
alter table public.itsm_auditoria add constraint itsm_auditoria_usuario_id_fkey foreign key (usuario_id) references public.profiles(id) on delete set null;

alter table public.itsm_mudancas drop constraint itsm_mudancas_aprovador_id_fkey;
alter table public.itsm_mudancas add constraint itsm_mudancas_aprovador_id_fkey foreign key (aprovador_id) references public.profiles(id) on delete set null;

alter table public.itsm_mudancas drop constraint itsm_mudancas_responsavel_id_fkey;
alter table public.itsm_mudancas add constraint itsm_mudancas_responsavel_id_fkey foreign key (responsavel_id) references public.profiles(id) on delete set null;

alter table public.itsm_mudancas drop constraint itsm_mudancas_solicitante_id_fkey;
alter table public.itsm_mudancas add constraint itsm_mudancas_solicitante_id_fkey foreign key (solicitante_id) references public.profiles(id) on delete set null;

alter table public.itsm_politicas_governanca drop constraint itsm_politicas_governanca_aprovador_id_fkey;
alter table public.itsm_politicas_governanca add constraint itsm_politicas_governanca_aprovador_id_fkey foreign key (aprovador_id) references public.profiles(id) on delete set null;

alter table public.itsm_politicas_governanca drop constraint itsm_politicas_governanca_responsavel_id_fkey;
alter table public.itsm_politicas_governanca add constraint itsm_politicas_governanca_responsavel_id_fkey foreign key (responsavel_id) references public.profiles(id) on delete set null;

alter table public.itsm_problemas drop constraint itsm_problemas_criado_por_fkey;
alter table public.itsm_problemas add constraint itsm_problemas_criado_por_fkey foreign key (criado_por) references public.profiles(id) on delete set null;

alter table public.itsm_problemas drop constraint itsm_problemas_responsavel_id_fkey;
alter table public.itsm_problemas add constraint itsm_problemas_responsavel_id_fkey foreign key (responsavel_id) references public.profiles(id) on delete set null;

alter table public.itsm_relacionamentos drop constraint itsm_relacionamentos_criado_por_fkey;
alter table public.itsm_relacionamentos add constraint itsm_relacionamentos_criado_por_fkey foreign key (criado_por) references public.profiles(id) on delete set null;
