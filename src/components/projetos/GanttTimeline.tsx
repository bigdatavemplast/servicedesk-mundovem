import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/lib/projetos/model';
import './gantt.css';
export function GanttTimeline({tasks,mode}:{tasks:Task[];mode:string}) {
 const ref=useRef<HTMLDivElement>(null); const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false; const el=ref.current;if(!el)return;
 setError(false); void import('frappe-gantt').then(({default:Gantt})=>{if(cancelled)return;el.replaceChildren();new Gantt(el,tasks.map(t=>({id:t.id,name:t.titulo.replace(/[<>&"']/g,''),start:t.inicio,end:t.fim,progress:t.progresso,dependencies:t.predecessora_id??'',custom_class:t.marco?'project-milestone':'project-task'})),{language:'pt',view_mode:mode,readonly:true,popup:false,today_button:false,view_mode_select:false,infinite_padding:false,container_height:Math.min(560,120+tasks.length*52),scroll_to:'start',bar_height:28});}).catch(()=>{if(!cancelled)setError(true)});
 return()=>{cancelled=true;el.replaceChildren()};},[tasks,mode]);
 if(!tasks.length)return <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma tarefa no cronograma.</p>;
 return <div className="project-gantt min-w-0 overflow-hidden border-y border-border">{error&&<p role="alert" className="p-4 text-sm text-destructive">Não foi possível carregar o Gantt. As tarefas continuam disponíveis na lista.</p>}<div ref={ref} role="region" aria-label="Cronograma Gantt" tabIndex={0} className="min-h-48 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"/></div>;
}
