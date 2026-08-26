import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Network,
  Plus,
  X,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/itsm-servicos")({
  component: ItsmServicos,
});

const statusLabel: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

type Service = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  proprietario_id: string | null;
  criado_em: string;
  atualizado_em: string;
};

function ItsmServicos() {
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [selected, setSelected] = useState<Service | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState("ativo");

  const {
    data,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ["itsm-servicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itsm_servicos")
        .select("*")
        .order("nome");

      if (error) {
        throw error;
      }

      return (data ?? []) as Service[];
    },
  });

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setStatus("ativo");
    setError(null);
  };

  const closeForm = () => {
    setOpen(false);
    setEditing(null);
    resetForm();
  };

  const loadForEdit = (service: Service) => {
    setNome(service.nome ?? "");
    setDescricao(service.descricao ?? "");
    setStatus(service.status ?? "ativo");
    setError(null);

    setEditing(service);
    setOpen(true);
  };

  const save = async () => {
    if (!nome.trim()) {
      setError("Informe o nome do serviço.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      status,
      atualizado_em: new Date().toISOString(),
    };

    const result = editing
      ? await supabase
          .from("itsm_servicos")
          .update(payload)
          .eq("id", editing.id)
          .select("*")
          .single()
      : await supabase
          .from("itsm_servicos")
          .insert(payload)
          .select("*")
          .single();

    setSaving(false);

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "Já existe um serviço com este nome."
          : result.error.message,
      );

      return;
    }

    setSelected(result.data as Service);
    closeForm();

    await queryClient.invalidateQueries({
      queryKey: ["itsm-servicos"],
    });
  };

  const remove = async () => {
    if (!selected) {
      return;
    }

    const confirmed = window.confirm(
      `Excluir o serviço "${selected.nome}"?`,
    );

    if (!confirmed) {
      return;
    }

    const result = await supabase
      .from("itsm_servicos")
      .delete()
      .eq("id", selected.id);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setSelected(null);

    await queryClient.invalidateQueries({
      queryKey: ["itsm-servicos"],
    });
  };

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />

            <h1 className="text-2xl font-semibold tracking-tight">
              Serviços
            </h1>
          </div>

          <p className="text-sm text-muted-foreground">
            Gestão dos serviços de TI e negócio e seus vínculos na CMDB.
          </p>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo serviço
        </Button>
      </div>

      {/* Formulário */}
      {open && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {editing ? "Editar serviço" : "Novo serviço"}
            </CardTitle>

            <Button
              variant="ghost"
              size="icon"
              onClick={closeForm}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">

            <div className="grid gap-4 md:grid-cols-2">

              <div className="space-y-2">
                <Label htmlFor="servico-nome">
                  Nome *
                </Label>

                <Input
                  id="servico-nome"
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  placeholder="Ex.: ERP Senior Sapiens"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>

                <Select
                  value={status}
                  onValueChange={setStatus}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="ativo">
                      Ativo
                    </SelectItem>

                    <SelectItem value="inativo">
                      Inativo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="servico-descricao">
                  Descrição
                </Label>

                <Textarea
                  id="servico-descricao"
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(event.target.value)
                  }
                  placeholder="Descreva o serviço..."
                  rows={4}
                />
              </div>

            </div>

            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={closeForm}
              >
                Cancelar
              </Button>

              <Button
                onClick={save}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>

          </CardContent>
        </Card>
      )}

      {/* Detalhes */}
      {selected && !open && (
        <Card className="border-primary/50 ring-1 ring-primary/20">

          <CardHeader className="flex flex-row items-center justify-between">

            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {selected.nome}
              </CardTitle>

              <p className="text-sm text-muted-foreground">
                Detalhes do serviço
              </p>
            </div>

            <div className="flex gap-2">

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadForEdit(selected)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={remove}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>

            </div>

          </CardHeader>

          <CardContent>

            <div className="grid gap-4 md:grid-cols-2">

              <Detail
                label="Status"
                value={
                  statusLabel[selected.status] ??
                  selected.status
                }
              />

              <Detail
                label="ID"
                value={selected.id}
              />

              <div className="md:col-span-2">
                <Detail
                  label="Descrição"
                  value={selected.descricao}
                />
              </div>

            </div>

          </CardContent>
        </Card>
      )}

      {/* Erro */}
      {loadError && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Não foi possível carregar os serviços.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>

        <CardHeader>
          <CardTitle>
            Serviços registrados
          </CardTitle>
        </CardHeader>

        <CardContent>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : data && data.length > 0 ? (

            <div className="space-y-3">

              {data.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4"
                >

                  <div className="min-w-0">

                    <div className="font-medium">
                      {service.nome}
                    </div>

                    <div className="text-sm text-muted-foreground">
                      {statusLabel[service.status] ??
                        service.status}
                    </div>

                    {service.descricao && (
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {service.descricao}
                      </div>
                    )}

                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(service)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver detalhes
                  </Button>

                </div>
              ))}

            </div>

          ) : (

            <p className="text-sm text-muted-foreground">
              Nenhum serviço cadastrado.
            </p>

          )}

        </CardContent>
      </Card>

    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="space-y-1">

      <div className="text-xs font-medium text-muted-foreground">
        {label}
      </div>

      <div className="whitespace-pre-wrap text-sm">
        {value === null ||
        value === undefined ||
        value === ""
          ? "-"
          : String(value)}
      </div>

    </div>
  );
}
