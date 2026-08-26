import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Shield, Database, GitBranch, BookOpen, Settings2, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-avancado")({
  head: () => ({ meta: [{ title: "ITSM Avançado | Mundo Vem Service Desk" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => ["gestor", "admin"].includes(String(r.role)))) throw redirect({ to: "/dashboard" });
  },
  component: ItsmPage,
});

type Module = { table: string; title: string; description: string; icon: any; fields: { key: string; label: string }[] };
const modules: Module[] = [
  { table: "itsm_problemas", title: "Problemas", description: "Causa raiz, impacto, urgência e solução definitiva.", icon: AlertTriangle, fields: [{ key: "titulo", label: "Título" }, { key: "descricao", label: "Descrição" }, { key: "causa_raiz", label: "Causa raiz" }] },
  { table: "itsm_mudancas", title: "Mudanças", description: "RFC, risco, aprovação, execução e rollback.", icon: GitBranch, fields: [{ key: "titulo", label: "Título" }, { key: "descricao", label: "Descrição" }, { key: "plano_execucao", label: "Plano de execução" }, { key: "plano_rollback", label: "Plano de rollback" }] },
  { table: "itsm_ativos", title: "Ativos / CMDB", description: "Inventário, ciclo de vida e responsáveis.", icon: Database, fields: [{ key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" }, { key: "patrimonio", label: "Patrimônio" }, { key: "numero_serie", label: "Número de série" }] },
  { table: "itsm_catalogo_avancado", title: "Catálogo avançado", description: "Serviços, formulários, SLA e aprovações.", icon: Settings2, fields: [{ key: "nome", label: "Nome do serviço" }, { key: "descricao", label: "Descrição" }, { key: "categoria", label: "Categoria" }] },
  { table: "itsm_artigos_conhecimento", title: "Conhecimento", description: "Artigos, revisão, publicação e validade.", icon: BookOpen, fields: [{ key: "titulo", label: "Título" }, { key: "conteudo", label: "Conteúdo" }, { key: "categoria", label: "Categoria" }] },
  { table: "itsm_governanca", title: "Governança", description: "Políticas, responsáveis e ciclos de revisão.", icon: Shield, fields: [{ key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" }, { key: "descricao", label: "Descrição" }] },
];

function ItsmPage() {
  const [tab, setTab] = useState("itsm_problemas");
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">ITSM Avançado</h1><p className="text-sm text-muted-foreground">Problemas, mudanças, ativos, relacionamentos, catálogo, conhecimento, auditoria e governança.</p></div><Tabs value={tab} onValueChange={setTab} className="space-y-4"><TabsList className="flex h-auto flex-wrap justify-start gap-1"><TabsTrigger value="itsm_problemas">Problemas</TabsTrigger><TabsTrigger value="itsm_mudancas">Mudanças</TabsTrigger><TabsTrigger value="itsm_ativos">Ativos / CMDB</TabsTrigger><TabsTrigger value="itsm_relacionamentos">Relacionamentos</TabsTrigger><TabsTrigger value="itsm_catalogo_avancado">Catálogo</TabsTrigger><TabsTrigger value="itsm_artigos_conhecimento">Conhecimento</TabsTrigger><TabsTrigger value="itsm_auditoria">Auditoria</TabsTrigger><TabsTrigger value="itsm_governanca">Governança</TabsTrigger></TabsList>{modules.map((m) => <TabsContent key={m.table} value={m.table}><CrudModule module={m} /></TabsContent>)}<TabsContent value="itsm_relacionamentos"><Relacionamentos /></TabsContent><TabsContent value="itsm_auditoria"><Auditoria /></TabsContent></Tabs></div>;
}

function CrudModule({ module }: { module: Module }) {
  const qc = useQueryClient(); const [open, setOpen] = useState(false); const [search, setSearch] = useState(""); const [form, setForm] = useState<Record<string,string>>({});
  const { data = [], isLoading } = useQuery({ queryKey: [module.table], queryFn: async () => { const { data, error } = await (supabase as any).from(module.table).select("*").order("created_at", { ascending: false }).limit(100); if (error) throw error; return data ?? []; } });
  const save = async () => { const payload = { ...form }; const { data: user } = await supabase.auth.getUser(); if (module.table === "itsm_artigos_conhecimento") payload.autor_id = user.user?.id; if (["itsm_problemas","itsm_mudancas"].includes(module.table)) payload.criado_por = user.user?.id; const { error } = await (supabase as any).from(module.table).insert(payload); if (error) return alert(error.message); setOpen(false); setForm({}); qc.invalidateQueries({ queryKey: [module.table] }); };
  const Icon = module.icon; const rows = data.filter((r: any) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  return <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" />{module.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{module.description}</p></div><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Novo {module.title.slice(0,-1)}</DialogTitle></DialogHeader><div className="space-y-3">{module.fields.map((f) => f.key.includes("descricao") || f.key.includes("conteudo") || f.key.includes("plano") || f.key.includes("causa") ? <Textarea key={f.key} placeholder={f.label} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /> : <Input key={f.key} placeholder={f.label} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />)}<Button className="w-full" onClick={save}>Salvar</Button></div></DialogContent></Dialog></CardHeader><CardContent><div className="mb-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Badge variant="outline">{rows.length} registros</Badge></div>{isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro cadastrado.</p> : <div className="space-y-2">{rows.slice(0,20).map((r: any) => <div key={r.id} className="rounded-lg border p-3"><div className="font-medium">{r.titulo ?? r.nome}</div><div className="mt-1 text-xs text-muted-foreground">{r.descricao ?? r.categoria ?? r.tipo ?? "Sem detalhes"}</div><Badge className="mt-2" variant="outline">{r.status ?? "ativo"}</Badge></div>)}</div>}</CardContent></Card>;
}

function Relacionamentos() { const [form,setForm]=useState({origem_tipo:"servico",origem_id:"",relacao:"depende_de",destino_tipo:"ativo",destino_id:""}); const qc=useQueryClient(); const {data=[]}=useQuery({queryKey:["itsm_relacionamentos"],queryFn:async()=>{const {data,error}=await (supabase as any).from("itsm_relacionamentos").select("*").order("created_at",{ascending:false});if(error)throw error;return data??[]}}); const save=async()=>{const {data:u}=await supabase.auth.getUser();const {error}=await (supabase as any).from("itsm_relacionamentos").insert({...form,criado_por:u.user?.id});if(error)return alert(error.message);setForm({...form,origem_id:"",destino_id:""});qc.invalidateQueries({queryKey:["itsm_relacionamentos"]});}; return <Card><CardHeader><CardTitle>Relacionamentos entre serviços, ativos e processos</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-5">{Object.keys(form).map(k=><Input key={k} placeholder={k} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>)}</div><Button onClick={save}><Plus className="mr-2 h-4 w-4"/>Vincular</Button><div className="space-y-2">{data.map((r:any)=><div key={r.id} className="rounded border p-3 text-sm"><b>{r.origem_tipo}</b> → {r.relacao} → <b>{r.destino_tipo}</b><div className="text-xs text-muted-foreground">{r.origem_id} → {r.destino_id}</div></div>)}</div></CardContent></Card> }

function Auditoria() { const {data=[]}=useQuery({queryKey:["itsm_auditoria"],queryFn:async()=>{const {data,error}=await (supabase as any).from("itsm_auditoria").select("*").order("criado_em",{ascending:false}).limit(200);if(error)throw error;return data??[]}}); return <Card><CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5"/>Trilha de auditoria</CardTitle></CardHeader><CardContent>{data.length===0?<p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento de auditoria registrado.</p>:<div className="space-y-2">{data.map((r:any)=><div key={r.id} className="rounded border p-3 text-sm"><b>{r.acao}</b> · {r.entidade}<div className="text-xs text-muted-foreground">{new Date(r.criado_em).toLocaleString("pt-BR")}</div></div>)}</div>}</CardContent></Card> }
