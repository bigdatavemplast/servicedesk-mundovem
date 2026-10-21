import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useModoAtendimento } from "@/hooks/use-modo-atendimento";
import { PlusCircle, ChevronRight, BookOpen, Ticket, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | Mundo Vem Service Desk" }, { name: "description", content: "Indicadores do Service Desk conforme o perfil de acesso." }, { name: "robots", content: "noindex, follow" }] }),
  beforeLoad: async () => { const { data } = await supabase.auth.getUser(); if (!data.user) throw redirect({ to: "/auth" }); },
  component: DashboardPage,
});

const ENCERRADOS = ["resolvido", "fechado", "cancelado"];
const PERIODOS = [7,15,30,90] as const;
const COR_GRAFICO = "hsl(214 70% 55%)";
const COR_CATEGORIA = [
  "hsl(210 38% 78%)",
  "hsl(145 24% 72%)",
  "hsl(270 25% 78%)",
  "hsl(38 42% 76%)",
  "hsl(350 30% 76%)",
  "hsl(190 30% 74%)",
  "hsl(75 24% 72%)",
  "hsl(320 24% 77%)",
];
const COR_SLA_PRIORIDADE: Record<string,string> = {
  baixa: "hsl(215 14% 65%)",
  media: "hsl(213 75% 65%)",
  alta: "hsl(258 72% 68%)",
  critica: "hsl(350 72% 62%)",
};
type Chamado = { id:string; numero:string; titulo:string; status:string; prioridade:string; criado_em:string; aberto_em:string; resolvido_em:string|null; sla_resolucao_violado:boolean; prazo_resolucao:string|null; sla_pausado:boolean; categoria_id:string|null; atendente_id:string|null; solicitante_id:string; segmento_id:string|null };
type Area = { id:string; nome:string };

function getArea(): Area|null { try { const raw=localStorage.getItem("service_desk_segmento"); if(!raw) return null; const v=JSON.parse(raw); return v?.id ? {id:String(v.id),nome:String(v.nome??"")} : null; } catch { return null; } }
function slaStatus(c:Chamado,now:number){ if(c.sla_pausado)return "pausado"; if(!c.prazo_resolucao)return "sem_sla"; const sec=(new Date(c.prazo_resolucao).getTime()-now)/1000; if(sec<=0)return "vencido"; if(sec<=3600)return "vencendo"; return "ok"; }
function statusLabel(s:string){ return ({aberto:"Aberto",em_triagem:"Em triagem",em_andamento:"Em andamento",aguardando_usuario:"Aguardando usuário",aguardando_terceiro:"Aguardando terceiro",resolvido:"Resolvido",fechado:"Fechado",reaberto:"Reaberto",cancelado:"Cancelado"} as Record<string,string>)[s]??s; }
function statusStyle(s:string) {
  const neutro = "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-700";
  const azul = "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
  const classes: Record<string, string> = {
    aberto: azul,
    reaberto: azul,
    em_triagem: "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900",
    em_andamento: "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    aguardando_usuario: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    aguardando_terceiro: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    fechado: neutro,
    cancelado: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
    resolvido: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  };
  return classes[s] ?? neutro;
}
function prioridadeStyle(p:string){
  if(p==="critica") return "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900";
  if(p==="alta") return "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900";
  if(p==="media") return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900";
  if(p==="baixa") return "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
  return "bg-muted text-muted-foreground border border-border";
}

function DashboardPage(){
  const {user}=Route.useRouteContext(); const navigate=useNavigate(); const areaSelecionada=getArea();
  const [now,setNow]=useState(Date.now()); const [dias,setDias]=useState<number>(30); const [filtroStatus,setFiltroStatus]=useState("todos");
  const {data:roles=[],isLoading:loadingRoles}=useQuery({queryKey:["my-roles",user.id],queryFn:async()=>{const {data,error}=await supabase.from("user_roles").select("role").eq("user_id",user.id);if(error)throw error;return(data??[]).map(r=>String(r.role));}});
  const isGestor=roles.includes("gestor")&&!roles.includes("admin");
  const isAreaRestrita=!roles.includes("admin")&&(roles.includes("gestor")||roles.includes("colaborador"));
  const {data:perfilArea}=useQuery({queryKey:["dashboard-profile-area",user.id],enabled:isAreaRestrita,queryFn:async()=>{const {data,error}=await supabase.from("profiles").select("area_id").eq("id",user.id).maybeSingle();if(error)throw error;return data as {area_id:string|null}|null;}});
  const {data:areaGestor}=useQuery({queryKey:["dashboard-gestor-area",perfilArea?.area_id],enabled:isAreaRestrita&&!!perfilArea?.area_id,queryFn:async()=>{const {data,error}=await supabase.from("areas").select("id,nome,ativo").eq("id",perfilArea!.area_id!).maybeSingle();if(error)throw error;if(!data)return null;const {data:segmentos,error:segError}=await supabase.from("segmentos").select("id,nome").eq("ativo",true).order("ordem").order("nome");if(segError)throw segError;const normalizar=(nome:string)=>nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g,"");return (segmentos??[]).find((s)=>normalizar(s.nome)===normalizar(data.nome)) as Area|null;}});
  const area=isAreaRestrita?(areaGestor??null):areaSelecionada;
  useEffect(()=>{if(!area && !isAreaRestrita) navigate({to:"/areas",replace:true}); const t=window.setInterval(()=>setNow(Date.now()),30000); return()=>window.clearInterval(t);},[area,isAreaRestrita,navigate]);
  const isAtendente=roles.includes("atendente");
  const {modo}=useModoAtendimento(user.id,isAtendente);
  const perfil=modo==="colaborador"&&isAtendente?"colaborador":roles.includes("admin")?"admin":roles.includes("gestor")?"gestor":isAtendente?"atendente":"colaborador";
  const isFull=perfil==="admin"||perfil==="gestor"; const since=useMemo(()=>{const d=new Date();d.setDate(d.getDate()-dias);return d.toISOString();},[dias]);
  const {data:chamados=[],isLoading,error:chamadosErro,refetch:refetchChamados}=useQuery({retry:1,queryKey:["dashboard-chamados",perfil,user.id,dias,area?.id],enabled:!loadingRoles&&!!area,queryFn:async()=>{let q=(supabase as any).from("chamados").select("id,numero,titulo,status,prioridade,criado_em,aberto_em,resolvido_em,sla_resolucao_violado,prazo_resolucao,sla_pausado,categoria_id,atendente_id,solicitante_id,segmento_id").eq("segmento_id",area!.id).order("criado_em",{ascending:false}); if(isFull)q=q.gte("criado_em",since); if(perfil==="colaborador")q=q.eq("solicitante_id",user.id); if(perfil==="atendente")q=q.or(`atendente_id.eq.${user.id},atendente_id.is.null`); const {data,error}=await q;if(error)throw error;return(data??[]) as Chamado[];}});
  const {data:categorias=[]}=useQuery({queryKey:["dashboard-categorias",area?.id],enabled:!!area,queryFn:async()=>{const {data,error}=await supabase.from("categorias").select("id,nome").eq("ativo",true).eq("segmento_id",area!.id).order("ordem").order("nome");if(error)throw error;return data??[];}});
  const catMap=useMemo(()=>Object.fromEntries(categorias.map((c:any)=>[c.id,c.nome])),[categorias]);
  const active=(c:Chamado)=>!ENCERRADOS.includes(c.status); const resolved=(c:Chamado)=>c.status==="resolvido"||c.status==="fechado";
  const resumo=useMemo(()=>{const base=chamados; const violados=base.filter(c=>c.sla_resolucao_violado||slaStatus(c,now)==="vencido").length; const resolvidos=base.filter(resolved).filter(c=>c.resolvido_em); const dur=resolvidos.map(c=>(new Date(c.resolvido_em!).getTime()-new Date(c.criado_em).getTime())/3600000); return {total:chamados.length,abertosAgora:base.filter(active).length,resolvidos:base.filter(resolved).length,taxaSla:base.length?Math.round(((base.length-violados)/base.length)*100):null,tMedio:dur.length?+(dur.reduce((a,b)=>a+b,0)/dur.length).toFixed(1):null,criticosAbertos:base.filter(c=>c.prioridade==="critica"&&active(c)).length,vencendo:base.filter(c=>slaStatus(c,now)==="vencendo").length,vencidos:base.filter(c=>slaStatus(c,now)==="vencido").length,pausados:base.filter(c=>slaStatus(c,now)==="pausado").length};},[chamados,now]);
  const porCategoria=useMemo(()=>{const base=chamados;const m=new Map<string,number>();base.forEach(c=>{const n=c.categoria_id?catMap[c.categoria_id]??"—":"—";m.set(n,(m.get(n)??0)+1);});return Array.from(m.entries()).map(([categoria,total])=>({categoria,total})).sort((a,b)=>b.total-a.total).slice(0,8);},[chamados,catMap]);
  const recentes=useMemo(()=>{let b=chamados;if(filtroStatus!=="todos")b=b.filter(c=>filtroStatus==="abertos"?c.status==="aberto":filtroStatus==="andamento"?c.status==="em_andamento":resolved(c));return b.slice(0,10);},[chamados,filtroStatus]);
  const volume=useMemo(()=>{const m=new Map<string,{dia:string;abertos:number;resolvidos:number}>();for(let i=dias-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);m.set(k,{dia:k.slice(5),abertos:0,resolvidos:0});}chamados.forEach(c=>{const a=m.get(c.criado_em.slice(0,10));if(a)a.abertos++;if(c.resolvido_em){const r=m.get(c.resolvido_em.slice(0,10));if(r)r.resolvidos++;}});return Array.from(m.values());},[chamados,dias,isFull]);
  const slaPorPrioridade=useMemo(()=>["baixa","media","alta","critica"].map(p=>{const i=chamados.filter(c=>c.prioridade===p);const v=i.filter(c=>c.sla_resolucao_violado||slaStatus(c,now)==="vencido").length;return{prioridade:p,taxa_pct:i.length?Math.round(((i.length-v)/i.length)*100):0};}),[chamados,now]);
  if(!area||loadingRoles||(isAreaRestrita&&!areaGestor)||isLoading)return <div className="p-8 text-center text-sm text-muted-foreground">Carregando dashboard…</div>;
  if(perfil==="atendente")return <AttendantDashboard area={area} resumo={resumo} porCategoria={porCategoria}/>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">{isFull?"Dashboard Gerencial":"Meu Dashboard"} — {area.nome}</h1><p className="text-sm text-muted-foreground">{perfil==="gestor"?"Métricas somente dos chamados da sua equipe nesta área.":perfil==="colaborador"?"Indicadores dos seus chamados nesta área.":"Métricas da área selecionada."}</p></div><div className="flex gap-2">{PERIODOS.map(d=><Button key={d} size="sm" variant={dias===d?"default":"outline"} onClick={()=>setDias(d)}>{d}d</Button>)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><Kpi label="Total chamados" valor={resumo.total}/><Kpi label="Abertos agora" valor={resumo.abertosAgora}/><Kpi label="Resolvidos" valor={resumo.resolvidos}/><Kpi label="Taxa SLA" valor={resumo.taxaSla!==null?`${resumo.taxaSla}%`:"—"} destaque={resumo.taxaSla!==null&&resumo.taxaSla>=80}/><Kpi label="T. médio resolução" valor={resumo.tMedio!==null?(resumo.tMedio<1?`${Math.round(resumo.tMedio*60)}min`:`${resumo.tMedio}h`):"—"}/><Kpi label="Críticos abertos" valor={resumo.criticosAbertos}/><Kpi label="SLA vencendo" valor={resumo.vencendo}/><Kpi label="SLA vencido" valor={resumo.vencidos}/><Kpi label="SLA pausado" valor={resumo.pausados}/></div>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Volume de chamados</CardTitle><p className="text-xs text-muted-foreground">Aberturas e resoluções no período selecionado.</p></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><LineChart data={volume}><CartesianGrid strokeDasharray="3 3" className="stroke-border"/><XAxis dataKey="dia" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}} allowDecimals={false}/><Tooltip/><Legend/><Line type="monotone" dataKey="abertos" stroke={COR_GRAFICO} strokeWidth={2} name="Abertos"/><Line type="monotone" dataKey="resolvidos" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="Resolvidos"/></LineChart></ResponsiveContainer></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Desempenho de SLA</CardTitle><p className="text-xs text-muted-foreground">Percentual de chamados dentro do prazo.</p></CardHeader><CardContent><ResponsiveContainer width="100%" height={220}><BarChart data={slaPorPrioridade}><CartesianGrid strokeDasharray="3 3" className="stroke-border"/><XAxis dataKey="prioridade" tick={{fontSize:10}}/><YAxis unit="%" domain={[0,100]} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="taxa_pct" name="Taxa SLA" radius={[4,4,0,0]}>{slaPorPrioridade.map((item)=><Cell key={item.prioridade} fill={COR_SLA_PRIORIDADE[item.prioridade]}/>)}</Bar></BarChart></ResponsiveContainer></CardContent></Card></div>
    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por categoria</CardTitle><p className="text-xs text-muted-foreground">Onde está concentrado o volume de atendimento.</p></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><BarChart data={porCategoria} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border"/><XAxis type="number" allowDecimals={false}/><YAxis dataKey="categoria" type="category" width={130}/><Tooltip/><Bar dataKey="total" name="Total" radius={[0,4,4,0]}>{porCategoria.map((item,index)=><Cell key={item.categoria} fill={COR_CATEGORIA[index % COR_CATEGORIA.length]}/>)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
    <Recentes recentes={recentes} catMap={catMap} filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}/>
  </div>;
}

const STATUS_ANDAMENTO=["em_triagem","em_andamento","aguardando_usuario","aguardando_terceiro","reaberto"];
function CollaboratorDashboard({area,chamados,erro,onRetry}:{area:Area;chamados:Chamado[];erro:boolean;onRetry:()=>void}){
  const abertos=chamados.filter(c=>c.status==="aberto").length;
  const andamento=chamados.filter(c=>STATUS_ANDAMENTO.includes(c.status)).length;
  const resolvidos=chamados.filter(c=>c.status==="resolvido"||c.status==="fechado").length;
  const recentes=chamados.slice(0,5);
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-bold">Como podemos ajudar?</h1><p className="text-sm text-muted-foreground">Área: {area.nome}</p></div>
    <Card><CardHeader className="flex flex-row items-center justify-between gap-2 pb-2"><div><CardTitle className="text-base">Meus chamados</CardTitle><p className="text-xs text-muted-foreground">Seus chamados mais recentes nesta área.</p></div><Link to="/chamados" className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">Ver todos</Link></CardHeader><CardContent className="p-0">
      {erro?<div className="p-6 text-center text-sm"><AlertCircle className="mx-auto mb-2 h-5 w-5 text-destructive" aria-hidden/><p className="text-muted-foreground">Não foi possível carregar seus chamados.</p><Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Tentar novamente</Button></div>
      :recentes.length===0?<div className="p-6 text-center text-sm text-muted-foreground"><Ticket className="mx-auto mb-2 h-5 w-5" aria-hidden/>Você ainda não abriu chamados nesta área.</div>
      :<ul className="divide-y border-t">{recentes.map(c=><li key={c.id}><Link to="/chamados/$id" params={{id:c.id}} className="group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{c.numero}</span><Badge variant="outline" className={statusStyle(c.status)}>{statusLabel(c.status)}</Badge></div><div className="mt-1 truncate font-medium">{c.titulo}</div><div className="mt-0.5 text-xs text-muted-foreground">Aberto em {new Date(c.aberto_em??c.criado_em).toLocaleDateString("pt-BR")}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden/></Link></li>)}</ul>}
    </CardContent></Card>
    <Link to="/base-conhecimento" className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Card className="transition-colors group-hover:bg-muted/40"><CardContent className="flex items-center gap-4 p-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted"><BookOpen className="h-5 w-5 text-primary" aria-hidden/></div><div className="min-w-0 flex-1"><div className="font-semibold">Precisa de ajuda?</div><p className="text-sm text-muted-foreground">Veja respostas e tutoriais na base de conhecimento antes de abrir um chamado.</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden/></CardContent></Card></Link>
    {!erro&&<section aria-label="Resumo dos seus chamados"><h2 className="mb-2 text-sm font-semibold text-muted-foreground">Resumo</h2><div className="grid grid-cols-3 gap-3"><Kpi label="Abertos" valor={abertos}/><Kpi label="Em andamento" valor={andamento}/><Kpi label="Resolvidos" valor={resolvidos}/></div></section>}
  </div>;
}
function AttendantDashboard({area,resumo,porCategoria}:{area:Area;resumo:any;porCategoria:any[]}){return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Meu Dashboard — {area.nome}</h1><p className="text-sm text-muted-foreground">Chamados atribuídos a você ou ainda sem atendente nesta área.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="Total chamados" valor={resumo.total}/><Kpi label="Abertos agora" valor={resumo.abertosAgora}/><Kpi label="Resolvidos" valor={resumo.resolvidos}/><Kpi label="Taxa SLA" valor={resumo.taxaSla!==null?`${resumo.taxaSla}%`:"—"}/></div><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Chamados por categoria</CardTitle></CardHeader><CardContent><ResponsiveContainer width="100%" height={240}><BarChart data={porCategoria} layout="vertical"><CartesianGrid strokeDasharray="3 3" className="stroke-border"/><XAxis type="number" allowDecimals={false}/><YAxis dataKey="categoria" type="category" width={130}/><Tooltip/><Bar dataKey="total" fill={COR_GRAFICO} name="Total" radius={[0,4,4,0]}/></BarChart></ResponsiveContainer></CardContent></Card></div>}
function Kpi({label,valor,destaque=false}:{label:string;valor:any;destaque?:boolean}){return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 text-2xl font-bold ${destaque?"text-emerald-600":""}`}>{valor}</div></CardContent></Card>}
function Recentes({recentes,catMap,filtroStatus,setFiltroStatus}:{recentes:Chamado[];catMap:Record<string,string>;filtroStatus:string;setFiltroStatus:(v:string)=>void}){return <Card><CardHeader className="flex flex-row items-center justify-between gap-2"><CardTitle className="text-sm">Chamados recentes</CardTitle><p className="text-xs text-muted-foreground">Acesse rapidamente os últimos atendimentos.</p><div className="flex gap-1"><Button size="sm" variant={filtroStatus==="todos"?"default":"outline"} onClick={()=>setFiltroStatus("todos")}>Todos</Button><Button size="sm" variant={filtroStatus==="abertos"?"default":"outline"} onClick={()=>setFiltroStatus("abertos")}>Abertos</Button><Button size="sm" variant={filtroStatus==="andamento"?"default":"outline"} onClick={()=>setFiltroStatus("andamento")}>Em andamento</Button><Button size="sm" variant={filtroStatus==="resolvidos"?"default":"outline"} onClick={()=>setFiltroStatus("resolvidos")}>Resolvidos</Button></div></CardHeader><CardContent className="p-0"><div className="divide-y">{recentes.map(c=>{const encerrado=ENCERRADOS.includes(c.status);const slaEstourado=Boolean(c.sla_resolucao_violado)||(!encerrado&&slaStatus(c,Date.now())==="vencido");const slaCumprido=["resolvido","fechado"].includes(c.status)&&!!c.prazo_resolucao&&!c.sla_resolucao_violado;return <Link key={c.id} to="/chamados/$id" params={{id:c.id}} className="group flex items-center justify-between gap-3 p-4 sm:p-5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{c.numero}</span><Badge variant="outline" className={prioridadeStyle(c.prioridade)}>{c.prioridade}</Badge><Badge variant="outline" className={statusStyle(c.status)}>{statusLabel(c.status)}</Badge>{slaEstourado&&<Badge variant="outline" className="border border-red-200 bg-red-50 text-red-700">SLA estourado</Badge>}{slaCumprido&&<Badge variant="outline" className="border border-emerald-200 bg-emerald-50 text-emerald-700">SLA cumprido</Badge>}</div><div className="mt-1 truncate font-medium leading-snug">{c.titulo}</div><div className="mt-0.5 text-xs text-muted-foreground">{c.categoria_id?catMap[c.categoria_id]??"—":"—"} • {new Date(c.criado_em).toLocaleString("pt-BR")}</div></div></Link>})}</div></CardContent></Card>}
