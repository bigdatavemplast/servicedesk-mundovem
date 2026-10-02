import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paperclip, Download, Trash2, FileText, Loader2, Maximize2 } from "lucide-react";
import { AnexoDropzone } from "./AnexoDropzone";
import { ehImagem, enviarAnexo, formatarTamanho, urlAssinada } from "@/lib/anexos";
import { useServerFn } from "@tanstack/react-start";
import { registrarHistoricoAnexo } from "@/lib/chamado.functions";

type Anexo = {
  id: string;
  nome_arquivo: string;
  storage_path: string;
  tamanho_bytes: number | null;
  content_type: string | null;
  criado_em: string;
  autor_id: string;
  autor?: { nome: string } | null;
};

function PreviewImagem({ anexo, onAmpliar }: { anexo: Anexo; onAmpliar: (url: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void urlAssinada(anexo.storage_path, 600).then((u) => {
      if (ativo) setUrl(u);
    });
    return () => {
      ativo = false;
    };
  }, [anexo.storage_path]);

  if (!url) return <div className="h-56 w-full animate-pulse rounded-lg bg-muted" />;

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => onAmpliar(url)} aria-label={`Ampliar imagem ${anexo.nome_arquivo}`} className="group relative block w-full overflow-hidden rounded-lg border bg-muted/20 text-left focus:outline-none focus:ring-2 focus:ring-ring" style={{ cursor: "zoom-in" }}>
        <img src={url} alt={`Pré-visualização de ${anexo.nome_arquivo}`} className="max-h-[420px] min-h-[180px] w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]" loading="lazy" />
        <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 group-hover:opacity-100">
          <Maximize2 className="h-3 w-3" aria-hidden="true" /> Ampliar
        </span>
      </button>
      <p className="truncate text-sm font-medium" title={anexo.nome_arquivo}>{anexo.nome_arquivo}</p>
    </div>
  );
}

export function AnexosSecao({ chamadoId, userId, podeRemoverTodos = false }: { chamadoId: string; userId: string; podeRemoverTodos?: boolean }) {
  const qc = useQueryClient();
  const registrarHistoricoServer = useServerFn(registrarHistoricoAnexo);
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState<File[]>([]);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [nomeAmpliada, setNomeAmpliada] = useState<string | null>(null);

  const { data: anexos = [] } = useQuery({
    queryKey: ["chamado-anexos", chamadoId],
    queryFn: async () => {
      const { data } = await supabase.from("anexos_chamado").select("id,nome_arquivo,storage_path,tamanho_bytes,content_type,criado_em,autor_id,autor:profiles(nome)").eq("chamado_id", chamadoId).order("criado_em", { ascending: false });
      return (data ?? []) as unknown as Anexo[];
    },
  });

  function atualizarHistorico() {
    void qc.invalidateQueries({ queryKey: ["chamado-historico", chamadoId] });
  }

  async function subir(arquivos: File[]) {
    setEnviando((atual) => [...atual, ...arquivos]);
    for (const file of arquivos) {
      try {
        await enviarAnexo({ chamadoId, autorId: userId, file, onProgress: (pct) => setProgresso((p) => ({ ...p, [file.name]: pct })) });
        const acao = ehImagem(file.name, file.type) ? "foto_adicionada" : "anexo_adicionado";
        await registrarHistoricoServer({ data: { chamadoId, acao, nomeArquivo: file.name } });
        toast.success(`${file.name} enviado`);
        atualizarHistorico();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Falha ao enviar ${file.name}`);
      } finally {
        setEnviando((atual) => atual.filter((f) => f !== file));
        setProgresso((p) => { const { [file.name]: _ignorado, ...resto } = p; return resto; });
      }
    }
    void qc.invalidateQueries({ queryKey: ["chamado-anexos", chamadoId] });
  }

  async function baixar(anexo: Anexo) {
    const url = await urlAssinada(anexo.storage_path);
    if (!url) return toast.error("Falha ao gerar link de download");
    const a = document.createElement("a"); a.href = url; a.download = anexo.nome_arquivo; a.click();
  }

  function ampliar(url: string, nome: string) { setAmpliada(url); setNomeAmpliada(nome); }

  const remover = useMutation({
    mutationFn: async (anexo: Anexo) => {
      await supabase.storage.from("chamados-anexos").remove([anexo.storage_path]);
      const { error } = await supabase.from("anexos_chamado").delete().eq("id", anexo.id);
      if (error) throw new Error(error.message);
      const acao = ehImagem(anexo.nome_arquivo, anexo.content_type) ? "foto_removida" : "anexo_removido";
      await registrarHistoricoServer({ data: { chamadoId, acao, nomeArquivo: anexo.nome_arquivo } });
    },
    onSuccess: () => {
      toast.success("Anexo removido");
      void qc.invalidateQueries({ queryKey: ["chamado-anexos", chamadoId] });
      atualizarHistorico();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao remover"),
  });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Paperclip className="h-4 w-4" aria-hidden="true" />Anexos ({anexos.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <AnexoDropzone onArquivos={subir} pendentes={enviando} progresso={progresso} disabled={enviando.length > 0} />
        {anexos.length === 0 && enviando.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo neste chamado.</p>}
        <ul className="space-y-4">
          {anexos.map((a) => (
            <li key={a.id} className="rounded-lg border p-3 text-sm">
              {ehImagem(a.nome_arquivo, a.content_type) ? <PreviewImagem anexo={a} onAmpliar={(url) => ampliar(url, a.nome_arquivo)} /> : (
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted/40"><FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></span>
                  <div className="min-w-0"><p className="truncate font-medium">{a.nome_arquivo}</p><p className="text-xs text-muted-foreground">{formatarTamanho(a.tamanho_bytes)} · {new Date(a.criado_em).toLocaleString("pt-BR")}{a.autor?.nome ? ` · ${a.autor.nome}` : ""}</p></div>
                </div>
              )}
              <div className="mt-2 flex items-center justify-end gap-1">
                <Button size="icon" variant="ghost" aria-label={`Baixar ${a.nome_arquivo}`} onClick={() => void baixar(a)}><Download className="h-3 w-3" /></Button>
                {(a.autor_id === userId || podeRemoverTodos) && <Button size="icon" variant="ghost" aria-label={`Remover ${a.nome_arquivo}`} disabled={remover.isPending} onClick={() => remover.mutate(a)}>{remover.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 text-red-500" />}</Button>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <Dialog open={!!ampliada} onOpenChange={(aberto) => { if (!aberto) { setAmpliada(null); setNomeAmpliada(null); } }}>
        <DialogContent className="max-w-5xl"><DialogHeader><DialogTitle className="truncate text-sm">{nomeAmpliada ?? "Visualizar anexo"}</DialogTitle></DialogHeader>{ampliada && <div className="flex max-h-[80vh] items-center justify-center overflow-auto rounded-lg bg-muted/20 p-2"><img src={ampliada} alt={nomeAmpliada ?? "Anexo ampliado"} className="max-h-[76vh] max-w-full object-contain" /></div>}</DialogContent>
      </Dialog>
    </Card>
  );
}
