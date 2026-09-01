export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          closed_at: string | null
          created_at: string | null
          id: string
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          confianca: number | null
          content: string
          conversation_id: string
          created_at: string | null
          fontes: Json
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          confianca?: number | null
          content: string
          conversation_id: string
          created_at?: string | null
          fontes?: Json
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          confianca?: number | null
          content?: string
          conversation_id?: string
          created_at?: string | null
          fontes?: Json
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_fk"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alteracoes_service_desk: {
        Row: {
          areas_afetadas: string
          arquivos_alterados: string | null
          atualizado_em: string
          atualizado_por: string | null
          codigo: string
          comportamento_anterior: string
          comportamento_novo: string
          criado_em: string
          criado_por: string
          data_alteracao: string
          descricao: string
          id: string
          impacto: string
          motivo: string
          objetivo: string
          partes_codigo: string | null
          procedimento_rollback: string | null
          procedimento_validacao: string
          responsavel_id: string
          riscos_observacoes: string | null
          status: string
          telas_afetadas: string | null
          tipo: string
          titulo: string
          versao: string | null
        }
        Insert: {
          areas_afetadas: string
          arquivos_alterados?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          codigo: string
          comportamento_anterior: string
          comportamento_novo: string
          criado_em?: string
          criado_por?: string
          data_alteracao?: string
          descricao: string
          id?: string
          impacto: string
          motivo: string
          objetivo: string
          partes_codigo?: string | null
          procedimento_rollback?: string | null
          procedimento_validacao: string
          responsavel_id: string
          riscos_observacoes?: string | null
          status?: string
          telas_afetadas?: string | null
          tipo?: string
          titulo: string
          versao?: string | null
        }
        Update: {
          areas_afetadas?: string
          arquivos_alterados?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          codigo?: string
          comportamento_anterior?: string
          comportamento_novo?: string
          criado_em?: string
          criado_por?: string
          data_alteracao?: string
          descricao?: string
          id?: string
          impacto?: string
          motivo?: string
          objetivo?: string
          partes_codigo?: string | null
          procedimento_rollback?: string | null
          procedimento_validacao?: string
          responsavel_id?: string
          riscos_observacoes?: string | null
          status?: string
          telas_afetadas?: string | null
          tipo?: string
          titulo?: string
          versao?: string | null
        }
        Relationships: []
      }
      alteracoes_service_desk_historico: {
        Row: {
          acao: string
          alteracao_id: string
          alterado_em: string
          alterado_por: string
          dados: Json
          id: number
          versao_registro: number
        }
        Insert: {
          acao: string
          alteracao_id: string
          alterado_em?: string
          alterado_por?: string
          dados: Json
          id?: number
          versao_registro: number
        }
        Update: {
          acao?: string
          alteracao_id?: string
          alterado_em?: string
          alterado_por?: string
          dados?: Json
          id?: number
          versao_registro?: number
        }
        Relationships: [
          {
            foreignKeyName: "alteracoes_service_desk_historico_alteracao_id_fkey"
            columns: ["alteracao_id"]
            isOneToOne: false
            referencedRelation: "alteracoes_service_desk"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos_chamado: {
        Row: {
          autor_id: string
          chamado_id: string
          content_type: string | null
          criado_em: string
          id: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number | null
        }
        Insert: {
          autor_id: string
          chamado_id: string
          content_type?: string | null
          criado_em?: string
          id?: string
          nome_arquivo: string
          storage_path: string
          tamanho_bytes?: number | null
        }
        Update: {
          autor_id?: string
          chamado_id?: string
          content_type?: string | null
          criado_em?: string
          id?: string
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "anexos_chamado_autor_profile_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      assistant_logs: {
        Row: {
          artigos_utilizados: number | null
          confidence: number | null
          criado_em: string | null
          feedback: boolean | null
          id: string
          pergunta: string
          resposta: string
          usuario_id: string | null
        }
        Insert: {
          artigos_utilizados?: number | null
          confidence?: number | null
          criado_em?: string | null
          feedback?: boolean | null
          id?: string
          pergunta: string
          resposta: string
          usuario_id?: string | null
        }
        Update: {
          artigos_utilizados?: number | null
          confidence?: number | null
          criado_em?: string | null
          feedback?: boolean | null
          id?: string
          pergunta?: string
          resposta?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      automacoes_service_desk: {
        Row: {
          acao: string
          ativo: boolean
          atualizado_em: string
          condicoes: Json
          criado_em: string
          descricao: string | null
          evento: string
          id: string
          nome: string
          ordem: number
          parametros_acao: Json
        }
        Insert: {
          acao: string
          ativo?: boolean
          atualizado_em?: string
          condicoes?: Json
          criado_em?: string
          descricao?: string | null
          evento: string
          id?: string
          nome: string
          ordem?: number
          parametros_acao?: Json
        }
        Update: {
          acao?: string
          ativo?: boolean
          atualizado_em?: string
          condicoes?: Json
          criado_em?: string
          descricao?: string | null
          evento?: string
          id?: string
          nome?: string
          ordem?: number
          parametros_acao?: Json
        }
        Relationships: []
      }
      avaliacoes_atendimento: {
        Row: {
          chamado_id: string
          comentario: string | null
          criado_em: string
          id: string
          nota: number
        }
        Insert: {
          chamado_id: string
          comentario?: string | null
          criado_em?: string
          id?: string
          nota: number
        }
        Update: {
          chamado_id?: string
          comentario?: string | null
          criado_em?: string
          id?: string
          nota?: number
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_atendimento_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: true
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      base_conhecimento: {
        Row: {
          atualizado_em: string
          autor_id: string | null
          categoria_id: string | null
          conteudo: string
          criado_em: string
          embedding: string | null
          id: string
          publicado: boolean
          slug: string
          tags: string[] | null
          titulo: string
          visualizacoes: number
        }
        Insert: {
          atualizado_em?: string
          autor_id?: string | null
          categoria_id?: string | null
          conteudo: string
          criado_em?: string
          embedding?: string | null
          id?: string
          publicado?: boolean
          slug: string
          tags?: string[] | null
          titulo: string
          visualizacoes?: number
        }
        Update: {
          atualizado_em?: string
          autor_id?: string | null
          categoria_id?: string | null
          conteudo?: string
          criado_em?: string
          embedding?: string | null
          id?: string
          publicado?: boolean
          slug?: string
          tags?: string[] | null
          titulo?: string
          visualizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimento_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      base_conhecimento_avaliacoes: {
        Row: {
          artigo_id: string
          criado_em: string
          id: string
          usuario_id: string
          util: boolean
        }
        Insert: {
          artigo_id: string
          criado_em?: string
          id?: string
          usuario_id: string
          util: boolean
        }
        Update: {
          artigo_id?: string
          criado_em?: string
          id?: string
          usuario_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimento_avaliacoes_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "base_conhecimento"
            referencedColumns: ["id"]
          },
        ]
      }
      base_conhecimento_feedback: {
        Row: {
          artigo_id: string
          atualizado_em: string
          criado_em: string
          id: string
          usuario_id: string
          util: boolean
        }
        Insert: {
          artigo_id: string
          atualizado_em?: string
          criado_em?: string
          id?: string
          usuario_id: string
          util: boolean
        }
        Update: {
          artigo_id?: string
          atualizado_em?: string
          criado_em?: string
          id?: string
          usuario_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "base_conhecimento_feedback_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "base_conhecimento"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          segmento: string
          segmento_id: string | null
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          segmento: string
          segmento_id?: string | null
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          segmento?: string
          segmento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          aberto_em: string
          atendente_id: string | null
          atendimento_abandonado: boolean
          atualizado_em: string
          avaliacao_comentario: string | null
          avaliacao_nota: number | null
          categoria_id: string | null
          criado_em: string
          custo_atendimento: number | null
          descricao: string
          embedding: string | null
          escalonado: boolean
          escalonado_em: string | null
          escalonamento_nivel: number
          fechado_em: string | null
          grupo_atendimento_id: string | null
          id: string
          impacto: string | null
          numero: string
          prazo_resolucao: string | null
          prazo_resposta: string | null
          primeira_chamada_resolvida: boolean | null
          primeira_resposta_em: string | null
          primeiro_atendimento_em: string | null
          prioridade: Database["public"]["Enums"]["prioridade_chamado"]
          reaberto_em: string | null
          resolvido_em: string | null
          respondido_em: string | null
          segmento_id: string | null
          sla_id: string | null
          sla_pausado: boolean
          sla_pausado_em: string | null
          sla_regra_id: string | null
          sla_resolucao_violado: boolean
          sla_resposta_violado: boolean
          sla_tempo_pausado_segundos: number
          sla_tempo_resolucao_segundos: number | null
          sla_tempo_resposta_segundos: number | null
          sla_tempo_restante_segundos: number | null
          solicitante_id: string
          status: Database["public"]["Enums"]["status_chamado"]
          subcategoria_id: string | null
          tags: string[] | null
          tempo_atendimento_minutos: number | null
          tipo_chamado_id: string | null
          tipo_fluxo: string | null
          titulo: string
          triagem_em: string | null
          triagem_por: string | null
          urgencia: string | null
        }
        Insert: {
          aberto_em?: string
          atendente_id?: string | null
          atendimento_abandonado?: boolean
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          categoria_id?: string | null
          criado_em?: string
          custo_atendimento?: number | null
          descricao: string
          embedding?: string | null
          escalonado?: boolean
          escalonado_em?: string | null
          escalonamento_nivel?: number
          fechado_em?: string | null
          grupo_atendimento_id?: string | null
          id?: string
          impacto?: string | null
          numero: string
          prazo_resolucao?: string | null
          prazo_resposta?: string | null
          primeira_chamada_resolvida?: boolean | null
          primeira_resposta_em?: string | null
          primeiro_atendimento_em?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          reaberto_em?: string | null
          resolvido_em?: string | null
          respondido_em?: string | null
          segmento_id?: string | null
          sla_id?: string | null
          sla_pausado?: boolean
          sla_pausado_em?: string | null
          sla_regra_id?: string | null
          sla_resolucao_violado?: boolean
          sla_resposta_violado?: boolean
          sla_tempo_pausado_segundos?: number
          sla_tempo_resolucao_segundos?: number | null
          sla_tempo_resposta_segundos?: number | null
          sla_tempo_restante_segundos?: number | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["status_chamado"]
          subcategoria_id?: string | null
          tags?: string[] | null
          tempo_atendimento_minutos?: number | null
          tipo_chamado_id?: string | null
          tipo_fluxo?: string | null
          titulo: string
          triagem_em?: string | null
          triagem_por?: string | null
          urgencia?: string | null
        }
        Update: {
          aberto_em?: string
          atendente_id?: string | null
          atendimento_abandonado?: boolean
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          categoria_id?: string | null
          criado_em?: string
          custo_atendimento?: number | null
          descricao?: string
          embedding?: string | null
          escalonado?: boolean
          escalonado_em?: string | null
          escalonamento_nivel?: number
          fechado_em?: string | null
          grupo_atendimento_id?: string | null
          id?: string
          impacto?: string | null
          numero?: string
          prazo_resolucao?: string | null
          prazo_resposta?: string | null
          primeira_chamada_resolvida?: boolean | null
          primeira_resposta_em?: string | null
          primeiro_atendimento_em?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          reaberto_em?: string | null
          resolvido_em?: string | null
          respondido_em?: string | null
          segmento_id?: string | null
          sla_id?: string | null
          sla_pausado?: boolean
          sla_pausado_em?: string | null
          sla_regra_id?: string | null
          sla_resolucao_violado?: boolean
          sla_resposta_violado?: boolean
          sla_tempo_pausado_segundos?: number
          sla_tempo_resolucao_segundos?: number | null
          sla_tempo_resposta_segundos?: number | null
          sla_tempo_restante_segundos?: number | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["status_chamado"]
          subcategoria_id?: string | null
          tags?: string[] | null
          tempo_atendimento_minutos?: number | null
          tipo_chamado_id?: string | null
          tipo_fluxo?: string | null
          titulo?: string
          triagem_em?: string | null
          triagem_por?: string | null
          urgencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_atendente_profile_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_grupo_atendimento_id_fkey"
            columns: ["grupo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "grupos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_sla_id_fkey"
            columns: ["sla_id"]
            isOneToOne: false
            referencedRelation: "slas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_sla_regra_id_fkey"
            columns: ["sla_regra_id"]
            isOneToOne: false
            referencedRelation: "sla_regras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_solicitante_profile_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_tipo_chamado_id_fkey"
            columns: ["tipo_chamado_id"]
            isOneToOne: false
            referencedRelation: "tipos_chamado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_triagem_por_fkey"
            columns: ["triagem_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comentarios_chamado: {
        Row: {
          autor_id: string
          chamado_id: string
          conteudo: string
          criado_em: string
          id: string
          interno: boolean
        }
        Insert: {
          autor_id: string
          chamado_id: string
          conteudo: string
          criado_em?: string
          id?: string
          interno?: boolean
        }
        Update: {
          autor_id?: string
          chamado_id?: string
          conteudo?: string
          criado_em?: string
          id?: string
          interno?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "comentarios_chamado_autor_profile_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comentarios_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      documentacao_sistema: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          conteudo: string
          criado_em: string
          criado_por: string | null
          id: string
          ordem: number
          titulo: string
          versao: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          conteudo: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          ordem?: number
          titulo: string
          versao?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          ordem?: number
          titulo?: string
          versao?: string | null
        }
        Relationships: []
      }
      documentos_assistente: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string | null
          conteudo: string
          criado_em: string
          criado_por: string | null
          embedding: string | null
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          conteudo: string
          criado_em?: string
          criado_por?: string | null
          embedding?: string | null
          id?: string
          tipo?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          embedding?: string | null
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_assistente_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escalonamento_regras: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          grupo_atendimento_id: string | null
          id: string
          minutos_relativos_sla: number
          nivel: number
          nome: string
          ordem: number
          prioridade: Database["public"]["Enums"]["prioridade_chamado"] | null
          segmento_id: string | null
          tipo_fluxo: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          grupo_atendimento_id?: string | null
          id?: string
          minutos_relativos_sla?: number
          nivel: number
          nome: string
          ordem?: number
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"] | null
          segmento_id?: string | null
          tipo_fluxo?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          grupo_atendimento_id?: string | null
          id?: string
          minutos_relativos_sla?: number
          nivel?: number
          nome?: string
          ordem?: number
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"] | null
          segmento_id?: string | null
          tipo_fluxo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalonamento_regras_grupo_atendimento_id_fkey"
            columns: ["grupo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "grupos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalonamento_regras_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      escalonamentos_chamado: {
        Row: {
          chamado_id: string
          executado_em: string
          id: string
          motivo: string
          nivel: number
          regra_id: string
        }
        Insert: {
          chamado_id: string
          executado_em?: string
          id?: string
          motivo: string
          nivel: number
          regra_id: string
        }
        Update: {
          chamado_id?: string
          executado_em?: string
          id?: string
          motivo?: string
          nivel?: number
          regra_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalonamentos_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalonamentos_chamado_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "escalonamento_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      gestao_capacidade: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          custo_hora: number
          grupo_atendimento_id: string | null
          horas_disponiveis_semana: number
          id: string
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          custo_hora?: number
          grupo_atendimento_id?: string | null
          horas_disponiveis_semana?: number
          id?: string
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          custo_hora?: number
          grupo_atendimento_id?: string | null
          horas_disponiveis_semana?: number
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gestao_capacidade_grupo_atendimento_id_fkey"
            columns: ["grupo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "grupos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gestao_capacidade_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_atendentes: {
        Row: {
          ativo: boolean
          criado_em: string
          grupo_id: string
          nivel_atendimento: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          grupo_id: string
          nivel_atendimento?: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          grupo_id?: string
          nivel_atendimento?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupo_atendentes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grupo_atendentes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grupo_sequencias: {
        Row: {
          atualizado_em: string
          grupo_id: string
          proximo_numero: number
        }
        Insert: {
          atualizado_em?: string
          grupo_id: string
          proximo_numero?: number
        }
        Update: {
          atualizado_em?: string
          grupo_id?: string
          proximo_numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "grupo_sequencias_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: true
            referencedRelation: "grupos_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_atendimento: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          prefixo: string | null
          segmento_id: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          prefixo?: string | null
          segmento_id: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          prefixo?: string | null
          segmento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grupos_atendimento_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_chamado: {
        Row: {
          acao: string
          autor_id: string | null
          chamado_id: string
          criado_em: string
          de: string | null
          id: string
          para: string | null
        }
        Insert: {
          acao: string
          autor_id?: string | null
          chamado_id: string
          criado_em?: string
          de?: string | null
          id?: string
          para?: string | null
        }
        Update: {
          acao?: string
          autor_id?: string | null
          chamado_id?: string
          criado_em?: string
          de?: string | null
          id?: string
          para?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_chamado_autor_profile_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_sla_chamado: {
        Row: {
          autor_id: string | null
          chamado_id: string
          criado_em: string
          id: string
          novo_prazo: string | null
          observacao: string | null
          prazo_anterior: string | null
          tempo_restante_segundos: number | null
          tipo: string
        }
        Insert: {
          autor_id?: string | null
          chamado_id: string
          criado_em?: string
          id?: string
          novo_prazo?: string | null
          observacao?: string | null
          prazo_anterior?: string | null
          tempo_restante_segundos?: number | null
          tipo: string
        }
        Update: {
          autor_id?: string | null
          chamado_id?: string
          criado_em?: string
          id?: string
          novo_prazo?: string | null
          observacao?: string | null
          prazo_anterior?: string | null
          tempo_restante_segundos?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_sla_chamado_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_sla_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_aprovacoes: {
        Row: {
          aprovador_id: string | null
          comentario: string | null
          decidido_em: string | null
          entidade: string
          entidade_id: string
          id: string
          solicitado_em: string
          status: string
        }
        Insert: {
          aprovador_id?: string | null
          comentario?: string | null
          decidido_em?: string | null
          entidade: string
          entidade_id: string
          id?: string
          solicitado_em?: string
          status?: string
        }
        Update: {
          aprovador_id?: string | null
          comentario?: string | null
          decidido_em?: string | null
          entidade?: string
          entidade_id?: string
          id?: string
          solicitado_em?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_aprovacoes_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_artigos_conhecimento: {
        Row: {
          atualizado_em: string
          autor_id: string | null
          categoria: string | null
          conteudo: string
          criado_em: string
          id: string
          nao_util: number
          publicado_em: string | null
          resumo: string | null
          revisao_em: string | null
          revisor_id: string | null
          status: string
          titulo: string
          util: number
          validade_em: string | null
          versao: number
          visualizacoes: number
        }
        Insert: {
          atualizado_em?: string
          autor_id?: string | null
          categoria?: string | null
          conteudo: string
          criado_em?: string
          id?: string
          nao_util?: number
          publicado_em?: string | null
          resumo?: string | null
          revisao_em?: string | null
          revisor_id?: string | null
          status?: string
          titulo: string
          util?: number
          validade_em?: string | null
          versao?: number
          visualizacoes?: number
        }
        Update: {
          atualizado_em?: string
          autor_id?: string | null
          categoria?: string | null
          conteudo?: string
          criado_em?: string
          id?: string
          nao_util?: number
          publicado_em?: string | null
          resumo?: string | null
          revisao_em?: string | null
          revisor_id?: string | null
          status?: string
          titulo?: string
          util?: number
          validade_em?: string | null
          versao?: number
          visualizacoes?: number
        }
        Relationships: [
          {
            foreignKeyName: "itsm_artigos_conhecimento_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_artigos_conhecimento_revisor_id_fkey"
            columns: ["revisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_ativos: {
        Row: {
          ambiente: string | null
          atualizado_em: string
          codigo_patrimonio: string | null
          criado_em: string
          dados_tecnicos: string
          data_aquisicao: string | null
          fabricante: string | null
          fim_garantia: string | null
          id: string
          localizacao: string | null
          modelo: string | null
          nome: string
          numero_serie: string | null
          responsavel_nome: string | null
          status: string
          tipo: string
          valor: number | null
        }
        Insert: {
          ambiente?: string | null
          atualizado_em?: string
          codigo_patrimonio?: string | null
          criado_em?: string
          dados_tecnicos?: string
          data_aquisicao?: string | null
          fabricante?: string | null
          fim_garantia?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          nome: string
          numero_serie?: string | null
          responsavel_nome?: string | null
          status?: string
          tipo: string
          valor?: number | null
        }
        Update: {
          ambiente?: string | null
          atualizado_em?: string
          codigo_patrimonio?: string | null
          criado_em?: string
          dados_tecnicos?: string
          data_aquisicao?: string | null
          fabricante?: string | null
          fim_garantia?: string | null
          id?: string
          localizacao?: string | null
          modelo?: string | null
          nome?: string
          numero_serie?: string | null
          responsavel_nome?: string | null
          status?: string
          tipo?: string
          valor?: number | null
        }
        Relationships: []
      }
      itsm_auditoria: {
        Row: {
          acao: string
          antes: Json | null
          criado_em: string
          depois: Json | null
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itsm_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_catalogo_avancado: {
        Row: {
          aprovacao_obrigatoria: boolean
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          formulario: Json
          id: string
          nome: string
          regras: Json
          sla_resolucao_minutos: number | null
          sla_resposta_minutos: number | null
          updated_at: string
        }
        Insert: {
          aprovacao_obrigatoria?: boolean
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          formulario?: Json
          id?: string
          nome: string
          regras?: Json
          sla_resolucao_minutos?: number | null
          sla_resposta_minutos?: number | null
          updated_at?: string
        }
        Update: {
          aprovacao_obrigatoria?: boolean
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          formulario?: Json
          id?: string
          nome?: string
          regras?: Json
          sla_resolucao_minutos?: number | null
          sla_resposta_minutos?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      itsm_governanca: {
        Row: {
          created_at: string
          descricao: string | null
          evidencias: Json
          id: string
          nome: string
          periodicidade: string | null
          proxima_revisao: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          evidencias?: Json
          id?: string
          nome: string
          periodicidade?: string | null
          proxima_revisao?: string | null
          responsavel_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          evidencias?: Json
          id?: string
          nome?: string
          periodicidade?: string | null
          proxima_revisao?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      itsm_itens_catalogo: {
        Row: {
          ativo: boolean
          atualizado_em: string
          campos_formulario: Json
          categoria_id: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          instrucoes: string | null
          nome: string
          ordem: number
          publicado: boolean
          requer_aprovacao: boolean
          segmento_id: string
          servico_id: string | null
          subcategoria_id: string | null
          tipo_chamado_id: string
          visibilidade: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          campos_formulario?: Json
          categoria_id: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          instrucoes?: string | null
          nome: string
          ordem?: number
          publicado?: boolean
          requer_aprovacao?: boolean
          segmento_id: string
          servico_id?: string | null
          subcategoria_id?: string | null
          tipo_chamado_id: string
          visibilidade?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          campos_formulario?: Json
          categoria_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          instrucoes?: string | null
          nome?: string
          ordem?: number
          publicado?: boolean
          requer_aprovacao?: boolean
          segmento_id?: string
          servico_id?: string | null
          subcategoria_id?: string | null
          tipo_chamado_id?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_itens_catalogo_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_itens_catalogo_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_itens_catalogo_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "itsm_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_itens_catalogo_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_itens_catalogo_tipo_chamado_id_fkey"
            columns: ["tipo_chamado_id"]
            isOneToOne: false
            referencedRelation: "tipos_chamado"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_mudanca_chamado: {
        Row: {
          chamado_id: string
          mudanca_id: string
        }
        Insert: {
          chamado_id: string
          mudanca_id: string
        }
        Update: {
          chamado_id?: string
          mudanca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_mudanca_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_mudanca_chamado_mudanca_id_fkey"
            columns: ["mudanca_id"]
            isOneToOne: false
            referencedRelation: "itsm_mudancas"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_mudancas: {
        Row: {
          aprovado_em: string | null
          aprovador_id: string | null
          atualizado_em: string
          criado_em: string
          descricao: string | null
          executado_em: string | null
          id: string
          impacto: string
          janela_fim: string | null
          janela_inicio: string | null
          justificativa: string | null
          numero: number
          plano_execucao: string | null
          plano_rollback: string | null
          responsavel_id: string | null
          risco: string
          solicitante_id: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          executado_em?: string | null
          id?: string
          impacto?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          justificativa?: string | null
          numero?: number
          plano_execucao?: string | null
          plano_rollback?: string | null
          responsavel_id?: string | null
          risco?: string
          solicitante_id?: string | null
          status?: string
          tipo?: string
          titulo: string
        }
        Update: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          executado_em?: string | null
          id?: string
          impacto?: string
          janela_fim?: string | null
          janela_inicio?: string | null
          justificativa?: string | null
          numero?: number
          plano_execucao?: string | null
          plano_rollback?: string | null
          responsavel_id?: string | null
          risco?: string
          solicitante_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_mudancas_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_mudancas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_mudancas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_permissoes_usuario: {
        Row: {
          atribuir: boolean
          atualizado_em: string
          criado_em: string
          criar: boolean
          editar: boolean
          excluir: boolean
          id: string
          modulo: string
          user_id: string
          visualizar: boolean
        }
        Insert: {
          atribuir?: boolean
          atualizado_em?: string
          criado_em?: string
          criar?: boolean
          editar?: boolean
          excluir?: boolean
          id?: string
          modulo: string
          user_id: string
          visualizar?: boolean
        }
        Update: {
          atribuir?: boolean
          atualizado_em?: string
          criado_em?: string
          criar?: boolean
          editar?: boolean
          excluir?: boolean
          id?: string
          modulo?: string
          user_id?: string
          visualizar?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "itsm_permissoes_usuario_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_politicas_governanca: {
        Row: {
          aprovador_id: string | null
          atualizado_em: string
          criado_em: string
          descricao: string | null
          evidencias: Json
          id: string
          nome: string
          periodicidade_revisao: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          aprovador_id?: string | null
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evidencias?: Json
          id?: string
          nome: string
          periodicidade_revisao?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          aprovador_id?: string | null
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          evidencias?: Json
          id?: string
          nome?: string
          periodicidade_revisao?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itsm_politicas_governanca_aprovador_id_fkey"
            columns: ["aprovador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_politicas_governanca_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_problema_chamado: {
        Row: {
          chamado_id: string
          problema_id: string
        }
        Insert: {
          chamado_id: string
          problema_id: string
        }
        Update: {
          chamado_id?: string
          problema_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_problema_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_problema_chamado_problema_id_fkey"
            columns: ["problema_id"]
            isOneToOne: false
            referencedRelation: "itsm_problemas"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_problemas: {
        Row: {
          atualizado_em: string
          causa_raiz: string | null
          criado_em: string
          criado_por: string | null
          data_identificacao: string
          data_resolucao: string | null
          descricao: string | null
          id: string
          impacto: string
          numero: number
          prioridade: string
          responsavel_id: string | null
          status: string
          titulo: string
          urgencia: string
          workaround: string | null
        }
        Insert: {
          atualizado_em?: string
          causa_raiz?: string | null
          criado_em?: string
          criado_por?: string | null
          data_identificacao?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          impacto?: string
          numero?: number
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          titulo: string
          urgencia?: string
          workaround?: string | null
        }
        Update: {
          atualizado_em?: string
          causa_raiz?: string | null
          criado_em?: string
          criado_por?: string | null
          data_identificacao?: string
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          impacto?: string
          numero?: number
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          titulo?: string
          urgencia?: string
          workaround?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itsm_problemas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_problemas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_relacionamentos: {
        Row: {
          criado_em: string
          criado_por: string | null
          destino_id: string
          destino_tipo: string
          id: string
          origem_id: string
          origem_tipo: string
          relacao: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          destino_id: string
          destino_tipo: string
          id?: string
          origem_id: string
          origem_tipo: string
          relacao: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          destino_id?: string
          destino_tipo?: string
          id?: string
          origem_id?: string
          origem_tipo?: string
          relacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_relacionamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_servico_chamado: {
        Row: {
          chamado_id: string
          servico_id: string
        }
        Insert: {
          chamado_id: string
          servico_id: string
        }
        Update: {
          chamado_id?: string
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_servico_chamado_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_servico_chamado_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "itsm_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      itsm_servicos: {
        Row: {
          atualizado_em: string
          criado_em: string
          criticidade: string
          descricao: string | null
          id: string
          nome: string
          proprietario_id: string | null
          sla_id: string | null
          status: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criticidade?: string
          descricao?: string | null
          id?: string
          nome: string
          proprietario_id?: string | null
          sla_id?: string | null
          status?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criticidade?: string
          descricao?: string | null
          id?: string
          nome?: string
          proprietario_id?: string | null
          sla_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "itsm_servicos_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itsm_servicos_sla_id_fkey"
            columns: ["sla_id"]
            isOneToOne: false
            referencedRelation: "slas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          chamado_id: string | null
          criado_em: string
          destinatario_id: string
          id: string
          lida: boolean
          mensagem: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
        }
        Insert: {
          chamado_id?: string | null
          criado_em?: string
          destinatario_id: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
        }
        Update: {
          chamado_id?: string | null
          criado_em?: string
          destinatario_id?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacao"]
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      perguntas_sem_resposta: {
        Row: {
          atualizado_em: string
          confianca: number | null
          contexto: string | null
          conversation_id: string | null
          criado_em: string
          id: string
          pergunta: string
          resolvida: boolean
          respondido_por: string | null
          resposta_oficial: string | null
          user_id: string | null
        }
        Insert: {
          atualizado_em?: string
          confianca?: number | null
          contexto?: string | null
          conversation_id?: string | null
          criado_em?: string
          id?: string
          pergunta: string
          resolvida?: boolean
          respondido_por?: string | null
          resposta_oficial?: string | null
          user_id?: string | null
        }
        Update: {
          atualizado_em?: string
          confianca?: number | null
          contexto?: string | null
          conversation_id?: string | null
          criado_em?: string
          id?: string
          pergunta?: string
          resolvida?: boolean
          respondido_por?: string | null
          resposta_oficial?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perguntas_sem_resposta_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perguntas_sem_resposta_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perguntas_sem_resposta_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas_satisfacao_equipe: {
        Row: {
          comentario: string | null
          criado_em: string
          id: string
          nota: number
          periodo_fim: string
          periodo_inicio: string
          usuario_id: string
        }
        Insert: {
          comentario?: string | null
          criado_em?: string
          id?: string
          nota: number
          periodo_fim: string
          periodo_inicio: string
          usuario_id: string
        }
        Update: {
          comentario?: string | null
          criado_em?: string
          id?: string
          nota?: number
          periodo_fim?: string
          periodo_inicio?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_satisfacao_equipe_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          area_id: string | null
          ativo: boolean
          atualizado_em: string
          avatar_url: string | null
          criado_em: string
          departamento: string | null
          email: string
          id: string
          nome: string
          ramal: string | null
          ultimo_acesso: string | null
        }
        Insert: {
          area_id?: string | null
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          departamento?: string | null
          email: string
          id: string
          nome: string
          ramal?: string | null
          ultimo_acesso?: string | null
        }
        Update: {
          area_id?: string | null
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          departamento?: string | null
          email?: string
          id?: string
          nome?: string
          ramal?: string | null
          ultimo_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_atribuicao_automatica: {
        Row: {
          atendente_id: string
          ativo: boolean
          atualizado_em: string
          categoria_id: string | null
          criado_em: string
          grupo_atendimento_id: string
          id: string
          nome: string
          prioridade: number
          subcategoria_id: string | null
          tipo_chamado_id: string | null
        }
        Insert: {
          atendente_id: string
          ativo?: boolean
          atualizado_em?: string
          categoria_id?: string | null
          criado_em?: string
          grupo_atendimento_id: string
          id?: string
          nome: string
          prioridade?: number
          subcategoria_id?: string | null
          tipo_chamado_id?: string | null
        }
        Update: {
          atendente_id?: string
          ativo?: boolean
          atualizado_em?: string
          categoria_id?: string | null
          criado_em?: string
          grupo_atendimento_id?: string
          id?: string
          nome?: string
          prioridade?: number
          subcategoria_id?: string | null
          tipo_chamado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regras_atribuicao_automatica_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_atribuicao_automatica_grupo_atendimento_id_fkey"
            columns: ["grupo_atendimento_id"]
            isOneToOne: false
            referencedRelation: "grupos_atendimento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_atribuicao_automatica_subcategoria_id_fkey"
            columns: ["subcategoria_id"]
            isOneToOne: false
            referencedRelation: "subcategorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regras_atribuicao_automatica_tipo_chamado_id_fkey"
            columns: ["tipo_chamado_id"]
            isOneToOne: false
            referencedRelation: "tipos_chamado"
            referencedColumns: ["id"]
          },
        ]
      }
      segmentos: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      sla_calendario_horarios: {
        Row: {
          ativo: boolean
          calendario_id: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
        }
        Insert: {
          ativo?: boolean
          calendario_id: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
        }
        Update: {
          ativo?: boolean
          calendario_id?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_calendario_horarios_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "sla_calendarios"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_calendarios: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          timezone: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          timezone?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          timezone?: string
        }
        Relationships: []
      }
      sla_eventos: {
        Row: {
          chamado_id: string
          criado_em: string
          duracao_segundos: number | null
          encerrado_em: string | null
          id: string
          iniciado_em: string
          motivo: string | null
          sla_regra_id: string | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          chamado_id: string
          criado_em?: string
          duracao_segundos?: number | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          motivo?: string | null
          sla_regra_id?: string | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          chamado_id?: string
          criado_em?: string
          duracao_segundos?: number | null
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          motivo?: string | null
          sla_regra_id?: string | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_eventos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_eventos_sla_regra_id_fkey"
            columns: ["sla_regra_id"]
            isOneToOne: false
            referencedRelation: "sla_regras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_regras: {
        Row: {
          ativo: boolean
          atualizado_em: string
          calendario_id: string | null
          catalogo_item_id: string | null
          categoria_id: string | null
          criado_em: string
          id: string
          impacto: string | null
          nome: string
          pausa_aguardando_aprovacao: boolean
          pausa_aguardando_terceiro: boolean
          pausa_aguardando_usuario: boolean
          prioridade: Database["public"]["Enums"]["prioridade_chamado"] | null
          segmento_id: string | null
          tempo_resolucao_segundos: number | null
          tempo_resposta_segundos: number | null
          tipo_fluxo: string
          urgencia: string | null
          usa_sla_resolucao: boolean
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          calendario_id?: string | null
          catalogo_item_id?: string | null
          categoria_id?: string | null
          criado_em?: string
          id?: string
          impacto?: string | null
          nome: string
          pausa_aguardando_aprovacao?: boolean
          pausa_aguardando_terceiro?: boolean
          pausa_aguardando_usuario?: boolean
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"] | null
          segmento_id?: string | null
          tempo_resolucao_segundos?: number | null
          tempo_resposta_segundos?: number | null
          tipo_fluxo: string
          urgencia?: string | null
          usa_sla_resolucao?: boolean
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          calendario_id?: string | null
          catalogo_item_id?: string | null
          categoria_id?: string | null
          criado_em?: string
          id?: string
          impacto?: string | null
          nome?: string
          pausa_aguardando_aprovacao?: boolean
          pausa_aguardando_terceiro?: boolean
          pausa_aguardando_usuario?: boolean
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"] | null
          segmento_id?: string | null
          tempo_resolucao_segundos?: number | null
          tempo_resposta_segundos?: number | null
          tipo_fluxo?: string
          urgencia?: string | null
          usa_sla_resolucao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sla_regras_calendario_id_fkey"
            columns: ["calendario_id"]
            isOneToOne: false
            referencedRelation: "sla_calendarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_regras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_regras_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      slas: {
        Row: {
          criado_em: string
          horario_comercial: boolean
          id: string
          nome: string
          prioridade: Database["public"]["Enums"]["prioridade_chamado"]
          tempo_resolucao_h: number
          tempo_resposta_h: number
        }
        Insert: {
          criado_em?: string
          horario_comercial?: boolean
          id?: string
          nome: string
          prioridade: Database["public"]["Enums"]["prioridade_chamado"]
          tempo_resolucao_h: number
          tempo_resposta_h: number
        }
        Update: {
          criado_em?: string
          horario_comercial?: boolean
          id?: string
          nome?: string
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          tempo_resolucao_h?: number
          tempo_resposta_h?: number
        }
        Relationships: []
      }
      subcategorias: {
        Row: {
          ativo: boolean
          categoria_id: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategorias_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_chamado: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      itsm_governanca_resumo: {
        Row: {
          artigos_publicados: number | null
          ativos_ativos: number | null
          chamados_abertos: number | null
          eventos_auditoria: number | null
          mudancas_pendentes: number | null
          politicas_vigentes: number | null
          problemas_abertos: number | null
          relacionamentos: number | null
          servicos_ativos: number | null
          total_chamados: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      avaliar_artigo_base_conhecimento: {
        Args: { p_artigo_id: string; p_util: boolean }
        Returns: undefined
      }
      avaliar_chamado: {
        Args: { _chamado_id: string; _comentario?: string; _nota: number }
        Returns: Json
      }
      buscar_artigos_semanticos: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          conteudo: string
          id: string
          similarity: number
          titulo: string
        }[]
      }
      dashboard_escopo_gestor: {
        Args: { _gestor_id: string; _solicitante_id: string }
        Returns: boolean
      }
      executar_escalonamento_sla_n1_n2: { Args: never; Returns: number }
      gestor_mesma_area: {
        Args: { _colaborador_id: string; _gestor_id: string }
        Returns: boolean
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      incrementar_visualizacao_base_conhecimento: {
        Args: { p_artigo_id: string }
        Returns: undefined
      }
      itsm_e_gestor_ou_admin: { Args: never; Returns: boolean }
      itsm_tem_papel: { Args: { papeis: string[] }; Returns: boolean }
      itsm_tem_permissao: {
        Args: { p_acao: string; p_modulo: string }
        Returns: boolean
      }
      match_conhecimento: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          conteudo: string
          origem: string
          ref_id: string
          similarity: number
          titulo: string
        }[]
      }
      obter_feedback_artigo_base_conhecimento: {
        Args: { p_artigo_id: string }
        Returns: Json
      }
      obter_satisfacao_artigo_base_conhecimento: {
        Args: { p_artigo_id: string }
        Returns: {
          nao_util: number
          util: number
        }[]
      }
      obter_satisfacao_artigos_base_conhecimento: {
        Args: { p_artigo_ids: string[] }
        Returns: {
          artigo_id: string
          nao_util: number
          util: number
        }[]
      }
      processar_escalonamentos_sla: {
        Args: never
        Returns: {
          chamado_id: string
          executado_em: string
          motivo: string
          nivel: number
          regra_id: string
        }[]
      }
      proximo_numero_fila: { Args: { p_grupo_id: string }; Returns: number }
      registrar_evento_sla: {
        Args: {
          p_chamado_id: string
          p_motivo?: string
          p_sla_regra_id: string
          p_tipo: string
          p_usuario_id?: string
        }
        Returns: string
      }
      selecionar_regra_sla: {
        Args: {
          p_categoria_id?: string
          p_impacto?: string
          p_prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          p_segmento_id?: string
          p_tipo_fluxo: string
          p_urgencia?: string
        }
        Returns: {
          calendario_id: string
          id: string
          nome: string
          pausa_aguardando_aprovacao: boolean
          pausa_aguardando_terceiro: boolean
          pausa_aguardando_usuario: boolean
          tempo_resolucao_segundos: number
          tempo_resposta_segundos: number
          tipo_fluxo: string
          usa_sla_resolucao: boolean
        }[]
      }
      sla_calcular_prazo_util: {
        Args: { p_calendario_id: string; p_inicio: string; p_segundos: number }
        Returns: string
      }
      slugify_conhecimento: { Args: { p_text: string }; Returns: string }
      status_sla_resolucao: {
        Args: { p_pausado: boolean; p_prazo: string; p_restante: number }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "colaborador" | "atendente" | "gestor" | "admin"
      prioridade_chamado: "baixa" | "media" | "alta" | "critica"
      status_chamado:
        | "aberto"
        | "em_triagem"
        | "em_andamento"
        | "aguardando_usuario"
        | "aguardando_terceiro"
        | "resolvido"
        | "fechado"
        | "cancelado"
        | "reaberto"
      tipo_notificacao:
        | "chamado_aberto"
        | "chamado_atribuido"
        | "comentario_adicionado"
        | "status_alterado"
        | "sla_proximo"
        | "sla_vencido"
        | "chamado_resolvido"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["colaborador", "atendente", "gestor", "admin"],
      prioridade_chamado: ["baixa", "media", "alta", "critica"],
      status_chamado: [
        "aberto",
        "em_triagem",
        "em_andamento",
        "aguardando_usuario",
        "aguardando_terceiro",
        "resolvido",
        "fechado",
        "cancelado",
        "reaberto",
      ],
      tipo_notificacao: [
        "chamado_aberto",
        "chamado_atribuido",
        "comentario_adicionado",
        "status_alterado",
        "sla_proximo",
        "sla_vencido",
        "chamado_resolvido",
      ],
    },
  },
} as const
