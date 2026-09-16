import { supabase } from "@/integrations/supabase/client";

export const TAXONOMIA_CHAMADOS: Record<string, Record<string, string[]>> = {
  Comercial: {
    Clientes: ["Cadastro de cliente", "Alteração de cadastro", "Consulta de cliente", "Inativação de cliente"],
    Orçamentos: ["Criar orçamento", "Alterar orçamento", "Aprovar orçamento", "Consultar orçamento"],
    Pedidos: ["Criar pedido", "Alterar pedido", "Cancelar pedido", "Consultar pedido"],
    "Preços e condições": ["Consulta de preço", "Alteração de preço", "Condição comercial"],
    Propostas: ["Criar proposta", "Alterar proposta", "Aprovar proposta"],
    Relatórios: ["Relatório de vendas", "Relatório de clientes", "Relatório de pedidos"],
  },
  "E-commerce": {
    Produtos: ["Cadastro de produto", "Alteração de produto", "Preço", "Estoque", "Imagens"],
    Pedidos: ["Pedido não localizado", "Alteração de pedido", "Cancelamento", "Status do pedido"],
    Pagamento: ["Pagamento não aprovado", "Pagamento pendente", "Estorno", "Divergência de pagamento"],
    Entrega: ["Frete", "Prazo de entrega", "Rastreamento", "Problema na entrega"],
    Site: ["Erro no site", "Alteração de conteúdo", "Alteração de layout", "Problema de acesso"],
    Promoções: ["Cadastro de promoção", "Cupom de desconto", "Alteração de promoção"],
    Marketplace: ["Cadastro", "Integração", "Pedido", "Preço"],
  },
  Expedição: {
    "Separação de pedidos": ["Solicitação de separação", "Alteração de separação", "Divergência na separação"],
    Conferência: ["Conferência de pedido", "Divergência de quantidade", "Divergência de produto"],
    Transporte: ["Solicitação de coleta", "Transportadora", "Rastreamento", "Problema na entrega"],
    Documentação: ["Nota fiscal", "Romaneio", "Documento de transporte"],
    Devoluções: ["Solicitação de devolução", "Recebimento de devolução", "Conferência de devolução"],
    Ocorrências: ["Atraso", "Avaria", "Extravio", "Divergência"],
  },
  Fábrica: {
    Produção: ["Ordem de produção", "Programação", "Alteração de produção", "Acompanhamento"],
    "Matéria-prima": ["Solicitação de material", "Falta de material", "Divergência", "Entrada de material"],
    Qualidade: ["Inspeção", "Não conformidade", "Liberação", "Análise"],
    Manutenção: ["Manutenção preventiva", "Manutenção corretiva", "Falha de equipamento", "Solicitação de manutenção"],
    Estoque: ["Consulta de estoque", "Movimentação", "Inventário", "Divergência de estoque"],
    Processos: ["Alteração de processo", "Melhoria de processo", "Padronização"],
  },
  Marketing: {
    Campanhas: ["Criação de campanha", "Alteração de campanha", "Divulgação"],
    Materiais: ["Arte", "Banner", "Catálogo", "Apresentação"],
    Conteúdo: ["Criação de conteúdo", "Revisão", "Publicação"],
    "Redes sociais": ["Post", "Stories", "Vídeo", "Calendário de conteúdo"],
    Eventos: ["Planejamento", "Divulgação", "Material para evento"],
    Marca: ["Identidade visual", "Material institucional", "Aplicação da marca"],
  },
};

/** Garante que o catálogo padrão das cinco áreas exista no banco sem duplicar registros. */
export async function garantirTaxonomiaChamados() {
  const { data: segmentos, error: segmentosError } = await supabase
    .from("segmentos")
    .select("id,nome")
    .eq("ativo", true);
  if (segmentosError) throw new Error(segmentosError.message);

  for (const [nomeSegmento, categoriasMap] of Object.entries(TAXONOMIA_CHAMADOS)) {
    const segmento = (segmentos ?? []).find((item) => item.nome.trim().toLowerCase() === nomeSegmento.trim().toLowerCase());
    if (!segmento) continue;

    const { data: categorias, error: categoriasError } = await supabase
      .from("categorias")
      .select("id,nome")
      .eq("segmento_id", segmento.id);
    if (categoriasError) throw new Error(categoriasError.message);

    for (const [nomeCategoria, nomesSubcategorias] of Object.entries(categoriasMap)) {
      let categoria = (categorias ?? []).find((item) => item.nome.trim().toLowerCase() === nomeCategoria.trim().toLowerCase());
      if (!categoria) {
        const { data: novaCategoria, error } = await supabase
          .from("categorias")
          .insert({ nome: nomeCategoria, segmento: segmento.nome, segmento_id: segmento.id, ativo: true })
          .select("id,nome")
          .single();
        if (error) throw new Error(`Não foi possível criar a categoria ${nomeCategoria}: ${error.message}`);
        categoria = novaCategoria;
      }

      const { data: subcategorias, error: subsError } = await supabase
        .from("subcategorias")
        .select("id,nome")
        .eq("categoria_id", categoria.id);
      if (subsError) throw new Error(subsError.message);

      const existentes = new Set((subcategorias ?? []).map((item) => item.nome.trim().toLowerCase()));
      const faltantes = nomesSubcategorias.filter((nome) => !existentes.has(nome.trim().toLowerCase()));
      if (faltantes.length) {
        const { error } = await supabase
          .from("subcategorias")
          .insert(faltantes.map((nome) => ({ categoria_id: categoria!.id, nome })));
        if (error) throw new Error(`Não foi possível criar subcategorias de ${nomeCategoria}: ${error.message}`);
      }
    }
  }
}
