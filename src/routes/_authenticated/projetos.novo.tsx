import { createFileRoute,Link,useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { optionsQuery } from '@/lib/projetos/queries';
import { ProjectForm } from '@/components/projetos/ProjectControls';
import { ProjectError,ProjectPending } from '@/components/projetos/ProjectStates';
import { Button } from '@/components/ui/button';
export const Route=createFileRoute('/_authenticated/projetos/novo')({head:()=>({meta:[{title:'Novo projeto | Vemplast Support Hub'},{name:'description',content:'Abertura de projeto com prazos, escopo e responsáveis.'},{property:'og:title',content:'Novo projeto | Vemplast Support Hub'},{property:'og:description',content:'Cadastro de projetos corporativos.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),loader:({context})=>context.queryClient.ensureQueryData(optionsQuery(context.user.id)),errorComponent:ProjectError,pendingComponent:ProjectPending,component:NewProject});
function NewProject(){const {user}=Route.useRouteContext();const {data}=useSuspenseQuery(optionsQuery(user.id));const navigate=useNavigate();return <div className="space-y-6"><Button asChild><Link to="/projetos"><ArrowLeft/>Projetos</Link></Button><header><h1 className="text-2xl font-bold">Novo projeto</h1><p className="mt-1 text-sm text-muted-foreground">Acesso inicial exclusivo para administradores.</p></header><ProjectForm people={data.people} areas={data.areas} onSaved={id=>void navigate({to:'/projetos/$id',params:{id}})}/></div>}
