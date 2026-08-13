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
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados: {
        Row: {
          aberto_em: string
          atendente_id: string | null
          atualizado_em: string
          avaliacao_comentario: string | null
          avaliacao_nota: number | null
          categoria_id: string | null
          criado_em: string
          descricao: string
          embedding: string | null
          fechado_em: string | null
          id: string
          numero: string
          prazo_resolucao: string | null
          prazo_resposta: string | null
          prioridade: Database["public"]["Enums"]["prioridade_chamado"]
          resolvido_em: string | null
          respondido_em: string | null
          sla_id: string | null
          sla_resolucao_violado: boolean
          sla_pausado: boolean
          sla_pausado_em: string | null
          sla_tempo_restante_segundos: number | null
          sla_resposta_violado: boolean
          solicitante_id: string
          status: Database["public"]["Enums"]["status_chamado"]
          subcategoria_id: string | null
          tags: string[] | null
          titulo: string
        }
        Insert: {
          aberto_em?: string
          atendente_id?: string | null
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          categoria_id?: string | null
          criado_em?: string
          descricao: string
          embedding?: string | null
          fechado_em?: string | null
          id?: string
          numero: string
          prazo_resolucao?: string | null
          prazo_resposta?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          resolvido_em?: string | null
          respondido_em?: string | null
          sla_id?: string | null
          sla_resolucao_violado?: boolean
          sla_pausado?: boolean
          sla_pausado_em?: string | null
          sla_tempo_restante_segundos?: number | null
          sla_resposta_violado?: boolean
          solicitante_id: string
          status?: Database["public"]["Enums"]["status_chamado"]
          subcategoria_id?: string | null
          tags?: string[] | null
          titulo: string
        }
        Update: {
          aberto_em?: string
          atendente_id?: string | null
          atualizado_em?: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          categoria_id?: string | null
          criado_em?: string
          descricao?: string
          embedding?: string | null
          fechado_em?: string | null
          id?: string
          numero?: string
          prazo_resolucao?: string | null
          prazo_resposta?: string | null
          prioridade?: Database["public"]["Enums"]["prioridade_chamado"]
          resolvido_em?: string | null
          respondido_em?: string | null
          sla_id?: string | null
          sla_resolucao_violado?: boolean
          sla_pausado?: boolean
          sla_pausado_em?: string | null
          sla_tempo_restante_segundos?: number | null
          sla_resposta_violado?: boolean
          solicitante_id?: string
          status?: Database["public"]["Enums"]["status_chamado"]
          subcategoria_id?: string | null
          tags?: string[] | null
          titulo?: string
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
            foreignKeyName: "chamados_sla_id_fkey"
            columns: ["sla_id"]
            isOneToOne: false
            referencedRelation: "slas"
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
      profiles: {
        Row: {
          ativo: boolean
          atualizado_em: string
          avatar_url: string | null
          criado_em: string
          departamento: string | null
          area_id: string | null
          email: string
          id: string
          nome: string
          ramal: string | null
          ultimo_acesso: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          departamento?: string | null
          area_id?: string | null
          email: string
          id: string
          nome: string
          ramal?: string | null
          ultimo_acesso?: string | null
        }
        Update: {
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
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      buscar_artigos_semanticos: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          conteudo: string
          id: string
          similarity: number
          titulo: string
        }[]
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
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "colaborador" | "atendente" | "gestor" | "admin"
      prioridade_chamado: "baixa" | "media" | "alta" | "critica"
      status_chamado:
        | "aberto"
        | "em_andamento"
        | "aguardando_usuario"
        | "aguardando_terceiro"
        | "resolvido"
        | "fechado"
        | "cancelado"
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
        "em_andamento",
        "aguardando_usuario",
        "aguardando_terceiro",
        "resolvido",
        "fechado",
        "cancelado",
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
