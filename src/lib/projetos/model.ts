import { z } from 'zod';
export const projectStatuses = { planejamento: 'Planejamento', em_andamento: 'Em andamento', suspenso: 'Suspenso', concluido: 'Concluído', cancelado: 'Cancelado' };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Data inválida');
export const projectSchema = z.object({ titulo: z.string().trim().min(1,'Informe o título').max(180), objetivo: z.string().trim().max(10000), sponsor: z.string().trim().max(180), inicio: date, fim: date, area_id: z.string().uuid().nullable(), gerente_id: z.string().uuid().nullable(), status: z.enum(['planejamento','em_andamento','suspenso','concluido','cancelado']), farol: z.enum(['verde','amarelo','vermelho']) }).refine(d=>d.fim >= d.inicio,{message:'O término deve ser igual ou posterior ao início',path:['fim']});
export const taskSchema = z.object({ titulo: z.string().trim().min(1,'Informe a tarefa').max(180), descricao: z.string().trim().max(10000), inicio: date, fim: date, progresso: z.number().int().min(0).max(100), responsavel_id: z.string().uuid().nullable(), fase_id: z.string().uuid().nullable(), predecessora_id: z.string().uuid().nullable(), marco: z.boolean(), ordem: z.number().int() }).refine(d=>d.fim >= d.inicio,{message:'O término não pode ser anterior ao início',path:['fim']}).refine(d=>!d.marco || d.fim === d.inicio,{message:'Um marco deve ocorrer em um único dia',path:['fim']});
export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type Project = ProjectInput & { id: string; numero: number; criado_por: string; criado_em: string };
export type Task = TaskInput & { id: string; projeto_id: string };
export type Phase = { id: string; nome: string; ordem: number; projeto_id: string };
export type Share = { projeto_id: string; usuario_id: string; permissao: 'leitura'|'edicao' };
export type Person = { id: string; nome: string };
export type Update = { id: string; autor_id: string; entregas: string; proximos_passos: string; impedimentos: string; criado_em: string };
export function projectCode(numero: number) { return `PRJ-${String(numero).padStart(4,'0')}`; }
export function projectProgress(tasks: Pick<Task,'progresso'>[]) { return tasks.length ? Math.round(tasks.reduce((s,t)=>s+t.progresso,0)/tasks.length) : 0; }
export function canViewProject(admin: boolean, share?: Share) { return admin || !!share; }
export function canUpdateTask(admin: boolean, share: Share|undefined, userId: string, responsible: string|null) { return admin || (share?.permissao==='edicao' && userId===responsible); }
export function formatDate(date: string) { return new Date(`${date.slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR'); }
export const primaryAction = 'bg-primary! text-primary-foreground! hover:bg-primary/90! [&_svg]:text-primary-foreground!';
