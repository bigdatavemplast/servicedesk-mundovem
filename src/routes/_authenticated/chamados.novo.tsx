import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Info, Lightbulb, Loader2 } from "lucide-react";
import { AnexoDropzone } from "@/components/anexos/AnexoDropzone";
import { enviarAnexo } from "@/lib/anexos";
import { criarChamadoComCatalogo } from "@/lib/chamado-catalogo.functions";

export const Route = createFileRoute("/_authenticated/chamados/novo")({ component: NovoChamadoPage });

function normalizarTipo(nome: string) { return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase(); }
function ehIncidente(nome: string) { const tipo = normalizarTipo(nome); return tipo.includes("incidente") || tipo.includes("falha") || tipo.includes("erro"); }
function calcularPrioridade(impacto: "empresa" | "departamento" | "usuario", urgencia: "critica" | "alta" | "media" | "baixa") {
  const i = { empresa: 3, departamento: 2, usuario: 1 }[impacto]; const u = { critica: 4, alta: 3, media: 2, baixa: 1 }[urgencia];
  if (i === 3 && u >= 3) return "critica"; if (i === 2 && u === 4) return "critica";
  if ((i === 3 && u === 2) || (i === 2 && u === 3) || (i === 1 && u === 4)) return "alta";
  if ((i === 3 && u === 1) || (i === 2 && u === 2) || (i === 1 && u === 3)) return "media"; return "baixa";
}

function sugestaoAbertura(texto: string) {
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!t.trim()) return null;
  if (/nao liga|não liga|nao inicia|não inicia|tela preta|travou|travando|erro/.test(t)) return "Descreva o que aconteceu imediatamente antes do problema e qualquer mensagem exibida.";
  if (/senha|acesso|login|permissao|permissão|bloqueado/.test(t)) return "Informe qual sistema/recurso você precisa acessar e, se houver, a mensagem apresentada.";
  if (/impressora|imprimir|impressao|impressão/.test(t)) return "Informe se a impressora aparece disponível, qual documento tentou imprimir e a mensagem de erro, se houver.";
  if (/internet|wifi|wi-fi|rede|conexao|conexão/.test(t)) return "Informe se o problema ocorre apenas com você ou com outras pessoas e se está usando Wi-Fi ou cabo.";
  if (/sistema|erp|senior|sapiens/.test(t)) return "Informe o nome do sistema/tela, a operação que estava realizando e a mensagem exibida.";
  return "Explique o que você esperava que acontecesse, o que aconteceu de fato e se o problema ainda está ocorrendo.";
}

function NovoChamadoPage() {
  const { user } = Route.useRouteContext(); const navigate = useNavigate(); const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState(""); const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"baixa"|"media"|"alta"|"critica">("media");
  const [impacto, setImpacto] = useState<"empresa"|"departamento"|"usuario" | "">("");
  const [urgencia, setUrgencia] = useState<"critica"|"alta"|"media"|"baixa" | "">("");
  const [tipoChamadoId, setTipoChamadoId] = useState(""); const [segmentoId, setSegmentoId] = useState("");
  const [categoriaId, setCategoriaId] = useState(""); const [subcategoriaId, setSubcategoriaId] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]); const [progresso, setProgresso] = useState<Record<string, number>>({});
  const criar = useServerFn(criarChamadoComCatalogo);
  const { data: tiposChamado = [] } = useQuery({ queryKey: ["tipos-chamado-ativos"], queryFn: async () => { const { data, error } = await supabase.from("tipos_chamado").select("id, nome").eq("ativo", true).order("ordem").order("nome"); if (error) throw new Error(error.message); return data ?? []; } });
  const tipoSelecionado = tiposChamado.find((tipo) => tipo.id === tipoChamadoId); const incidente = !!tipoSelecionado && ehIncidente(tipoSelecionado.nome);
  const prioridadeCalculada = incidente && impacto && urgencia ? calcularPrioridade(impacto, urgencia) : null;
  const { data: segmentos = [] } = useQuery({ queryKey: ["segmentos-ativos-catalogo"], queryFn: async () => { const { data, error } = await supabase.from("segmentos").select("id, nome").eq("ativo", true).order("ordem").order("nome"); if (error) throw new Error(error.message); return data ?? []; } });
  const { data: categorias = [] } = useQuery({ queryKey: ["categorias-ativas-catalogo", segmentoId], queryFn: async () => { if (!segmentoId) return []; const { data, error } = await supabase.from("categorias").select("id, nome, segmento_id").eq("ativo", true).eq("segmento_id", segmentoId).order("ordem").order("nome"); if (error) throw new Error(error.message); return data ?? []; }, enabled: !!segmentoId });
  const { data: subcategorias = [] } = useQuery({ queryKey: ["subcategorias-ativas-catalogo", categoriaId], queryFn: async () => { if (!categoriaId) return []; const { data, error } = await supabase.from("subcategorias").select("id, nome, categoria_id").eq("categoria_id", categoriaId).eq("ativo", true).order("ordem").order("nome"); if (error) throw new Error(error.message); return data ?? []; }, enabled: !!categoriaId });
  const sugestao = useMemo(() => sugestaoAbertura(`${titulo} ${descricao}`), [titulo, descricao]);
  const etapasConcluidas = [titulo.trim().length >= 5, descricao.trim().length >= 20, !!tipoChamadoId, !!segmentoId, !!categoriaId, !incidente || (!!impacto && !!urgencia)];
  const progressoAbertura = Math.round((etapasConcluidas.filter(Boolean).length / etapasConcluidas.length) * 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (titulo.trim().length < 5) return toast.error("Informe um título mais descritivo (mínimo de 5 caracteres).");
    if (descricao.trim().length < 20) return toast.error("Descreva o ocorrido com pelo menos 20 caracteres.");
    if (!tipoChamadoId) return toast.error("Selecione o tipo de chamado."); if (!segmentoId) return toast.error("Selecione o segmento."); if (!categoriaId) return toast.error("Selecione a categoria.");
    if (incidente && !impacto) return toast.error("Selecione o impacto do incidente."); if (incidente && !urgencia) return toast.error("Selecione a urgência do incidente."); setLoading(true); let criado: any;
    try { criado = await criar({ data: { titulo: titulo.trim(), descricao: descricao.trim(), prioridade: prioridadeCalculada ?? prioridade, impacto: impacto || undefined, urgencia: urgencia || undefined, tipoChamadoId, segmentoId, categoriaId, subcategoriaId: subcategoriaId || null } }); }
    catch (error) { setLoading(false); return toast.error(error instanceof Error ? error.message : "Falha ao criar chamado"); }
    let falhas = 0; for (const file of anexos) { try { await enviarAnexo({ chamadoId: criado.id, autorId: user.id, file, onProgress: (pct) => setProgresso((p) => ({ ...p, [file.name]: pct })) }); } catch (err) { falhas += 1; toast.error(err instanceof Error ? err.message : `Falha ao anexar ${file.name}`); } }
    setLoading(false); if (falhas === 0) toast.success("Chamado criado com sucesso!"); else toast.warning("Chamado criado, mas alguns anexos falharam."); navigate({ to: "/chamados" });
  }

  return (<div className="mx-auto max-w-2xl space-y-6">
    <div><h1 className="text-2xl font-bold">Novo chamado</h1><p className="text-sm text-muted-foreground">Vamos orientar sua abertura para que o chamado chegue à fila correta com as informações necessárias.</p></div>
    <Card><CardContent className="pt-6"><div className="space-y-2"><div className="flex items-center justify-between text-xs"><span className="font-medium">Progresso da abertura</span><span className="text-muted-foreground">{progressoAbertura}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressoAbertura}%` }} /></div><p className="text-xs text-muted-foreground">O formulário se adapta conforme você informa o problema.</p></div></CardContent></Card>
    <Card><CardHeader><CardTitle>1. Conte o que aconteceu</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label htmlFor="titulo">Título</Label><Input id="titulo" required maxLength={250} minLength={5} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Notebook não liga" /><div className="flex justify-between text-xs text-muted-foreground"><span>Resuma o problema em uma frase.</span><span>{titulo.length}/250</span></div></div>
      <div className="space-y-2"><Label htmlFor="descricao">Descrição</Label><Textarea id="descricao" required minLength={20} rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descreva o ocorrido, o que você estava fazendo, mensagens de erro e o que já tentou." /><div className="flex justify-between text-xs text-muted-foreground"><span>{descricao.trim().length < 20 ? `Faltam ${20 - descricao.trim().length} caracteres para continuar.` : "Descrição suficiente para iniciar a classificação."}</span><span>{descricao.length} caracteres</span></div></div>
      {sugestao && <div className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><div className="font-medium">Para agilizar o atendimento</div><p className="mt-1 text-muted-foreground">{sugestao}</p></div></div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>2. Classificação</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2"><Label>Tipo de Chamado</Label><Select value={tipoChamadoId} onValueChange={(v) => { setTipoChamadoId(v); setImpacto(""); setUrgencia(""); setPrioridade("media"); }}><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent>{tiposChamado.map((tipo) => <SelectItem key={tipo.id} value={tipo.id}>{tipo.nome}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">O tipo define o fluxo operacional e as regras de SLA aplicáveis.</p></div>
      <div className="space-y-2"><Label>Segmento</Label><Select value={segmentoId} onValueChange={(v) => { setSegmentoId(v); setCategoriaId(""); setSubcategoriaId(""); }}><SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger><SelectContent>{segmentos.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Escolha a área/serviço que deve tratar o chamado. O departamento do solicitante permanece separado.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Categoria</Label><Select value={categoriaId} onValueChange={(v) => { setCategoriaId(v); setSubcategoriaId(""); }} disabled={!segmentoId}><SelectTrigger><SelectValue placeholder={segmentoId ? "Selecione" : "Escolha segmento"} /></SelectTrigger><SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Subcategoria</Label><Select value={subcategoriaId} onValueChange={setSubcategoriaId} disabled={!categoriaId}><SelectTrigger><SelectValue placeholder={categoriaId ? "Selecione (opcional)" : "Escolha categoria"} /></SelectTrigger><SelectContent>{subcategorias.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent></Select></div></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>3. Impacto e prioridade</CardTitle></CardHeader><CardContent className="space-y-4">
      {incidente ? <><div className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-muted-foreground">Como este é um incidente, a prioridade será calculada automaticamente pelo impacto e pela urgência. Você não precisa escolher a prioridade manualmente.</p></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Impacto</Label><Select value={impacto} onValueChange={(v) => setImpacto(v as typeof impacto)}><SelectTrigger><SelectValue placeholder="Selecione o impacto" /></SelectTrigger><SelectContent><SelectItem value="empresa">Toda a empresa</SelectItem><SelectItem value="departamento">Um departamento</SelectItem><SelectItem value="usuario">Apenas um usuário</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Urgência</Label><Select value={urgencia} onValueChange={(v) => setUrgencia(v as typeof urgencia)}><SelectTrigger><SelectValue placeholder="Selecione a urgência" /></SelectTrigger><SelectContent><SelectItem value="critica">Crítica / imediata</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent></Select></div></div></> : <div className="space-y-2"><Label>Prioridade</Label><Select value={prioridade} onValueChange={(v) => setPrioridade(v as typeof prioridade)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem><SelectItem value="critica">Crítica</SelectItem></SelectContent></Select></div>}
      {incidente && prioridadeCalculada && <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm"><span className="font-medium">Prioridade calculada:</span> {prioridadeCalculada === "critica" ? "P1 – Crítica" : prioridadeCalculada === "alta" ? "P2 – Alta" : prioridadeCalculada === "media" ? "P3 – Média" : "P4 – Baixa"}<span className="ml-2 text-muted-foreground">(impacto + urgência)</span></div>}
    </CardContent></Card>
    <Card><CardHeader><CardTitle>4. Anexos</CardTitle></CardHeader><CardContent><AnexoDropzone onArquivos={(novos) => setAnexos((atual) => [...atual, ...novos])} pendentes={anexos} progresso={progresso} onRemover={(i) => setAnexos((atual) => atual.filter((_, idx) => idx !== i))} disabled={loading} /><p className="mt-2 text-xs text-muted-foreground">Opcional. Use imagens ou arquivos que ajudem o atendimento a entender o problema.</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Resumo</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="grid gap-2 sm:grid-cols-2"><Summary label="Tipo" value={tipoSelecionado?.nome} /><Summary label="Segmento" value={segmentos.find((s) => s.id === segmentoId)?.nome} /><Summary label="Categoria" value={categorias.find((c) => c.id === categoriaId)?.nome} /><Summary label="Subcategoria" value={subcategorias.find((s) => s.id === subcategoriaId)?.nome || "Não informada"} /><Summary label="Prioridade" value={prioridadeCalculada ?? prioridade} /></div>{progressoAbertura < 100 && <p className="text-xs text-muted-foreground">Complete os campos obrigatórios para liberar a abertura.</p>}<div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => navigate({ to: "/chamados" })}>Cancelar</Button><Button type="button" disabled={loading || progressoAbertura < 100} onClick={handleSubmit}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{!loading && <CheckCircle2 className="mr-2 h-4 w-4" />}Abrir chamado</Button></div></CardContent></Card>
  </div>);
}

function Summary({ label, value }: { label: string; value?: string }) { return <div className="rounded-md border bg-muted/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-medium capitalize">{value || "Aguardando seleção"}</div></div>; }
