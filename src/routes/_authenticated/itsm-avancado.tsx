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
import { Plus, Search, Shield, Database, GitBranch, BookOpen, Settings2, AlertTriangle, RefreshCw, Network, Server, Pencil, Trash2 } from "lucide-react";

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

type Field = { key: string; label: string; area?: boolean };
type Module = { table: string; title: string; description: string; icon: any; fields: Field[]; order: string };

const modules: Module[] = [
  { table: "itsm_problemas", title: "Problemas", description: "Causa raiz, impacto, urgência e solução.", icon: AlertTriangle, order: "created_at", fields: [{ key: "titulo", label: "Título" }, { key: "descricao", label: "Descrição", area: true }, { key: "causa_raiz", label: "Causa raiz", area: true }] },
  { table: "itsm_mudancas", title: "Mudanças", description: "RFC, risco, aprovação, execução e rollback.", icon: GitBranch, order: "created_at", fields: [{ key: "titulo", label: "Título" }, { key: "descricao", label: "Descrição", area: true }, { key: "justificativa", label: "Justificativa", area: true }, { key: "plano_execucao", label: "Plano de execução", area: true }, { key: "plano_rollback", label: "Plano de rollback", area: true }] },
  { table: "itsm_ativos", title: "Ativos / CMDB", description: "Inventário, ciclo de vida e responsáveis.", icon: Database, order: "created_at", fields: [{ key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" }, { key: "patrimonio", label: "Patrimônio" }, { key: "numero_serie", label: "Número de série" }] },
  { table: "itsm_servicos", title: "Serviços", description: "Serviços de negócio, proprietário, criticidade e SLA.", icon: Server, order: "criado_em", fields: [{ key: "nome", label: "Nome" }, { key: "descricao", label: "Descrição", area: true }, { key: "criticidade", label: "Criticidade" }] },
  { table: "itsm_catalogo_avancado", title: "Catálogo", description: "Serviços, formulários, SLA e aprovações.", icon: Settings2, order: "created_at", fields: [{ key: "nome", label: "Nome do item" }, { key: "descricao", label: "Descrição", area: true }, { key: "categoria", label: "Categoria" }] },
  { table: "itsm_artigos_conhecimento", title: "Conhecimento", description: "Artigos, revisão, publicação e validade.", icon: BookOpen, order: "created_at", fields: [{ key: "titulo", label: "Título" }, { key: "conteudo", label: "Conteúdo", area: true }, { key: "categoria", label: "Categoria" }] },
  { table: "itsm_politicas_governanca", title: "Governança", description: "Políticas, responsáveis, vigência e revisão.", icon: Shield, order: "criado_em", fields: [{ key: "nome", label: "Nome" }, { key: "tipo", label: "Tipo" }, { key: "descricao", label: "Descrição", area: true }] },
];

function ItsmPage() {
  const [tab, setTab] = useState("itsm_problemas");
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">ITSM Avançado</h1><p className="text-sm text-muted-foreground">Evolução incremental sobre o Service Desk existente, sem alterar o núcleo de chamados.</p></div><Tabs value={tab} onValueChange={setTab}><TabsList className="flex h-auto flex-wrap gap-1"><TabsTrigger value="itsm_problemas">Problemas</TabsTrigger><TabsTrigger value="itsm_mudancas">Mudanças</TabsTrigger><TabsTrigger value="itsm_ativos">Ativos / CMDB</TabsTrigger><TabsTrigger value="itsm_servicos">Serviços</TabsTrigger><TabsTrigger value="itsm_relacionamentos">Relacionamentos</TabsTrigger><TabsTrigger value="itsm_catalogo_avancado">Catálogo</TabsTrigger><TabsTrigger value="itsm_artigos_conhecimento">Conhecimento</TabsTrigger><TabsTrigger value="itsm_auditoria">Auditoria</TabsTrigger><TabsTrigger value="itsm_politicas_governanca">Governança</TabsTrigger></TabsList>{modules.map((m) => <TabsContent key={m.table} value={m.table}><CrudModule module={m} /></TabsContent>)}<TabsContent value="itsm_relacionamentos"><Relacionamentos /></TabsContent><TabsContent value="itsm_auditoria"><Auditoria /></TabsContent></Tabs></div>;
}

function CrudModule({ module }: { module: Module }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const { data = [], isLoading, error } = useQuery({ queryKey: [module.table], queryFn: async () => { const { data, error } = await (supabase as any).from(module.table).select("*").order(module.order, { ascending: false }).limit(100); if (error) throw error; return data ?? []; } });
  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form } as Record<string, unknown>;
    if (module.table === "itsm_artigos_conhecimento") payload.autor_id = u.user?.id;
    if (["itsm_problemas", "itsm_mudancas"].includes(module.table)) payload.criado_por = u.user?.id;
    const q = (supabase as any).from(module.table);
    const result = editing ? q.update(payload).eq("id", editing.id) : q.insert(payload);
    const { error } = await result;
    if (error) return alert(error.message);
    setOpen(false); setEditing(null); setForm({}); qc.invalidateQueries({ queryKey: [module.table] });
  };
  const remove = async (id: string) => { if (!confirm("Excluir este registro?")) return; const { error } = await (supabase as any).from(module.table).delete().eq("id", id); if (error) alert(error.message); else qc.invalidateQueries({ queryKey: [module.table] }); };
  const rows = data.filter((r: any) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const Icon = module.icon;
  return <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" />{module.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{module.description}</p></div><Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm({}); } }}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} — {module.title}</DialogTitle></DialogHeader><div className="space-y-3">{module.fields.map((f) => f.area ? <Textarea key={f.key} placeholder={f.label} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /> : <Input key={f.key} placeholder={f.label} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />)}<Button className="w-full" onClick={save}>{editing ? "Atualizar" : "Salvar"}</Button></div></DialogContent></Dialog></CardHeader><CardContent><div className="mb-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><Badge variant="outline">{rows.length} registros</Badge></div>{isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p> : error ? <p className="py-8 text-center text-sm text-destructive">Não foi possível carregar este módulo.</p> : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro cadastrado.</p> : <div className="space-y-2">{rows.slice(0, 50).map((r: any) => <div key={r.id} className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-medium">{r.titulo ?? r.nome}</div><div className="mt-1 text-xs text-muted-foreground">{r.descricao ?? r.categoria ?? r.tipo ?? "Sem detalhes"}</div><Badge className="mt-2" variant="outline">{r.status ?? "ativo"}</Badge></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setEditing(r); setForm(Object.fromEntries(module.fields.map((f) => [f.key, r[f.key] ?? ""]))); setOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</CardContent></Card>;
}

function Relacionamentos() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ origem_tipo: "servico", origem_id: "", relacao: "depende_de", destino_tipo: "ativo", destino_id: "" });
  const { data = [], isLoading } = useQuery({ queryKey: ["itsm_relacionamentos"], queryFn: async () => { const { data, error } = await (supabase as any).from("itsm_relacionamentos").select("*").order("created_at", { ascending: false }); if (error) throw error; return data ?? []; } });
  const save = async () => { const { data: u } = await supabase.auth.getUser(); const { error } = await (supabase as any).from("itsm_relacionamentos").insert({ ...form, criado_por: u.user?.id }); if (error) return alert(error.message); setForm({ ...form, origem_id: "", destino_id: "" }); qc.invalidateQueries({ queryKey: ["itsm_relacionamentos"] }); };
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" />Relacionamentos</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-5">{Object.keys(form).map((k) => <Input key={k} placeholder={k} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />)}</div><Button onClick={save}><Plus className="mr-2 h-4 w-4" />Vincular</Button>{isLoading ? <p>Carregando...</p> : <div className="space-y-2">{data.map((r: any) => <div key={r.id} className="rounded border p-3 text-sm"><b>{r.origem_tipo}</b> → {r.relacao} → <b>{r.destino_tipo}</b><div className="text-xs text-muted-foreground">{r.origem_id} → {r.destino_id}</div></div>)}</div>}</CardContent></Card>;
}

function Auditoria() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ["itsm_auditoria"], queryFn: async () => { const { data, error } = await (supabase as any).from("itsm_auditoria").select("*").order("criado_em", { ascending: false }).limit(200); if (error) throw error; return data ?? []; } });
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />Trilha de auditoria</CardTitle></CardHeader><CardContent>{isLoading ? <p>Carregando...</p> : error ? <p className="text-destructive">Não foi possível carregar a auditoria.</p> : data.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum evento registrado.</p> : <div className="space-y-2">{data.map((r: any) => <div key={r.id} className="rounded border p-3 text-sm"><b>{r.acao}</b> · {r.entidade}<div className="text-xs text-muted-foreground">{new Date(r.criado_em).toLocaleString("pt-BR")}</div></div>)}</div>}</CardContent></Card>;
}
