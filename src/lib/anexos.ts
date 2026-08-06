import { supabase } from "@/integrations/supabase/client";

export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024; // 10 MB

/** Extensões permitidas para anexos de chamados. */
export const EXTENSOES_PERMITIDAS = ["png", "jpg", "jpeg", "webp", "pdf", "docx", "xlsx", "txt"] as const;

export const ACCEPT_ANEXOS = ".png,.jpg,.jpeg,.webp,.pdf,.docx,.xlsx,.txt";

export const BUCKET_ANEXOS = "chamados-anexos";

export function extensaoDe(nome: string): string {
  const partes = nome.split(".");
  return partes.length > 1 ? partes.pop()!.toLowerCase() : "";
}

export function ehImagem(nome: string, contentType?: string | null): boolean {
  if (contentType?.startsWith("image/")) return true;
  return ["png", "jpg", "jpeg", "webp"].includes(extensaoDe(nome));
}

export function formatarTamanho(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Valida extensão e tamanho. Retorna a mensagem de erro ou null quando válido. */
export function validarAnexo(file: File): string | null {
  const ext = extensaoDe(file.name);
  if (!(EXTENSOES_PERMITIDAS as readonly string[]).includes(ext)) {
    return `${file.name}: tipo não permitido (aceitos: ${EXTENSOES_PERMITIDAS.join(", ")})`;
  }
  if (file.size > TAMANHO_MAXIMO_ANEXO) {
    return `${file.name}: excede o limite de 10 MB`;
  }
  return null;
}

function nomeSeguro(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Faz upload de um arquivo para o bucket de anexos usando XHR (para ter progresso real)
 * e registra a linha correspondente em `anexos_chamado`.
 */
export async function enviarAnexo(opts: {
  chamadoId: string;
  autorId: string;
  file: File;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const { chamadoId, autorId, file, onProgress } = opts;
  const path = `${chamadoId}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`;

  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao.session?.access_token;
  const baseUrl = import.meta.env["VITE_SUPABASE_URL"];
  const apiKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (token && baseUrl && apiKey) {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${baseUrl}/storage/v1/object/${BUCKET_ANEXOS}/${encodeURI(path)}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", apiKey);
      xhr.setRequestHeader("x-upsert", "false");
      if (file.type) xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 95));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let msg = `Falha no upload (${xhr.status})`;
          try {
            const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
            msg = parsed.message ?? parsed.error ?? msg;
          } catch {
            // resposta não-JSON: mantém mensagem padrão
          }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Falha de rede durante o upload"));
      xhr.send(file);
    });
  } else {
    const up = await supabase.storage.from(BUCKET_ANEXOS).upload(path, file, { contentType: file.type });
    if (up.error) throw new Error(up.error.message);
    onProgress?.(95);
  }

  const ins = await supabase.from("anexos_chamado").insert({
    chamado_id: chamadoId,
    autor_id: autorId,
    nome_arquivo: file.name,
    storage_path: path,
    tamanho_bytes: file.size,
    content_type: file.type || null,
  } as never);

  if (ins.error) {
    await supabase.storage.from(BUCKET_ANEXOS).remove([path]);
    throw new Error(ins.error.message);
  }
  onProgress?.(100);
}

/** Gera URL assinada temporária para visualizar/baixar um anexo. */
export async function urlAssinada(path: string, segundos = 120): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(path, segundos);
  if (error || !data) return null;
  return data.signedUrl;
}
