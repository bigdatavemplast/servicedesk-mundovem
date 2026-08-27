import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, ImageIcon } from "lucide-react";
import {
  ACCEPT_ANEXOS,
  EXTENSOES_PERMITIDAS,
  ehImagem,
  formatarTamanho,
  validarAnexo,
} from "@/lib/anexos";

type Props = {
  onArquivos: (arquivos: File[]) => void;
  pendentes?: File[];
  progresso?: Record<string, number>;
  onRemover?: (index: number) => void;
  disabled?: boolean;
};

export function AnexoDropzone({ onArquivos, pendentes = [], progresso, onRemover, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function processar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;

    const validos: File[] = [];
    for (const file of Array.from(lista)) {
      const erro = validarAnexo(file);
      if (erro) {
        toast.error(erro);
      } else {
        validos.push(file);
      }
    }

    if (validos.length > 0) onArquivos(validos);
  }

  function abrirSeletor() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={abrirSeletor}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            abrirSeletor();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (!disabled) processar(e.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-lg border border-dashed p-4 text-center transition-colors ${
          arrastando ? "border-primary bg-primary/5" : "border-border"
        } ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-muted/30"}`}
      >
        <input
          ref={inputRef}
          id="anexo-arquivo"
          type="file"
          multiple
          accept={ACCEPT_ANEXOS}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            processar(e.target.files);
            e.target.value = "";
          }}
          onClick={(e) => e.stopPropagation()}
        />

        <Upload className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm">
          Arraste os arquivos aqui ou <span className="font-medium text-primary underline underline-offset-2">clique para anexar</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {EXTENSOES_PERMITIDAS.join(", ").toUpperCase()} · até 10 MB por arquivo
        </p>
      </div>

      {pendentes.length > 0 && (
        <ul className="space-y-1">
          {pendentes.map((file, i) => {
            const pct = progresso?.[file.name];
            return (
              <li key={`${file.name}-${i}`} className="rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {ehImagem(file.name, file.type) ? (
                      <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatarTamanho(file.size)}</span>
                  </span>
                  {onRemover && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      aria-label={`Remover ${file.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemover(i);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                {typeof pct === "number" && <Progress value={pct} className="mt-2 h-1" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
