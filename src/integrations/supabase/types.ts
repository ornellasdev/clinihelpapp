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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          created_at: string
          criado_por: string | null
          especialidade_id: string
          fim: string
          id: string
          inicio: string
          observacoes: string | null
          paciente_id: string
          profissional_id: string
          sala_id: string
          status: Database["public"]["Enums"]["agendamento_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          especialidade_id: string
          fim: string
          id?: string
          inicio: string
          observacoes?: string | null
          paciente_id: string
          profissional_id: string
          sala_id: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          especialidade_id?: string
          fim?: string
          id?: string
          inicio?: string
          observacoes?: string | null
          paciente_id?: string
          profissional_id?: string
          sala_id?: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_sala_id_fkey"
            columns: ["sala_id"]
            isOneToOne: false
            referencedRelation: "salas"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_financeiro: {
        Row: {
          agendamento_id: string
          observacoes: string | null
          pagamento_status: string
          percentual_repasse: number
          repasse_pago: boolean
          updated_at: string
          valor: number
          valor_repasse: number | null
        }
        Insert: {
          agendamento_id: string
          observacoes?: string | null
          pagamento_status?: string
          percentual_repasse?: number
          repasse_pago?: boolean
          updated_at?: string
          valor?: number
          valor_repasse?: number | null
        }
        Update: {
          agendamento_id?: string
          observacoes?: string | null
          pagamento_status?: string
          percentual_repasse?: number
          repasse_pago?: boolean
          updated_at?: string
          valor?: number
          valor_repasse?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_financeiro_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      evolucoes: {
        Row: {
          agendamento_id: string | null
          conteudo: string
          created_at: string
          data_atendimento: string
          especialidade_id: string
          id: string
          paciente_id: string
          profissional_id: string
          profissional_nome: string | null
          profissional_registro: string | null
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          conteudo: string
          created_at?: string
          data_atendimento?: string
          especialidade_id: string
          id?: string
          paciente_id: string
          profissional_id?: string
          profissional_nome?: string | null
          profissional_registro?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          conteudo?: string
          created_at?: string
          data_atendimento?: string
          especialidade_id?: string
          id?: string
          paciente_id?: string
          profissional_id?: string
          profissional_nome?: string | null
          profissional_registro?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      paciente_documentos: {
        Row: {
          categoria: string
          created_at: string
          enviado_por: string
          id: string
          mime_type: string | null
          nome: string
          paciente_id: string
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          categoria?: string
          created_at?: string
          enviado_por?: string
          id?: string
          mime_type?: string | null
          nome: string
          paciente_id: string
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string
          enviado_por?: string
          id?: string
          mime_type?: string | null
          nome?: string
          paciente_id?: string
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "paciente_documentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          alergias: string | null
          ativo: boolean
          carteirinha: string | null
          cep: string | null
          cid: string | null
          cidade: string | null
          complemento: string | null
          convenio: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          diagnostico: string | null
          endereco: string | null
          escola: string | null
          estado: string | null
          id: string
          medicamentos: string | null
          nome: string
          numero: string | null
          observacoes: string | null
          pais: string | null
          responsavel_cpf: string | null
          responsavel_email: string | null
          responsavel_financeiro_cpf: string | null
          responsavel_financeiro_email: string | null
          responsavel_financeiro_nome: string | null
          responsavel_financeiro_telefone: string | null
          responsavel_nome: string | null
          responsavel_parentesco: string | null
          responsavel_telefone: string | null
          responsavel2_cpf: string | null
          responsavel2_email: string | null
          responsavel2_nome: string | null
          responsavel2_telefone: string | null
          sexo: string | null
          updated_at: string
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          carteirinha?: string | null
          cep?: string | null
          cid?: string | null
          cidade?: string | null
          complemento?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          diagnostico?: string | null
          endereco?: string | null
          escola?: string | null
          estado?: string | null
          id?: string
          medicamentos?: string | null
          nome: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_financeiro_cpf?: string | null
          responsavel_financeiro_email?: string | null
          responsavel_financeiro_nome?: string | null
          responsavel_financeiro_telefone?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          responsavel2_cpf?: string | null
          responsavel2_email?: string | null
          responsavel2_nome?: string | null
          responsavel2_telefone?: string | null
          sexo?: string | null
          updated_at?: string
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          carteirinha?: string | null
          cep?: string | null
          cid?: string | null
          cidade?: string | null
          complemento?: string | null
          convenio?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          diagnostico?: string | null
          endereco?: string | null
          escola?: string | null
          estado?: string | null
          id?: string
          medicamentos?: string | null
          nome?: string
          numero?: string | null
          observacoes?: string | null
          pais?: string | null
          responsavel_cpf?: string | null
          responsavel_email?: string | null
          responsavel_financeiro_cpf?: string | null
          responsavel_financeiro_email?: string | null
          responsavel_financeiro_nome?: string | null
          responsavel_financeiro_telefone?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          responsavel2_cpf?: string | null
          responsavel2_email?: string | null
          responsavel2_nome?: string | null
          responsavel2_telefone?: string | null
          sexo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          conselho: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          registro_profissional: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conselho?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string
          registro_profissional?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conselho?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          registro_profissional?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profissional_config: {
        Row: {
          percentual_repasse_padrao: number
          updated_at: string
          user_id: string
          valor_sessao_padrao: number
        }
        Insert: {
          percentual_repasse_padrao?: number
          updated_at?: string
          user_id: string
          valor_sessao_padrao?: number
        }
        Update: {
          percentual_repasse_padrao?: number
          updated_at?: string
          user_id?: string
          valor_sessao_padrao?: number
        }
        Relationships: [
          {
            foreignKeyName: "profissional_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_especialidades: {
        Row: {
          especialidade_id: string
          user_id: string
        }
        Insert: {
          especialidade_id: string
          user_id: string
        }
        Update: {
          especialidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_especialidades_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_especialidades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          ativa: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_especialidade: {
        Args: { _esp: string; _user_id: string }
        Returns: boolean
      }
      has_especialidade: {
        Args: { _esp: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_gestor: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      master_exists: { Args: never; Returns: boolean }
    }
    Enums: {
      agendamento_status:
        | "agendado"
        | "confirmado"
        | "realizado"
        | "falta"
        | "cancelado"
      app_role:
        | "master"
        | "recepcao"
        | "profissional"
        | "financeiro"
        | "administrador"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agendamento_status: [
        "agendado",
        "confirmado",
        "realizado",
        "falta",
        "cancelado",
      ],
      app_role: [
        "master",
        "recepcao",
        "profissional",
        "financeiro",
        "administrador",
      ],
    },
  },
} as const
