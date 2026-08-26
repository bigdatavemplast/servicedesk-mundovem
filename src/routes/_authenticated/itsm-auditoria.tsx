import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Search, ShieldCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-auditoria")({ component: ItsmAuditoria });

type Audit = { id: string; entidade: string; entidade_id: string | null; acao: string; usuario_id: string | null; antes: unknown; depois: unknown; criado_em: string };

function ItsmAuditoria() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Audit | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["itsm-auditoria", search],
    queryFn: async () => {
      let q = supabase.from("itsm_auditoria").select("*").order("criado_em", { ascending: false }).limit(300);
      if (search.trim()) q = q.or(`entidade.ilike.%${search.trim()}%,acao.ilike.%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Audit[];
    },
  });
  return <div className="space-y-6"><div><div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary"/><h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1></div><p className="text-sm text-muted-foreground">Rastreabilidade das alterações realizadas nos módulos ITSM.</p></div><Card><CardContent className="pt-6"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Filtrar por entidade ou ação..." value={search} onChange={e => setSearch(e.target.value)}/></div></CardContent></Card>{selected && <Card className="border-primary/50"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Detalhes da auditoria</CardTitle><Button variant="ghost" size="icon" onClick={() => setSelected(null)}><X className="h-4 w-4"/></Button></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Detail l="Entidade" v={selected.entidade}/><Detail l="Ação" v={selected.acao}/><Detail l="Data" v={new Date(selected.criado_em).toLocaleString("pt-BR")}/></div><div className="grid gap-4 md:grid-cols-2"><JsonDetail l="Antes" v={selected.antes}/><JsonDetail l="Depois" v={selected.depois}/></div></CardContent></Card>}{error && <p className="text-sm text-destructive">Não foi possível carregar a auditoria.</p>}<Card><CardHeader><CardTitle>Registros</CardTitle></CardHeader><CardContent>{isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : data?.length ? <div className="space-y-2">{data.map(a => <div key={a.id} className="flex items-center justify-between gap-4 rounded-lg border p-3"><div><div className="font-medium">{a.entidade} · {a.acao}</div><div className="text-xs text-muted-foreground">{new Date(a.criado_em).toLocaleString("pt-BR")} · {a.entidade_id ?? "sem ID"}</div></div><Button variant="outline" size="sm" onClick={() => setSelected(a)}><Eye className="mr-2 h-4 w-4"/>Ver alterações</Button></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>}</CardContent></Card></div>;
}
function Detail({ l, v }: { l: string; v: unknown }) { return <div><div className="text-xs font-medium text-muted-foreground">{l}</div><div className="text-sm">{v == null ? "-" : String(v)}</div></div>; }
function JsonDetail({ l, v }: { l: string; v: unknown }) { return <div><div className="mb-1 text-xs font-medium text-muted-foreground">{l}</div><pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{v == null ? "-" : JSON.stringify(v, null, 2)}</pre></div>; }
