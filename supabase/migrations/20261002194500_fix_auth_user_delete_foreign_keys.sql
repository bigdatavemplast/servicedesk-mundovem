-- Allow auth user deletion while preserving historical records.
alter table public.anexos_chamado drop constraint if exists anexos_chamado_autor_id_fkey;
alter table public.anexos_chamado add constraint anexos_chamado_autor_id_fkey foreign key (autor_id) references auth.users(id) on delete set null;

alter table public.base_conhecimento drop constraint if exists base_conhecimento_autor_id_fkey;
alter table public.base_conhecimento add constraint base_conhecimento_autor_id_fkey foreign key (autor_id) references auth.users(id) on delete set null;

alter table public.chamados drop constraint if exists chamados_atendente_id_fkey;
alter table public.chamados add constraint chamados_atendente_id_fkey foreign key (atendente_id) references auth.users(id) on delete set null;

alter table public.chamados drop constraint if exists chamados_solicitante_id_fkey;
alter table public.chamados add constraint chamados_solicitante_id_fkey foreign key (solicitante_id) references auth.users(id) on delete set null;

alter table public.comentarios_chamado drop constraint if exists comentarios_chamado_autor_id_fkey;
alter table public.comentarios_chamado add constraint comentarios_chamado_autor_id_fkey foreign key (autor_id) references auth.users(id) on delete set null;

alter table public.historico_chamado drop constraint if exists historico_chamado_autor_id_fkey;
alter table public.historico_chamado add constraint historico_chamado_autor_id_fkey foreign key (autor_id) references auth.users(id) on delete set null;