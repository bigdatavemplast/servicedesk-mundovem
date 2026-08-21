export type TipoChamado = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
};

export type TipoChamadoInsert = {
  nome: string;
  descricao?: string | null;
  ativo?: boolean;
  ordem?: number;
};

export type TipoChamadoUpdate = {
  nome?: string;
  descricao?: string | null;
  ativo?: boolean;
  ordem?: number;
};
