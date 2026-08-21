import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  alterarAtivoTipoChamado,
  atualizarTipoChamado,
  criarTipoChamado,
  excluirTipoChamado,
  listarTiposChamado,
} from "@/lib/tipos-chamado.functions";
import type { TipoChamado } from "@/lib/types/tipos-chamado";

export const Route = createFileRoute("/_authenticated/admin/tipos-chamado")({
  component: TiposChamadoPage,
});

function TiposChamadoPage() {
  const [tipos, setTipos] = useState<TipoChamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TipoChamado | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ordem, setOrdem] = useState("0");

  async function carregar() {
    try {
      setLoading(true);
      setTipos(await listarTiposChamado());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os tipos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function limpar() {
    setEditing(null);
    setNome("");
    setDescricao("");
    setOrdem("0");
  }

  function editar(tipo: TipoChamado) {
    setEditing(tipo);
    setNome(tipo.nome);
    setDescricao(tipo.descricao ?? "");
    setOrdem(String(tipo.ordem));
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome do tipo de chamado.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        ordem: Number(ordem) || 0,
      };

      if (editing) {
        await atualizarTipoChamado({ data: { id: editing.id, ...payload } });
        toast.success("Tipo de chamado atualizado.");
      } else {
        await criarTipoChamado({ data: payload });
        toast.success("Tipo de chamado criado.");
      }

      limpar();
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function alternar(tipo: TipoChamado) {
    try {
      await alterarAtivoTipoChamado({ data: { id: tipo.id, ativo: !tipo.ativo } });
      toast.success(tipo.ativo ? "Tipo desativado." : "Tipo ativado.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o status.");
    }
  }

  async function excluir(tipo: TipoChamado) {
    if (!window.confirm(`Excluir o tipo "${tipo.nome}"?`)) return;

    try {
      await excluirTipoChamado({ data: { id: tipo.id } });
      toast.success("Tipo de chamado excluído.");
      await carregar();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Tipos de Chamado</h1>
        <p className="text-sm text-muted-foreground">
          Configure a natureza do atendimento, independente de segmento, categoria e subcategoria.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium">{editing ? "Editar tipo" : "Novo tipo"}</h2>
          {!editing && <Plus className="h-5 w-5 text-muted-foreground" />}
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_2fr_120px_auto] md:items-end">
          <label className="space-y-1 text-sm">
            <span>Nome</span>
            <input className="w-full rounded-md border bg-background px-3 py-2" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Descrição</span>
            <input className="w-full rounded-md border bg-background px-3 py-2" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={1000} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Ordem</span>
            <input type="number" min={0} className="w-full rounded-md border bg-background px-3 py-2" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Adicionar"}
            </button>
            {editing && <button className="rounded-md border px-4 py-2 text-sm" onClick={limpar}>Cancelar</button>}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : tipos.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum tipo de chamado cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr><th className="p-3">Ordem</th><th className="p-3">Nome</th><th className="p-3">Descrição</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {tipos.map((tipo) => (
                <tr key={tipo.id} className="border-b last:border-0">
                  <td className="p-3">{tipo.ordem}</td>
                  <td className="p-3 font-medium">{tipo.nome}</td>
                  <td className="p-3 text-muted-foreground">{tipo.descricao || "—"}</td>
                  <td className="p-3">{tipo.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button title="Editar" className="rounded-md p-2 hover:bg-muted" onClick={() => editar(tipo)}><Pencil className="h-4 w-4" /></button>
                      <button title={tipo.ativo ? "Desativar" : "Ativar"} className="rounded-md p-2 hover:bg-muted" onClick={() => void alternar(tipo)}><Power className="h-4 w-4" /></button>
                      <button title="Excluir" className="rounded-md p-2 hover:bg-muted" onClick={() => void excluir(tipo)}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
