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
          status: "ativo" | "banido"
          ativo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          nome: string
          telefone: string
          senha: string
          tipo?: "cliente" | "motorista" | "admin"
          status?: "ativo" | "banido"
          ativo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string
          telefone?: string
          senha?: string
          tipo?: "cliente" | "motorista" | "admin"
          status?: "ativo" | "banido"
          ativo?: boolean
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
          status: "nova" | "aguardando_motorista" | "aceita" | "em_analise" | "aprovada" | "nao_realizada" | "recusada"
          aprovado_admin: boolean
          valor: number | null
          observacao_motorista: string | null
          origem_editada: string | null
          destino_editado: string | null
          edicao_pendente: boolean
          edicao_aprovada: boolean | null
          concluida_at: string | null
          canal_origem: "whatsapp" | "app"
          origem_audio_url: string | null
          observacoes: string | null
          confianca_ia: number | null
          whatsapp_message_id: string | null
          distancia_km: number | null
          valor_estimado: number | null
          created_at: string
        }
        Insert: {
          id?: string
          cliente_id: string
          motorista_id?: string | null
          origem_texto: string
          destino_texto: string
          horario_estimado?: string | null
          status?: "nova" | "aguardando_motorista" | "aceita" | "em_analise" | "aprovada" | "nao_realizada" | "recusada"
          aprovado_admin?: boolean
          valor?: number | null
          observacao_motorista?: string | null
          origem_editada?: string | null
          destino_editado?: string | null
          edicao_pendente?: boolean
          edicao_aprovada?: boolean | null
          concluida_at?: string | null
          canal_origem?: "whatsapp" | "app"
          origem_audio_url?: string | null
          observacoes?: string | null
          confianca_ia?: number | null
          whatsapp_message_id?: string | null
          distancia_km?: number | null
          valor_estimado?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          cliente_id?: string
          motorista_id?: string | null
          origem_texto?: string
          destino_texto?: string
          horario_estimado?: string | null
          status?: "nova" | "aguardando_motorista" | "aceita" | "em_analise" | "aprovada" | "nao_realizada" | "recusada"
          aprovado_admin?: boolean
          valor?: number | null
          observacao_motorista?: string | null
          origem_editada?: string | null
          destino_editado?: string | null
          edicao_pendente?: boolean
          edicao_aprovada?: boolean | null
          concluida_at?: string | null
          canal_origem?: "whatsapp" | "app"
          origem_audio_url?: string | null
          observacoes?: string | null
          confianca_ia?: number | null
          whatsapp_message_id?: string | null
          distancia_km?: number | null
          valor_estimado?: number | null
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
