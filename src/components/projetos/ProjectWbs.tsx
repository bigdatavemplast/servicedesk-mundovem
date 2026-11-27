import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Check, Diamond, Plus } from 'lucide-react';
import type { Task, Phase, Person } from '@/lib/projetos/model';
import { formatDate, projectProgress } from '@/lib/projetos/model';
import { Button } from '@/components/ui/button';

type Row = { id: string; nome: string; tasks: Task[] };
function span(tasks: Task[]) {
  if (!tasks.length) return { inicio: '', fim: '' };
  return { inicio: tasks.reduce((m, t) => t.inicio < m ? t.inicio : m, tasks[0]!.inicio), fim: tasks.reduce((m, t) => t.fim > m ? t.fim : m, tasks[0]!.fim) };
}
function Bar({ value }: { value: number }) {
  return <div className="flex items-center gap-2"><div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted"><div className={`h-full ${value >= 100 ? 'bg-green-700' : 'bg-primary'}`} style={{ width: `${value}%` }} /></div><span className="w-10 text-right text-xs tabular-nums">{value}%</span></div>;
}

export function ProjectWbs({ title, tasks, phases, people, isAdmin, onAdd, onEdit }: { title: string; tasks: Task[]; phases: Phase[]; people: Person[]; isAdmin: boolean; onAdd: (phaseId: string | null) => void; onEdit: (t: Task) => void }) {
  const [resource, setResource] = useState('todos');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const name = (id: string | null) => people.find(p => p.id === id)?.nome ?? '';
  const visible = resource === 'todos' ? tasks : tasks.filter(t => t.responsavel_id === resource);
  const groups = useMemo<Row[]>(() => {
    const rows: Row[] = [...phases].sort((a, b) => a.ordem - b.ordem).map(f => ({ id: f.id, nome: f.nome, tasks: visible.filter(t => t.fase_id === f.id) }));
    const loose = visible.filter(t => !t.fase_id || !phases.some(f => f.id === t.fase_id));
    if (loose.length) rows.push({ id: 'sem-fase', nome: 'Sem fase', tasks: loose });
    return rows;
  }, [phases, visible]);
  const all = span(visible);
  const toggle = (id: string) => setClosed(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const resources = people.filter(p => tasks.some(t => t.responsavel_id === p.id));
  const rootOpen = !closed.has('root');

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="wbs-resource" className="text-sm">Recurso:</label>
      <select id="wbs-resource" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={resource} onChange={e => setResource(e.target.value)}>
        <option value="todos">Todos</option>{resources.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
      <Button size="sm" variant="outline" onClick={() => setClosed(new Set())}>Expandir tudo</Button>
      <Button size="sm" variant="outline" onClick={() => setClosed(new Set(['root', ...groups.map(g => g.id)]))}>Recolher tudo</Button>
    </div>
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Título</th><th className="px-3 py-2 font-medium">Recursos</th><th className="px-3 py-2 font-medium">Início</th><th className="px-3 py-2 font-medium">Término</th><th className="px-3 py-2 font-medium">Progresso</th>{isAdmin && <th className="px-3 py-2" />}</tr></thead>
        <tbody>
          <tr className="border-t font-semibold">
            <td className="px-3 py-2"><button type="button" className="inline-flex items-center gap-1" aria-expanded={rootOpen} onClick={() => toggle('root')}>{rootOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{title}</button></td>
            <td /><td className="px-3 py-2">{all.inicio && formatDate(all.inicio)}</td><td className="px-3 py-2">{all.fim && formatDate(all.fim)}</td><td className="px-3 py-2"><Bar value={projectProgress(visible)} /></td>{isAdmin && <td />}
          </tr>
          {rootOpen && groups.map(g => { const open = !closed.has(g.id); const s = span(g.tasks); return [
            <tr key={g.id} className="border-t bg-muted/40 font-semibold">
              <td className="py-2 pl-8 pr-3"><button type="button" className="inline-flex items-center gap-1" aria-expanded={open} onClick={() => toggle(g.id)}>{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{g.nome}</button></td>
              <td /><td className="px-3 py-2">{s.inicio && formatDate(s.inicio)}</td><td className="px-3 py-2">{s.fim && formatDate(s.fim)}</td><td className="px-3 py-2"><Bar value={projectProgress(g.tasks)} /></td>
              {isAdmin && <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => onAdd(g.id === 'sem-fase' ? null : g.id)}><Plus />Tarefa</Button></td>}
            </tr>,
            ...(open ? (g.tasks.length ? g.tasks.map(t => <tr key={t.id} className="border-t">
              <td className="py-2 pl-14 pr-3"><span className="inline-flex items-center gap-2">{t.marco ? <Diamond className="size-3.5 shrink-0 text-primary" /> : <Check className={`size-4 shrink-0 ${t.progresso >= 100 ? 'text-green-700' : 'text-muted-foreground'}`} />}{t.titulo}</span></td>
              <td className="px-3 py-2">{name(t.responsavel_id)}</td><td className="px-3 py-2">{formatDate(t.inicio)}</td><td className="px-3 py-2">{formatDate(t.fim)}</td><td className="px-3 py-2"><Bar value={t.progresso} /></td>
              {isAdmin && <td className="px-3 py-2 text-right"><Button size="sm" variant="outline" onClick={() => onEdit(t)}>Editar</Button></td>}
            </tr>) : [<tr key={`${g.id}-empty`} className="border-t"><td colSpan={isAdmin ? 6 : 5} className="py-2 pl-14 text-xs text-muted-foreground">Nenhuma tarefa nesta fase.</td></tr>]) : []),
          ]; })}
          {rootOpen && !groups.length && <tr className="border-t"><td colSpan={isAdmin ? 6 : 5} className="py-6 text-center text-muted-foreground">Nenhuma fase ou tarefa cadastrada.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
