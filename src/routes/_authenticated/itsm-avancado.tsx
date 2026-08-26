import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, GitBranch, Monitor, Network, BookOpen, ShieldCheck, Scale, ClipboardList } from "lucide-react";
export const Route = createFileRoute("/_authenticated/itsm-avancado")({ component: ItsmAvancado });
const modules = [
  ["Problemas", "Gerencie problemas e causas raiz.", AlertTriangle, "/itsm-problemas"],
  ["Mudanças", "Planeje, aprove e acompanhe mudanças.", GitBranch, "/itsm-mudancas"],
  ["Ativos / CMDB", "Controle ativos e itens de configuração.", Monitor, "/itsm-ativos"],
  ["Serviços", "Gerencie serviços de TI e negócio e seu ciclo de vida.", Network, "/itsm-servicos"],
  ["Relacionamentos", "Visualize e mantenha dependências entre serviços e entidades ITSM.", Network, "/itsm-relacionamentos"],
  ["Catálogo", "Estruture a oferta de atendimento: categorias, subcategorias, tipos e regras.", ClipboardList, "/admin/catalogo"],
  ["Conhecimento", "Administre artigos e conhecimento operacional.", BookOpen],
  ["Auditoria", "Acompanhe alterações e trilhas de auditoria.", ShieldCheck],
  ["Governança", "Controle políticas, revisões e evidências.", Scale],
] as const;
function ItsmAvancado() { const navigate = useNavigate(); return <div className="space-y-6"><div><h1 className="text-2xl font-semibold tracking-tight">ITSM Avançado</h1><p className="text-sm text-muted-foreground">Central de gestão dos processos avançados de ITSM.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title,description,Icon,path])=>{const active=Boolean(path);return <Card key={title} className={active?"cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30":"opacity-60"} onClick={active?()=>navigate({to:path}):undefined} role={active?"button":undefined} tabIndex={active?0:undefined} onKeyDown={active?e=>{if(e.key==="Enter"||e.key===" ")navigate({to:path})}:undefined}><CardHeader className="flex flex-row items-center gap-3 space-y-0"><div className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5"/></div><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{description}</CardContent></Card>})}</div></div> }
