export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          nome: string
          telefone: string
          senha: string
          tipo: "cliente" | "motorista" | "admin"
          roles: string[]
          status: "ativo" | "banido"
          ativo: boolean
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_cor: string | null
          veiculo_placa: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          telefone: string
          senha: string
          tipo?: "cliente" | "motorista" | "admin"
          roles?: string[]
          status?: "ativo" | "banido"
          ativo?: boolean
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_cor?: string | null
          veiculo_placa?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          telefone?: string
          senha?: string
          tipo?: "cliente" | "motorista" | "admin"
          roles?: string[]
          status?: "ativo" | "banido"
          ativo?: boolean
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_cor?: string | null
          veiculo_placa?: string | null
          created_at?: string
        }
        Relationships: []
      }
      corridas: {
        Row: {
          id: string
          cliente_id: string
          motorista_id: string | null
          origem_texto: string
          destino_texto: string
          horario_estimado: string | null
          status: "em_analise" | "aprovada" | "nao_realizada"
          aprovado_admin: boolean
          valor: number | null
          observacao_motorista: string | null
          origem_editada: string | null
          destino_editado: string | null
          edicao_pendente: boolean
          edicao_aprovada: boolean | null
          concluida_at: string | null
          origem_audio_url: string | null
          observacoes: string | null
          confianca_ia: number | null
          whatsapp_message_id: string | null
          distancia_km: number | null
          valor_estimado: number | null
          preco_regra_aplicada: string | null
          preco_detalhes: Record<string, unknown> | null
          tem_bagagem: boolean | null
          tracking_ativo: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          motorista_id?: string | null
          origem_texto: string
          destino_texto: string
          horario_estimado?: string | null
          status?: "em_analise" | "aprovada" | "nao_realizada"
          aprovado_admin?: boolean
          valor?: number | null
          observacao_motorista?: string | null
          origem_editada?: string | null
          destino_editado?: string | null
          edicao_pendente?: boolean
          edicao_aprovada?: boolean | null
          concluida_at?: string | null
          origem_audio_url?: string | null
          observacoes?: string | null
          confianca_ia?: number | null
          whatsapp_message_id?: string | null
          distancia_km?: number | null
          valor_estimado?: number | null
          preco_regra_aplicada?: string | null
          preco_detalhes?: Record<string, unknown> | null
          tem_bagagem?: boolean | null
          tracking_ativo?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          motoristata?: string | null
          origem_texto?: string
          destino_texto?: string
          horario_estimado?: string | null
          status?: "em_analise" | "aprovada" | "nao_realizada"
          aprovado_admin?: boolean
          valor?: number | null
          observacao_motorista?: string | null
          origem_editada?: string | null
          destino_editado?: string | null
          edicao_pendente?: boolean
          edicao_aprovada?: boolean | null
          concluida_at?: string | null
          origem_audio_url?: string | null
          observacoes?: string | null
          confianca_ia?: number | null
          whatsapp_message_id?: string | null
          distancia_km?: number | null
          valor_estimado?: number | null
          preco_regra_aplicada?: string | null
          preco_detalhes?: Record<string, unknown> | null
          tem_bagagem?: boolean | null
          tracking_ativo?: boolean | null
          created_at?: string
        }
        Relationships: []
      }
      aprovacoes: {
        Row: {
          id: string
          solicitacao_id: string
          admin_id: string
          status_admin: "aprovada" | "nao_realizada" | "recusada"
          observacao: string
          created_at: string
        }
        Insert: {
          id?: string
          solicitacao_id: string
          admin_id: string
          status_admin: "aprovada" | "nao_realizada" | "recusada"
          observacao: string
          created_at?: string
        }
        Update: {
          id?: string
          solicitacao_id?: string
          admin_id?: string
          status_admin?: "aprovada" | "nao_realizada" | "recusada"
          observacao?: string
          created_at?: string
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          id: string
          corrida_id: string
          cliente_id: string
          motorista_id: string
          nota: number
          comentario: string | null
          created_at: string
        }
        Insert: {
          id?: string
          corrida_id: string
          cliente_id: string
          motorista_id: string
          nota: number
          comentario?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          corrida_id?: string
          cliente_id?: string
          motorista_id?: string
          nota?: number
          comentario?: string | null
          created_at?: string
        }
        Relationships: []
      }
      app_releases: {
        Row: {
          id: string
          created_at: string
          published_at: string
          uploaded_by: string | null
          version_name: string
          file_name: string
          storage_path: string
          public_url: string
          mime_type: string | null
          size_bytes: number | null
          is_current: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          published_at?: string
          uploaded_by?: string | null
          version_name: string
          file_name: string
          storage_path: string
          public_url: string
          mime_type?: string | null
          size_bytes?: number | null
          is_current?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          published_at?: string
          uploaded_by?: string | null
          version_name?: string
          file_name?: string
          storage_path?: string
          public_url?: string
          mime_type?: string | null
          size_bytes?: number | null
          is_current?: boolean
        }
        Relationships: []
      }
      localidades: {
        Row: {
          id: string
          nome: string
          tipo: "bairro" | "local" | "rua" | "ponto" | "cidade" | "zona"
          parent_id: string | null
          latitude: number | null
          longitude: number | null
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          tipo?: "bairro" | "local" | "rua" | "ponto" | "cidade" | "zona"
          parent_id?: string | null
          latitude?: number | null
          longitude?: number | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          tipo?: "bairro" | "local" | "rua" | "ponto" | "cidade" | "zona"
          parent_id?: string | null
          latitude?: number | null
          longitude?: number | null
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      precos_rotas: {
        Row: {
          id: string
          origem_id: string
          destino_id: string
          preco_fixo: number | null
          preco_minimo: number | null
          prioridade: number
          ativo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          origem_id: string
          destino_id: string
          preco_fixo?: number | null
          preco_minimo?: number | null
          prioridade?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          origem_id?: string
          destino_id?: string
          preco_fixo?: number | null
          preco_minimo?: number | null
          prioridade?: number
          ativo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      regras_horario: {
        Row: {
          id: string
          nome: string
          hora_inicio: string
          hora_fim: string
          tipo_ajuste: "percentual" | "fixo"
          valor_ajuste: number
          ativo: boolean
          data_inicio: string | null
          data_fim: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          hora_inicio: string
          hora_fim: string
          tipo_ajuste?: "percentual" | "fixo"
          valor_ajuste?: number
          ativo?: boolean
          data_inicio?: string | null
          data_fim?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          hora_inicio?: string
          hora_fim?: string
          tipo_ajuste?: "percentual" | "fixo"
          valor_ajuste?: number
          ativo?: boolean
          data_inicio?: string | null
          data_fim?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      historico_precos: {
        Row: {
          id: string
          corrida_id: string | null
          origem_localidade_id: string | null
          destino_localidade_id: string | null
          preco_rota_id: string | null
          regra_horario_id: string | null
          preco_base: number | null
          ajuste_aplicado: string | null
          preco_final: number
          origem_regra: string | null
          detalhes: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          corrida_id?: string | null
          origem_localidade_id?: string | null
          destino_localidade_id?: string | null
          preco_rota_id?: string | null
          regra_horario_id?: string | null
          preco_base?: number | null
          ajuste_aplicado?: string | null
          preco_final: number
          origem_regra?: string | null
          detalhes?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          corrida_id?: string | null
          origem_localidade_id?: string | null
          destino_localidade_id?: string | null
          preco_rota_id?: string | null
          regra_horario_id?: string | null
          preco_base?: number | null
          ajuste_aplicado?: string | null
          preco_final?: number
          origem_regra?: string | null
          detalhes?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
      tabela_precos: {
        Row: {
          id: string
          origem: string
          destino: string
          valor: number
          regiao: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          origem: string
          destino: string
          valor: number
          regiao?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          origem?: string
          destino?: string
          valor?: number
          regiao?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      localizacao_motorista: {
        Row: {
          motorista_id: string
          latitude: number
          longitude: number
          atualizado_em: string
        }
        Insert: {
          motorista_id: string
          latitude: number
          longitude: number
          atualizado_em?: string
        }
        Update: {
          motorista_id?: string
          latitude?: number
          longitude?: number
          atualizado_em?: string
        }
        Relationships: []
      }
      ofertas_corrida: {
        Row: {
          id: string
          corrida_id: string
          motorista_id: string
          status: "enviada" | "aceita" | "recusada" | "expirada" | "cancelada"
          rodada_disparo: number
          score_ranking: number | null
          distancia_km: number | null
          enviado_em: string
          respondido_em: string | null
          tempo_resposta_segundos: number | null
          motivo_rodada: string | null
          created_at: string
        }
        Insert: {
          id?: string
          corrida_id: string
          motorista_id: string
          status?: "enviada" | "aceita" | "recusada" | "expirada" | "cancelada"
          rodada_disparo?: number
          score_ranking?: number | null
          distancia_km?: number | null
          enviado_em?: string
          respondido_em?: string | null
          tempo_resposta_segundos?: number | null
          motivo_rodada?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          corrida_id?: string
          motorista_id?: string
          status?: "enviada" | "aceita" | "recusada" | "expirada" | "cancelada"
          rodada_disparo?: number
          score_ranking?: number | null
          distancia_km?: number | null
          enviado_em?: string
          respondido_em?: string | null
          tempo_resposta_segundos?: number | null
          motivo_rodada?: string | null
          created_at?: string
        }
        Relationships: []
      }
      metricas_motorista: {
        Row: {
          id: string
          motorista_id: string
          media_tempo_aceite: number
          total_corridas_aceitas: number
          total_corridas_recusadas: number
          total_corridas_expiradas: number
          taxa_aceite: number
          atualizado_em: string
        }
        Insert: {
          id?: string
          motorista_id: string
          media_tempo_aceite?: number
          total_corridas_aceitas?: number
          total_corridas_recusadas?: number
          total_corridas_expiradas?: number
          taxa_aceite?: number
          atualizado_em?: string
        }
        Update: {
          id?: string
          motorista_id?: string
          media_tempo_aceite?: number
          total_corridas_aceitas?: number
          total_corridas_recusadas?: number
          total_corridas_expiradas?: number
          taxa_aceite?: number
          atualizado_em?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
