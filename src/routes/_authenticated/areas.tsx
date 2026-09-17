import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ChevronRight, Loader2, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/areas")({
  head: () => ({ meta: [{ title: "Áreas de atendimento | Mundo Vem Service Desk" }, { name: "description", content: "Escolha a área responsável para acessar seu ambiente no Service Desk." }] }),
  ssr: false,
  component: AreasPage,
});

type Segmento = { id: string; nome: string; ativo: boolean; ordem: number };
type Perfil = { area_id: string | null };
type Area = { id: string; nome: string; ativo: boolean };
type Preferencia = { modo_ativo: "atendente" | "colaborador" };

const descricoes: Record<string, string> = {
  TI: "Sistemas, infraestrutura, acessos, equipamentos e suporte de tecnologia.",
  RH: "Pessoas, benefícios, férias, folha e processos de Recursos Humanos.",
  Financeiro: "Pagamentos, notas, processos e serviços financeiros.",
  Projetos: "Projetos, demandas e serviços relacionados às iniciativas da empresa.",
  Marketing: "Campanhas, comunicação, materiais e ações de marketing.",
  Expedição: "Separação, conferência, embalagem e expedição de pedidos.",
  Comercial: "Vendas, clientes, propostas e processos da área comercial.",
  "E-commerce": "Pedidos, produtos, integrações e operações do canal digital.",
  Fábrica: "Produção, operação, equipamentos e demandas da fábrica.",
};

const normalizarNome = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");

function AreasPage() {
  const navigate = useNavigate();
  const { data: user } = useQuery({ queryKey: ["areas-current-user"], queryFn: async () => { const { data, error } = await supabase.auth.getUser(); if (error) throw error; return data.user; } });
  const { data: isAtendente, isLoading: loadingRole, error: roleError } = useQuery({ queryKey: ["areas-current-user-is-atendente", user?.id], enabled: !!user?.id, queryFn: async () => { const { data, error } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "atendente" }); if (error) throw error; return Boolean(data); } });
  const { data: preferencia, isLoading: loadingModo, error: modoError } = useQuery({ queryKey: ["areas-current-preferencia-atendimento", user?.id], enabled: !!user?.id && isAtendente === true, queryFn: async () => { const { data, error } = await supabase.from("preferencias_atendimento").select("modo_ativo").eq("usuario_id", user!.id).maybeSingle(); if (error) throw error; return (data ?? { modo_ativo: "atendente" }) as Preferencia; } });
  const modoColaborador = isAtendente === true && preferencia?.modo_ativo === "colaborador";
  const restringirPorArea = isAtendente === true && !modoColaborador;
  const { data: perfil, isLoading: loadingPerfil, error: perfilError } = useQuery({ queryKey: ["areas-current-profile", user?.id], enabled: restringirPorArea, queryFn: async () => { const { data, error } = await supabase.from("profiles").select("area_id").eq("id", user!.id).single(); if (error) throw error; return data as Perfil; } });
  const { data: areaAtribuida, isLoading: loadingArea, error: areaError } = useQuery({ queryKey: ["areas-current-assigned-area", perfil?.area_id], enabled: restringirPorArea && !!perfil?.area_id, queryFn: async () => { const { data, error } = await supabase.from("areas").select("id,nome,ativo").eq("id", perfil!.area_id!).maybeSingle(); if (error) throw error; return data as Area | null; } });
  const { data: segmentos = [], isLoading: loadingSegmentos, error: segmentosError } = useQuery({ queryKey: ["areas-service-desk", user?.id, modoColaborador], enabled: !!user?.id && isAtendente !== undefined && (isAtendente === false || preferencia !== undefined), queryFn: async () => { const { data, error } = await supabase.from("segmentos").select("id,nome,ativo,ordem").eq("ativo", true).order("ordem").order("nome"); if (error) throw error; return (data ?? []) as Segmento[]; } });
  const segmentosVisiveis = restringirPorArea ? (perfil?.area_id ? segmentos.filter((segmento) => !!areaAtribuida && areaAtribuida.ativo && normalizarNome(segmento.nome) === normalizarNome(areaAtribuida.nome)) : []) : segmentos;
  const isLoading = !user || loadingRole || loadingModo || (restringirPorArea && (loadingPerfil || loadingArea)) || loadingSegmentos;
  const error = roleError || modoError || perfilError || areaError || segmentosError;
  const entrar = (segmento: Segmento) => { localStorage.setItem("service_desk_segmento", JSON.stringify({ id: segmento.id, nome: segmento.nome })); navigate({ to: "/dashboard" }); };
  const sair = async () => { await supabase.auth.signOut(); localStorage.removeItem("service_desk_segmento"); navigate({ to: "/auth" }); };
  return <div className="min-h-screen bg-muted/20"><div className="mx-auto max-w-5xl px-6 py-12"><div className="mb-6 flex justify-end"><Button variant="outline" onClick={sair}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div><div className="mb-10 text-center"><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-7 w-7" /></div><h1 className="text-3xl font-semibold tracking-tight">Qual área você deseja acessar?</h1><p className="mx-auto mt-2 max-w-2xl text-muted-foreground">As áreas exibidas respeitam o nível de acesso e a área atribuída ao seu usuário.</p></div>{isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}{error && <Card><CardContent className="py-8 text-center text-sm text-destructive">Não foi possível carregar as áreas disponíveis.</CardContent></Card>}{!isLoading && !error && restringirPorArea && !perfil?.area_id && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma área foi atribuída ao seu usuário. Solicite ao administrador a definição da sua área.</CardContent></Card>}{!isLoading && !error && restringirPorArea && perfil?.area_id && segmentosVisiveis.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma área está disponível para o seu usuário.</CardContent></Card>}{!isLoading && !error && segmentosVisiveis.length > 0 && <div className={segmentosVisiveis.length === 1 ? "flex justify-center" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{segmentosVisiveis.map((segmento) => <Card key={segmento.id} className="group w-full cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md sm:max-w-md" onClick={() => entrar(segmento)}><CardHeader><div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div><ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><CardTitle className="pt-2">{segmento.nome}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{descricoes[segmento.nome] ?? `Acesse os serviços e solicitações de ${segmento.nome}.`}</p><Button variant="ghost" className="mt-4 w-full justify-between px-0 hover:bg-transparent hover:text-primary">Acessar {segmento.nome}<ChevronRight className="h-4 w-4" /></Button></CardContent></Card>)}</div>}</div></div>;
}
