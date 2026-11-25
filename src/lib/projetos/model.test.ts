import { describe, it, expect } from 'vitest';
import { canViewProject, canUpdateTask, taskSchema, projectSchema } from './model';
const read = {projeto_id:'p',usuario_id:'u',permissao:'leitura'} as const;
const edit = {...read,permissao:'edicao'} as const;
describe('Privacidade dos projetos',()=>{
 it('administrador pode visualizar projeto não compartilhado',()=>expect(canViewProject(true)).toBe(true));
 it('usuário sem compartilhamento não acessa',()=>expect(canViewProject(false)).toBe(false));
 it('visualizador compartilhado pode visualizar',()=>expect(canViewProject(false,read)).toBe(true));
 it('visualizador não atualiza nem tarefa própria',()=>expect(canUpdateTask(false,read,'u','u')).toBe(false));
 it('editor atualiza tarefa própria',()=>expect(canUpdateTask(false,edit,'u','u')).toBe(true));
 it('editor não atualiza tarefa de outro',()=>expect(canUpdateTask(false,edit,'u','outro')).toBe(false));
 it('administrador atualiza tarefa de outro',()=>expect(canUpdateTask(true,undefined,'a','outro')).toBe(true));
});
const task={titulo:'Entrega',descricao:'',inicio:'2026-11-25',fim:'2026-11-26',progresso:0,responsavel_id:null,fase_id:null,predecessora_id:null,marco:false,ordem:0};
describe('Cronograma',()=>{
 it('rejeita término anterior ao início',()=>expect(taskSchema.safeParse({...task,fim:'2026-11-24'}).success).toBe(false));
 it('rejeita marco de vários dias',()=>expect(taskSchema.safeParse({...task,marco:true}).success).toBe(false));
 it('rejeita progresso maior que 100',()=>expect(taskSchema.safeParse({...task,progresso:101}).success).toBe(false));
 it('rejeita datas inexistentes',()=>expect(taskSchema.safeParse({...task,inicio:'2026-02-30'}).success).toBe(false));
 it('rejeita projeto sem título',()=>expect(projectSchema.safeParse({titulo:' ',objetivo:'',sponsor:'',inicio:'2026-11-25',fim:'2026-11-26',area_id:null,gerente_id:null,status:'planejamento',farol:'verde'}).success).toBe(false));
});
