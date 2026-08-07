import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Paperclip, Download, Trash2, FileText, Loader2 } from "lucide-react";
import { AnexoDropzone } from "./AnexoDropzone";
import { ehImagem, enviarAnexo, formatarTamanho, urlAssinada } from "@/lib/anexos";

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

function Miniatura({ anexo, onAmpliar }: { anexo: Anexo; onAmpliar: (url: string) => void }) {
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

  if (!url) {
    return <div className="h-10 w-10 shrink-0 animate-pulse rounded bg-muted" />;
  }

  return (
    <button
      type="button"
      onClick={() => onAmpliar(url)}
      aria-label={`Ampliar imagem ${anexo.nome_arquivo}`}
      className="h-10 w-10 shrink-0 overflow-hidden rounded border"
    >
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </button>
  );
}

export function AnexosSecao({
  chamadoId,
  userId,
  podeRemoverTodos = false,
}: {
  chamadoId: string;
  userId: string;
  podeRemoverTodos?: boolean;
}) {
  const qc = useQueryClient();
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const [enviando, setEnviando] = useState<File[]>([]);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const { data: anexos = [] } = useQuery({
    queryKey: ["chamado-anexos", chamadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from("anexos_chamado")
        .select("id,nome_arquivo,storage_path,tamanho_bytes,content_type,criado_em,autor_id,autor:profiles(nome)")
        .eq("chamado_id", chamadoId)
        .order("criado_em", { ascending: false });
      return (data ?? []) as unknown as Anexo[];
    },
  });

  async function subir(arquivos: File[]) {
    setEnviando((atual) => [...atual, ...arquivos]);
    for (const file of arquivos) {
      try {
        await enviarAnexo({
          chamadoId,
          autorId: userId,
          file,
          onProgress: (pct) => setProgresso((p) => ({ ...p, [file.name]: pct })),
        });
        toast.success(`${file.name} enviado`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Falha ao enviar ${file.name}`);
      } finally {
        setEnviando((atual) => atual.filter((f) => f !== file));
        setProgresso((p) => {
          const { [file.name]: _ignorado, ...resto } = p;
          return resto;
        });
      }
    }
    void qc.invalidateQueries({ queryKey: ["chamado-anexos", chamadoId] });
  }

  async function baixar(anexo: Anexo) {
    const url = await urlAssinada(anexo.storage_path);
    if (!url) return toast.error("Falha ao gerar link de download");
    const a = document.createElement("a");
    a.href = url;
    a.download = anexo.nome_arquivo;
    a.click();
  }

  const remover = useMutation({
    mutationFn: async (anexo: Anexo) => {
      await supabase.storage.from("chamados-anexos").remove([anexo.storage_path]);
      const { error } = await supabase.from("anexos_chamado").delete().eq("id", anexo.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Anexo removido");
      void qc.invalidateQueries({ queryKey: ["chamado-anexos", chamadoId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao remover"),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Paperclip className="h-4 w-4" aria-hidden="true" />
          Anexos ({anexos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnexoDropzone onArquivos={subir} pendentes={enviando} progresso={progresso} disabled={enviando.length > 0} />

        {anexos.length === 0 && enviando.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum anexo neste chamado.</p>
        )}

        <ul className="space-y-1">
          {anexos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                {ehImagem(a.nome_arquivo, a.content_type) ? (
                  <Miniatura anexo={a} onAmpliar={setAmpliada} />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-muted/40">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.nome_arquivo}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatarTamanho(a.tamanho_bytes)} · {new Date(a.criado_em).toLocaleString("pt-BR")}
                    {a.autor?.nome ? ` · ${a.autor.nome}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" aria-label={`Baixar ${a.nome_arquivo}`} onClick={() => void baixar(a)}>
                  <Download className="h-3 w-3" />
                </Button>
                {(a.autor_id === userId || podeRemoverTodos) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remover ${a.nome_arquivo}`}
                    disabled={remover.isPending}
                    onClick={() => remover.mutate(a)}
                  >
                    {remover.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 text-red-500" />
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={!!ampliada} onOpenChange={(aberto) => !aberto && setAmpliada(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-sm">Visualizar anexo</DialogTitle>
          </DialogHeader>
          {ampliada && <img src={ampliada} alt="Anexo ampliado" className="max-h-[75vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
