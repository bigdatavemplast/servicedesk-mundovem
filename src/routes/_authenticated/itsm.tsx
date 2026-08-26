import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, BookOpen, Boxes, GitBranch, ListChecks, Plus, ShieldCheck, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/itsm")({
  head: () => ({ meta: [{ title: "ITSM Avançado | Mundo Vem Service Desk" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => ["gestor", "admin"].includes(String(r.role)))) throw redirect({ to: "/dashboard" });
  },
  component: ItsmPage,
});

const useTable = (table: string, key: string, order = "criado_em") => useQuery({
  queryKey: ["itsm", table, key],
  queryFn: async () => {
    const { data, error } = await (supabase as any).from(table).select("*").order(order, { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

function NewDialog({ title, fields, onSave }: { title: string; fields: { name: string; label: string; area?: boolean; required?: boolean }[]; onSave: (v: Record<string,string>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string,string>>({});
  const [saving, setSaving] = useState(false);
  async function save() { setSaving(true); try { await onSave(values); setValues({}); setOpen(false); } finally { setSaving(false); } }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo</Button></DialogTrigger><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-3">{fields.map((f) => <div key={f.name}><label className="mb-1 block text-sm font-medium">{f.label}</label>{f.area ? <Textarea value={values[f.name] ?? ""} required={f.required} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} /> : <Input value={values[f.name] ?? ""} required={f.required} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />}</div>)}<Button className="w-full" disabled={saving} onClick={save}>{saving ? "Salvando…" : "Salvar"}</Button></div></DialogContent></Dialog>;
}

function Section({ title, icon: Icon, children, action }: { title: string; icon: any; children: React.ReactNode; action?: React.ReactNode }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{title}</CardTitle>{action}</CardHeader><CardContent>{children}</CardContent></Card>;
}

function ItsmPage() {
  const qc = useQueryClient();
  const problemas = useTable("itsm_problemas", "problemas");
  const mudancas = useTable("itsm_mudancas", "mudancas");
  const ativos = useTable("itsm_ativos", "ativos");
  const rels = useTable("itsm_relacionamentos", "relacionamentos");
  const artigos = useTable("itsm_artigos_conhecimento", "artigos");
  const auditoria = useTable("itsm_auditoria", "auditoria");
  const governanca = useTable("itsm_politicas_governanca", "governanca");
  const [tab, setTab] = useState("problemas");
  const insert = async (table: string, values: Record<string,string>) => { const { error } = await (supabase as any).from(table).insert(values); if (error) throw error; await qc.invalidateQueries({ queryKey: ["itsm", table] }); };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">ITSM Avançado</h1><p className="text-sm text-muted-foreground">Problemas, mudanças, CMDB, relacionamentos, conhecimento, auditoria e governança.</p></div>
    <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <TabsTrigger value="problemas">Problemas</TabsTrigger><TabsTrigger value="mudancas">Mudanças</TabsTrigger><TabsTrigger value="ativos">Ativos / CMDB</TabsTrigger><TabsTrigger value="relacionamentos">Relacionamentos</TabsTrigger><TabsTrigger value="conhecimento">Conhecimento</TabsTrigger><TabsTrigger value="auditoria">Auditoria</TabsTrigger><TabsTrigger value="governanca">Governança</TabsTrigger>
      </TabsList>
      <TabsContent value="problemas"><Section title="Gestão de Problemas" icon={Activity} action={<NewDialog title="Novo problema" fields={[{name:"titulo",label:"Título",required:true},{name:"descricao",label:"Descrição",area:true},{name:"causa_raiz",label:"Causa raiz",area:true},{name:"workaround",label:"Workaround",area:true},{name:"prioridade",label:"Prioridade"},{name:"impacto",label:"Impacto"},{name:"urgencia",label:"Urgência"}]} onSave={(v)=>insert("itsm_problemas",v)} />} />{problemas.isLoading?<p>Carregando…</p>:problemas.error?<p className="text-sm text-destructive">Erro ao carregar problemas.</p>:<div className="space-y-2">{problemas.data?.map((p:any)=><div key={p.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-semibold">PRB-{p.numero} · {p.titulo}</span><p className="mt-1 text-sm text-muted-foreground">{p.descricao || "Sem descrição"}</p></div><div className="flex gap-2"><Badge>{p.status}</Badge><Badge variant="outline">{p.prioridade}</Badge></div></div></div>)}</div>}</Section></TabsContent>
      <TabsContent value="mudancas"><Section title="Gestão de Mudanças" icon={Wrench} action={<NewDialog title="Nova mudança" fields={[{name:"titulo",label:"Título",required:true},{name:"descricao",label:"Descrição",area:true},{name:"justificativa",label:"Justificativa",area:true},{name:"plano_execucao",label:"Plano de execução",area:true},{name:"plano_rollback",label:"Plano de rollback",area:true},{name:"tipo",label:"Tipo"},{name:"risco",label:"Risco"},{name:"impacto",label:"Impacto"}]} onSave={(v)=>insert("itsm_mudancas",v)} />} />{mudancas.isLoading?<p>Carregando…</p>:<div className="space-y-2">{mudancas.data?.map((m:any)=><div key={m.id} className="rounded-lg border p-4 flex justify-between gap-3"><div><span className="font-semibold">RFC-{m.numero} · {m.titulo}</span><p className="text-sm text-muted-foreground">{m.descricao || "Sem descrição"}</p></div><Badge>{m.status}</Badge></div>)}</div>}</Section></TabsContent>
      <TabsContent value="ativos"><Section title="Ativos e CMDB" icon={Boxes} action={<NewDialog title="Novo ativo" fields={[{name:"nome",label:"Nome",required:true},{name:"tipo",label:"Tipo",required:true},{name:"codigo_patrimonio",label:"Patrimônio"},{name:"numero_serie",label:"Número de série"},{name:"fabricante",label:"Fabricante"},{name:"modelo",label:"Modelo"},{name:"ambiente",label:"Ambiente"},{name:"localizacao",label:"Localização"}]} onSave={(v)=>insert("itsm_ativos",v)} />} />{ativos.isLoading?<p>Carregando…</p>:<div className="grid gap-3 md:grid-cols-2">{ativos.data?.map((a:any)=><div key={a.id} className="rounded-lg border p-4"><div className="flex justify-between"><span className="font-semibold">{a.nome}</span><Badge variant="outline">{a.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{a.tipo} · {a.numero_serie || "sem série"} · {a.localizacao || "sem localização"}</p></div>)}</div>}</Section></TabsContent>
      <TabsContent value="relacionamentos"><Section title="Relacionamentos de serviços e CIs" icon={GitBranch} action={<NewDialog title="Novo relacionamento" fields={[{name:"origem_tipo",label:"Origem - tipo",required:true},{name:"origem_id",label:"Origem - ID",required:true},{name:"relacao",label:"Relação",required:true},{name:"destino_tipo",label:"Destino - tipo",required:true},{name:"destino_id",label:"Destino - ID",required:true}]} onSave={(v)=>insert("itsm_relacionamentos",v)} />} />{rels.data?.length?<div className="space-y-2">{rels.data.map((r:any)=><div key={r.id} className="rounded border p-3 text-sm"><b>{r.origem_tipo}</b> → <Badge variant="outline">{r.relacao}</Badge> → <b>{r.destino_tipo}</b><span className="ml-2 text-muted-foreground">{r.origem_id.slice(0,8)} → {r.destino_id.slice(0,8)}</span></div>)}</div>:<p className="text-sm text-muted-foreground">Nenhum relacionamento cadastrado.</p>}</Section></TabsContent>
      <TabsContent value="conhecimento"><Section title="Base de conhecimento ITSM" icon={BookOpen} action={<NewDialog title="Novo artigo" fields={[{name:"titulo",label:"Título",required:true},{name:"resumo",label:"Resumo"},{name:"conteudo",label:"Conteúdo",area:true,required:true},{name:"categoria",label:"Categoria"}]} onSave={(v)=>insert("itsm_artigos_conhecimento",v)} />} />{artigos.data?.map((a:any)=><div key={a.id} className="mb-2 rounded-lg border p-4"><div className="flex justify-between"><span className="font-semibold">{a.titulo}</span><Badge>{a.status}</Badge></div><p className="text-sm text-muted-foreground">v{a.versao} · {a.categoria || "Sem categoria"} · {a.visualizacoes} visualizações</p></div>)}</Section></TabsContent>
      <TabsContent value="auditoria"><Section title="Trilha de auditoria" icon={ShieldCheck}><div className="space-y-2">{auditoria.data?.slice(0,100).map((a:any)=><div key={a.id} className="rounded border p-3 text-sm"><div className="flex justify-between"><span className="font-medium">{a.acao} · {a.entidade}</span><span className="text-muted-foreground">{new Date(a.criado_em).toLocaleString("pt-BR")}</span></div><p className="text-xs text-muted-foreground">ID: {a.entidade_id || "—"} · usuário: {a.usuario_id || "sistema"}</p></div>)}</div></Section></TabsContent>
      <TabsContent value="governanca"><Section title="Governança e políticas" icon={ListChecks} action={<NewDialog title="Nova política" fields={[{name:"nome",label:"Nome",required:true},{name:"descricao",label:"Descrição",area:true},{name:"tipo",label:"Tipo"},{name:"periodicidade_revisao",label:"Periodicidade de revisão"}]} onSave={(v)=>insert("itsm_politicas_governanca",v)} />} />{governanca.data?.map((g:any)=><div key={g.id} className="mb-2 rounded-lg border p-4 flex justify-between"><div><span className="font-semibold">{g.nome}</span><p className="text-sm text-muted-foreground">{g.descricao || "Sem descrição"}</p></div><Badge>{g.status}</Badge></div>)}</Section></TabsContent>
    </Tabs>
  </div>;
}
