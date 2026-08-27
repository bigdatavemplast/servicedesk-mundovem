import { supabase } from "@/integrations/supabase/client";

export const TAMANHO_MAXIMO_ANEXO = 10 * 1024 * 1024;
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

export function validarAnexo(file: File): string | null {
  const ext = extensaoDe(file.name);
  if (!(EXTENSOES_PERMITIDAS as readonly string[]).includes(ext)) return `${file.name}: tipo não permitido (aceitos: ${EXTENSOES_PERMITIDAS.join(", ")})`;
  if (file.size > TAMANHO_MAXIMO_ANEXO) return `${file.name}: excede o limite de 10 MB`;
  return null;
}

function nomeSeguro(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Upload pelo SDK oficial do Supabase, respeitando a sessão e as políticas do Storage. */
export async function enviarAnexo(opts: {
  chamadoId: string;
  autorId: string;
  file: File;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  const { chamadoId, autorId, file, onProgress } = opts;
  const erro = validarAnexo(file);
  if (erro) throw new Error(erro);

  const path = `${chamadoId}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`;
  onProgress?.(10);

  const { error: uploadError } = await supabase.storage.from(BUCKET_ANEXOS).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw new Error(`Não foi possível enviar ${file.name}: ${uploadError.message}`);

  onProgress?.(90);
  const { error: insertError } = await supabase.from("anexos_chamado").insert({
    chamado_id: chamadoId,
    autor_id: autorId,
    nome_arquivo: file.name,
    storage_path: path,
    tamanho_bytes: file.size,
    content_type: file.type || null,
  } as never);

  if (insertError) {
    await supabase.storage.from(BUCKET_ANEXOS).remove([path]);
    throw new Error(`O arquivo foi enviado, mas não foi possível registrar o anexo: ${insertError.message}`);
  }
  onProgress?.(100);
}

export async function urlAssinada(path: string, segundos = 120): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_ANEXOS).createSignedUrl(path, segundos);
  if (error || !data) return null;
  return data.signedUrl;
}
