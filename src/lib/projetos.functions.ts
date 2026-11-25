import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { projectSchema, taskSchema } from '@/lib/projetos/model';
import type { Project, Task, Phase, Share, Person, Update } from '@/lib/projetos/model';
const idSchema = z.object({id:z.string().uuid()});
async function admin(db:any) { const r=await db.rpc('projeto_e_admin'); if(r.error) throw new Error(r.error.message); if(!r.data) throw new Error('Apenas administradores podem realizar esta ação.'); }
function checked(r:any) { if(r.error) throw new Error(r.error.message); return r.data; }
export const listProjects = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const db=context.supabase; const [p,t,a]=await Promise.all([db.from('projetos').select('*').order('numero',{ascending:false}),db.from('projeto_tarefas').select('*').order('ordem'),db.rpc('projeto_e_admin')]);
 return {projects:checked(p) as Project[],tasks:checked(t) as Task[],isAdmin:!!checked(a)};
});
export const projectOptions = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await admin(context.supabase); const [people,areas]=await Promise.all([context.supabase.from('profiles').select('id,nome').eq('ativo',true).order('nome'),context.supabase.from('areas').select('id,nome').eq('ativo',true).order('nome')]);
 return {people:checked(people) as Person[],areas:checked(areas) as Person[]};
});
export const getProject = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator(d=>idSchema.parse(d)).handler(async({data,context})=>{
 const db=context.supabase; const p=checked(await db.from('projetos').select('*').eq('id',data.id).maybeSingle()) as Project|null;
 if(!p) throw new Error('Projeto não encontrado ou não compartilhado com você.');
 const [t,f,s,u,a,people]=await Promise.all([db.from('projeto_tarefas').select('*').eq('projeto_id',data.id).order('ordem').order('inicio'),db.from('projeto_fases').select('*').eq('projeto_id',data.id).order('ordem'),db.from('projeto_compartilhamentos').select('*').eq('projeto_id',data.id),db.from('projeto_atualizacoes').select('*').eq('projeto_id',data.id).order('criado_em',{ascending:false}),db.rpc('projeto_e_admin'),db.from('profiles').select('id,nome').eq('ativo',true).order('nome')]);
 return {project:p,tasks:checked(t) as Task[],phases:checked(f) as Phase[],shares:checked(s) as Share[],updates:checked(u) as Update[],isAdmin:!!checked(a),people:checked(people) as Person[],userId:context.userId};
});
export const saveProject = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid().optional(),project:projectSchema}).parse(d)).handler(async({data,context})=>{
 const db=context.supabase; await admin(db);
 const r=data.id ? await db.from('projetos').update(data.project).eq('id',data.id).select('id').single() : await db.from('projetos').insert({...data.project,criado_por:context.userId}).select('id').single();
 return checked(r) as {id:string};
});
export const saveTask = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid().optional(),projectId:z.string().uuid(),task:taskSchema}).parse(d)).handler(async({data,context})=>{
 const db=context.supabase; await admin(db); const r=data.id ? await db.from('projeto_tarefas').update(data.task).eq('id',data.id).eq('projeto_id',data.projectId).select('id').single() : await db.from('projeto_tarefas').insert({...data.task,projeto_id:data.projectId}).select('id').single();
 return checked(r) as {id:string};
});
export const addPhase = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({projectId:z.string().uuid(),nome:z.string().trim().min(1).max(120),ordem:z.number().int()}).parse(d)).handler(async({data,context})=>{
 await admin(context.supabase); checked(await context.supabase.from('projeto_fases').insert({projeto_id:data.projectId,nome:data.nome,ordem:data.ordem})); return {ok:true};
});
export const shareProject = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({projectId:z.string().uuid(),userId:z.string().uuid(),permission:z.enum(['leitura','edicao']).nullable()}).parse(d)).handler(async({data,context})=>{
 const db=context.supabase; await admin(db); checked(data.permission ? await db.from('projeto_compartilhamentos').upsert({projeto_id:data.projectId,usuario_id:data.userId,permissao:data.permission},{onConflict:'projeto_id,usuario_id'}) : await db.from('projeto_compartilhamentos').delete().eq('projeto_id',data.projectId).eq('usuario_id',data.userId)); return {ok:true};
});
export const updateTaskProgress = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({taskId:z.string().uuid(),progress:z.number().int().min(0).max(100)}).parse(d)).handler(async({data,context})=>{checked(await context.supabase.rpc('projeto_atualizar_progresso',{p_tarefa:data.taskId,p_progresso:data.progress})); return {ok:true};});
export const addProjectUpdate = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({projectId:z.string().uuid(),entregas:z.string().trim().max(10000),proximos_passos:z.string().trim().max(10000),impedimentos:z.string().trim().max(10000)}).refine(v=>!!(v.entregas||v.proximos_passos||v.impedimentos),'Preencha pelo menos uma atualização.').parse(d)).handler(async({data,context})=>{checked(await context.supabase.from('projeto_atualizacoes').insert({projeto_id:data.projectId,autor_id:context.userId,entregas:data.entregas,proximos_passos:data.proximos_passos,impedimentos:data.impedimentos}));return {ok:true};});
