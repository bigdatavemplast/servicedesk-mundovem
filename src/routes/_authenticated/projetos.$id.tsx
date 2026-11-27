import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Plus, UserPlus, Pencil } from 'lucide-react';
import { projectQuery } from '@/lib/projetos/queries';
import { projectCode, projectStatuses, projectProgress, formatDate, primaryAction } from '@/lib/projetos/model';
import type { Task } from '@/lib/projetos/model';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GanttTimeline } from '@/components/projetos/GanttTimeline';
import { TaskDialog, SharingDialog, PhaseForm, UpdateForm, ProjectForm } from '@/components/projetos/ProjectControls';
import { ProjectWbs } from '@/components/projetos/ProjectWbs';
import { ProjectPending, ProjectError } from '@/components/projetos/ProjectStates';

export const Route = createFileRoute('/_authenticated/projetos/$id')({
  head: () => ({ meta: [{ title: 'Projeto | Vemplast Support Hub' }, { name: 'description', content: 'Cronograma Gantt, tarefas e atualizações do projeto.' }, { property: 'og:title', content: 'Projeto | Vemplast Support Hub' }, { property: 'og:description', content: 'Cronograma e acompanhamento do projeto.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(projectQuery(context.user.id, params.id)),
  pendingComponent: ProjectPending,
  errorComponent: ProjectError,
  notFoundComponent: () => <p className="py-12 text-center text-sm">Projeto não encontrado.</p>,
  component: ProjectDetail,
});

function ProjectDetail() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(projectQuery(user.id, id));
  const { project: p, tasks, phases, shares, updates, isAdmin, people } = data;
  const [mode, setMode] = useState('Week');
  const [taskOpen, setTaskOpen] = useState(false);
  const [defaultPhase, setDefaultPhase] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | undefined>();
  const [shareOpen, setShareOpen] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const name = (uid: string | null) => people.find(x => x.id === uid)?.nome ?? '—';
  const myShare = shares.find(s => s.usuario_id === user.id);
  const canUpdate = isAdmin || myShare?.permissao === 'edicao';
  const progress = projectProgress(tasks);
  const { numero, criado_por, criado_em, id: _pid, ...initial } = p;
  return <div className="space-y-6">
    <Button asChild variant="outline"><Link to="/projetos"><ArrowLeft />Projetos</Link></Button>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{projectCode(numero)}</span><Badge variant="outline">{projectStatuses[p.status]}</Badge></div>
        <h1 className="mt-2 break-words text-2xl font-bold">{p.titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatDate(p.inicio)} — {formatDate(p.fim)} · Gerente: {name(p.gerente_id)}</p></div>
      {isAdmin && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditProject(v => !v)}><Pencil />Editar</Button><Button variant="outline" onClick={() => setShareOpen(true)}><UserPlus />Compartilhar</Button><Button className={primaryAction} onClick={() => { setEditing(undefined); setDefaultPhase(null); setTaskOpen(true); }}><Plus />Nova tarefa</Button></div>}
    </header>
    <div className="max-w-md"><div className="mb-2 flex justify-between text-xs"><span>Progresso geral</span><span>{progress}%</span></div><Progress value={progress} aria-label="Progresso geral" /></div>
    {editProject && isAdmin && <ProjectForm id={p.id} initial={initial} people={people} areas={[]} onSaved={() => setEditProject(false)} />}
    {p.objetivo && <p className="whitespace-pre-wrap text-sm">{p.objetivo}</p>}
    <Tabs defaultValue="gantt">
      <TabsList><TabsTrigger value="gantt">Gantt</TabsTrigger><TabsTrigger value="tarefas">Tarefas</TabsTrigger><TabsTrigger value="atualizacoes">Atualizações</TabsTrigger></TabsList>
      <TabsContent value="gantt" className="space-y-3">
        <div className="flex gap-2">{[['Day', 'Dia'], ['Week', 'Semana'], ['Month', 'Mês']].map(([v, l]) => <Button key={v} size="sm" variant={mode === v ? 'default' : 'outline'} onClick={() => setMode(v!)}>{l}</Button>)}</div>
        <GanttTimeline tasks={tasks} mode={mode} />
      </TabsContent>
      <TabsContent value="tarefas" className="space-y-4">
        {isAdmin && <PhaseForm projectId={p.id} order={phases.length} />}
        <ProjectWbs title={p.titulo} tasks={tasks} phases={phases} people={people} isAdmin={isAdmin} onAdd={(faseId) => { setEditing(undefined); setDefaultPhase(faseId); setTaskOpen(true); }} onEdit={(t) => { setEditing(t); setTaskOpen(true); }} />
      </TabsContent>
      <TabsContent value="atualizacoes" className="space-y-4">
        {canUpdate && <UpdateForm projectId={p.id} />}
        {!updates.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma atualização registrada.</p> :
          <div className="divide-y border-y">{updates.map(u => <div key={u.id} className="space-y-1 px-2 py-4 text-sm"><p className="text-xs text-muted-foreground">{name(u.autor_id)} · {new Date(u.criado_em).toLocaleString('pt-BR')}</p>
            {u.entregas && <p><strong>Entregas:</strong> {u.entregas}</p>}{u.proximos_passos && <p><strong>Próximos passos:</strong> {u.proximos_passos}</p>}{u.impedimentos && <p><strong>Impedimentos:</strong> {u.impedimentos}</p>}</div>)}</div>}
      </TabsContent>
    </Tabs>
    {taskOpen && <TaskDialog key={editing?.id ?? 'new'} open onClose={() => setTaskOpen(false)} projectId={p.id} tasks={tasks} phases={phases} people={people} {...(editing ? { task: editing } : {})} start={p.inicio} end={p.fim} defaultPhase={defaultPhase} />}
    {shareOpen && <SharingDialog open onClose={() => setShareOpen(false)} projectId={p.id} people={people} shares={shares} />}
  </div>;
}
