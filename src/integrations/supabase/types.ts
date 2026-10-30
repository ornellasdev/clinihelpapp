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
          clinica_id: string
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
          clinica_id?: string
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
          clinica_id?: string
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
            foreignKeyName: "agendamentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
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
          clinica_id?: string
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
          clinica_id?: string
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
          {
            foreignKeyName: "atendimento_financeiro_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          acao: string
          antes: Json | null
          campos: string[] | null
          clinica_id: string | null
          created_at: string
          depois: Json | null
          descricao: string | null
          id: number
          registro_id: string | null
          tabela: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          campos?: string[] | null
          clinica_id?: string | null
          created_at?: string
          depois?: Json | null
          descricao?: string | null
          id?: never
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          campos?: string[] | null
          clinica_id?: string | null
          created_at?: string
          depois?: Json | null
          descricao?: string | null
          id?: never
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          pagamentos_ativos: boolean
          slug: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
          pagamentos_ativos?: boolean
          slug: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          pagamentos_ativos?: boolean
          slug?: string
        }
        Relationships: []
      }
      cobranca_itens: {
        Row: {
          agendamento_id: string
          clinica_id: string
          cobranca_id: string
        }
        Insert: {
          agendamento_id: string
          clinica_id?: string
          cobranca_id: string
        }
        Update: {
          agendamento_id?: string
          clinica_id?: string
          cobranca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_itens_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_itens_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          asaas_cliente_id: string
          asaas_cobranca_id: string
          clinica_id: string
          created_at: string
          criado_por: string | null
          descricao: string
          forma: string
          id: string
          paciente_id: string
          pagador_cpf: string
          pagador_email: string | null
          pagador_nome: string
          pagador_telefone: string | null
          pago_em: string | null
          status: string
          tipo: string
          token_publico: string
          updated_at: string
          valor: number
          valor_pago: number | null
          vencimento: string
        }
        Insert: {
          asaas_cliente_id: string
          asaas_cobranca_id: string
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          descricao: string
          forma: string
          id?: string
          paciente_id: string
          pagador_cpf: string
          pagador_email?: string | null
          pagador_nome: string
          pagador_telefone?: string | null
          pago_em?: string | null
          status?: string
          tipo: string
          token_publico: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
          vencimento: string
        }
        Update: {
          asaas_cliente_id?: string
          asaas_cobranca_id?: string
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string
          forma?: string
          id?: string
          paciente_id?: string
          pagador_cpf?: string
          pagador_email?: string | null
          pagador_nome?: string
          pagador_telefone?: string | null
          pago_em?: string | null
          status?: string
          tipo?: string
          token_publico?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_valores: {
        Row: {
          clinica_id: string
          convenio_id: string
          updated_at: string
          valor_sessao: number
        }
        Insert: {
          clinica_id?: string
          convenio_id: string
          updated_at?: string
          valor_sessao?: number
        }
        Update: {
          clinica_id?: string
          convenio_id?: string
          updated_at?: string
          valor_sessao?: number
        }
        Relationships: [
          {
            foreignKeyName: "convenio_valores_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_valores_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: true
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenios_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      desenvolvedores: {
        Row: {
          clinica_ativa: string | null
          created_at: string
          email: string
        }
        Insert: {
          clinica_ativa?: string | null
          created_at?: string
          email: string
        }
        Update: {
          clinica_ativa?: string | null
          created_at?: string
          email?: string
        }
        Relationships: [
          {
            foreignKeyName: "desenvolvedores_clinica_ativa_fkey"
            columns: ["clinica_ativa"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      especialidades: {
        Row: {
          clinica_id: string
          cor: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          clinica_id?: string
          cor?: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          clinica_id?: string
          cor?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialidades_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucao_metas: {
        Row: {
          clinica_id: string
          created_at: string
          especialidade_id: string
          evolucao_id: string
          id: string
          meta_id: string
          nivel: number
          paciente_id: string
          updated_at: string
        }
        Insert: {
          clinica_id?: string
          created_at?: string
          especialidade_id: string
          evolucao_id: string
          id?: string
          meta_id: string
          nivel: number
          paciente_id: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          especialidade_id?: string
          evolucao_id?: string
          id?: string
          meta_id?: string
          nivel?: number
          paciente_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucao_metas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_metas_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_metas_evolucao_id_fkey"
            columns: ["evolucao_id"]
            isOneToOne: false
            referencedRelation: "evolucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_metas_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "plano_metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_metas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      evolucoes: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
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
          clinica_id?: string
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
          clinica_id?: string
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
            foreignKeyName: "evolucoes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
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
      fatura_liminar_itens: {
        Row: {
          agendamento_id: string
          clinica_id: string
          fatura_id: string
        }
        Insert: {
          agendamento_id: string
          clinica_id?: string
          fatura_id: string
        }
        Update: {
          agendamento_id?: string
          clinica_id?: string
          fatura_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatura_liminar_itens_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_liminar_itens_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_liminar_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas_liminar"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_liminar: {
        Row: {
          clinica_id: string
          competencia: string
          convenio_id: string
          created_at: string
          criado_por: string | null
          id: string
          nf_emissao: string | null
          nf_numero: string | null
          observacoes: string | null
          paciente_id: string
          pago_em: string | null
          quantidade_sessoes: number
          status: string
          updated_at: string
          valor: number
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          clinica_id?: string
          competencia: string
          convenio_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          nf_emissao?: string | null
          nf_numero?: string | null
          observacoes?: string | null
          paciente_id: string
          pago_em?: string | null
          quantidade_sessoes?: number
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          clinica_id?: string
          competencia?: string
          convenio_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          nf_emissao?: string | null
          nf_numero?: string | null
          observacoes?: string | null
          paciente_id?: string
          pago_em?: string | null
          quantidade_sessoes?: number
          status?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "faturas_liminar_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_liminar_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_liminar_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      glosas: {
        Row: {
          agendamento_id: string | null
          clinica_id: string
          convenio_id: string
          created_at: string
          criado_por: string | null
          data_glosa: string
          guia_id: string | null
          id: string
          motivo: string
          motivo_detalhe: string | null
          paciente_id: string
          resolvido_em: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          clinica_id?: string
          convenio_id: string
          created_at?: string
          criado_por?: string | null
          data_glosa?: string
          guia_id?: string | null
          id?: string
          motivo: string
          motivo_detalhe?: string | null
          paciente_id: string
          resolvido_em?: string | null
          status?: string
          updated_at?: string
          valor: number
        }
        Update: {
          agendamento_id?: string | null
          clinica_id?: string
          convenio_id?: string
          created_at?: string
          criado_por?: string | null
          data_glosa?: string
          guia_id?: string | null
          id?: string
          motivo?: string
          motivo_detalhe?: string | null
          paciente_id?: string
          resolvido_em?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "glosas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glosas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glosas_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glosas_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "guias_convenio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "glosas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      guias_convenio: {
        Row: {
          anexo_mime: string | null
          anexo_nome: string | null
          anexo_path: string | null
          clinica_id: string
          codigo_faturamento: string
          codigo_guia: string
          codigo_tuss: string
          convenio_id: string
          created_at: string
          criado_por: string | null
          data_liberacao: string | null
          data_solicitacao: string
          especialidade_id: string
          id: string
          observacoes: string | null
          paciente_id: string
          sessoes_autorizadas: number | null
          sessoes_solicitadas: number
          status: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          anexo_mime?: string | null
          anexo_nome?: string | null
          anexo_path?: string | null
          clinica_id?: string
          codigo_faturamento: string
          codigo_guia: string
          codigo_tuss: string
          convenio_id: string
          created_at?: string
          criado_por?: string | null
          data_liberacao?: string | null
          data_solicitacao?: string
          especialidade_id: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          sessoes_autorizadas?: number | null
          sessoes_solicitadas: number
          status?: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          anexo_mime?: string | null
          anexo_nome?: string | null
          anexo_path?: string | null
          clinica_id?: string
          codigo_faturamento?: string
          codigo_guia?: string
          codigo_tuss?: string
          convenio_id?: string
          created_at?: string
          criado_por?: string | null
          data_liberacao?: string | null
          data_solicitacao?: string
          especialidade_id?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          sessoes_autorizadas?: number | null
          sessoes_solicitadas?: number
          status?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guias_convenio_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_convenio_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_convenio_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guias_convenio_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      liberacoes_atendimento: {
        Row: {
          agendamento_id: string
          clinica_id: string
          created_at: string
          guia_id: string | null
          liberado_em: string | null
          liberado_por: string | null
          liberado_por_nome: string | null
          status: string
          token: string | null
          updated_at: string
        }
        Insert: {
          agendamento_id: string
          clinica_id?: string
          created_at?: string
          guia_id?: string | null
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          status?: string
          token?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_id?: string
          clinica_id?: string
          created_at?: string
          guia_id?: string | null
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_por_nome?: string | null
          status?: string
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liberacoes_atendimento_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacoes_atendimento_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacoes_atendimento_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "guias_convenio"
            referencedColumns: ["id"]
          },
        ]
      }
      lista_espera: {
        Row: {
          clinica_id: string
          created_at: string
          criado_por: string | null
          dias_semana: number[]
          encerrado_em: string | null
          especialidade_id: string
          horario_obs: string | null
          id: string
          observacoes: string | null
          paciente_id: string
          periodos: string[]
          prioridade: string
          profissional_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          dias_semana?: number[]
          encerrado_em?: string | null
          especialidade_id: string
          horario_obs?: string | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          periodos?: string[]
          prioridade?: string
          profissional_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          dias_semana?: number[]
          encerrado_em?: string | null
          especialidade_id?: string
          horario_obs?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          periodos?: string[]
          prioridade?: string
          profissional_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lista_espera_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lista_espera_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_evolucao: {
        Row: {
          clinica_id: string
          conteudo: string
          created_at: string
          criado_por: string | null
          especialidade_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          clinica_id?: string
          conteudo: string
          created_at?: string
          criado_por?: string | null
          especialidade_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          conteudo?: string
          created_at?: string
          criado_por?: string | null
          especialidade_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_evolucao_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_evolucao_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      paciente_documentos: {
        Row: {
          categoria: string
          clinica_id: string
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
          clinica_id?: string
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
          clinica_id?: string
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
            foreignKeyName: "paciente_documentos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
          complemento: string | null
          convenio: string | null
          convenio_id: string | null
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
          responsavel_financeiro_parentesco: string | null
          responsavel_financeiro_telefone: string | null
          responsavel_nome: string | null
          responsavel_parentesco: string | null
          responsavel_telefone: string | null
          responsavel2_cpf: string | null
          responsavel2_email: string | null
          responsavel2_nome: string | null
          responsavel2_parentesco: string | null
          responsavel2_telefone: string | null
          sexo: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          carteirinha?: string | null
          cep?: string | null
          cid?: string | null
          cidade?: string | null
          clinica_id?: string
          complemento?: string | null
          convenio?: string | null
          convenio_id?: string | null
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
          responsavel_financeiro_parentesco?: string | null
          responsavel_financeiro_telefone?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          responsavel2_cpf?: string | null
          responsavel2_email?: string | null
          responsavel2_nome?: string | null
          responsavel2_parentesco?: string | null
          responsavel2_telefone?: string | null
          sexo?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          carteirinha?: string | null
          cep?: string | null
          cid?: string | null
          cidade?: string | null
          clinica_id?: string
          complemento?: string | null
          convenio?: string | null
          convenio_id?: string | null
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
          responsavel_financeiro_parentesco?: string | null
          responsavel_financeiro_telefone?: string | null
          responsavel_nome?: string | null
          responsavel_parentesco?: string | null
          responsavel_telefone?: string | null
          responsavel2_cpf?: string | null
          responsavel2_email?: string | null
          responsavel2_nome?: string | null
          responsavel2_parentesco?: string | null
          responsavel2_telefone?: string | null
          sexo?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento_contas: {
        Row: {
          ambiente: string
          api_key_cripto: string
          asaas_conta_id: string
          asaas_wallet_id: string | null
          clinica_id: string
          conectada_por: string | null
          created_at: string
          titular_documento: string | null
          titular_nome: string | null
          webhook_id: string | null
          webhook_token_hash: string
        }
        Insert: {
          ambiente: string
          api_key_cripto: string
          asaas_conta_id: string
          asaas_wallet_id?: string | null
          clinica_id: string
          conectada_por?: string | null
          created_at?: string
          titular_documento?: string | null
          titular_nome?: string | null
          webhook_id?: string | null
          webhook_token_hash: string
        }
        Update: {
          ambiente?: string
          api_key_cripto?: string
          asaas_conta_id?: string
          asaas_wallet_id?: string | null
          clinica_id?: string
          conectada_por?: string | null
          created_at?: string
          titular_documento?: string | null
          titular_nome?: string | null
          webhook_id?: string | null
          webhook_token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_contas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: true
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_metas: {
        Row: {
          clinica_id: string
          created_at: string
          criado_por: string | null
          data_inicio: string
          descricao: string | null
          especialidade_id: string
          id: string
          paciente_id: string
          prazo: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          data_inicio?: string
          descricao?: string | null
          especialidade_id: string
          id?: string
          paciente_id: string
          prazo?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          criado_por?: string | null
          data_inicio?: string
          descricao?: string | null
          especialidade_id?: string
          id?: string
          paciente_id?: string
          prazo?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_metas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_metas_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_metas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          clinica_id: string | null
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
          clinica_id?: string | null
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
          clinica_id?: string | null
          conselho?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          registro_profissional?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_config: {
        Row: {
          clinica_id: string
          percentual_repasse_padrao: number
          updated_at: string
          user_id: string
          valor_sessao_padrao: number
        }
        Insert: {
          clinica_id?: string
          percentual_repasse_padrao?: number
          updated_at?: string
          user_id: string
          valor_sessao_padrao?: number
        }
        Update: {
          clinica_id?: string
          percentual_repasse_padrao?: number
          updated_at?: string
          user_id?: string
          valor_sessao_padrao?: number
        }
        Relationships: [
          {
            foreignKeyName: "profissional_config_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
          clinica_id: string
          especialidade_id: string
          user_id: string
        }
        Insert: {
          clinica_id?: string
          especialidade_id: string
          user_id: string
        }
        Update: {
          clinica_id?: string
          especialidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_especialidades_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
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
      relatorios_liberados: {
        Row: {
          clinica_id: string
          created_at: string
          finalidade: string | null
          id: string
          liberado_por: string | null
          liberado_por_nome: string | null
          paciente_id: string
          periodo_ate: string
          periodo_de: string
          storage_path: string
          tamanho: number | null
          titulo: string
        }
        Insert: {
          clinica_id?: string
          created_at?: string
          finalidade?: string | null
          id?: string
          liberado_por?: string | null
          liberado_por_nome?: string | null
          paciente_id: string
          periodo_ate: string
          periodo_de: string
          storage_path: string
          tamanho?: number | null
          titulo: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          finalidade?: string | null
          id?: string
          liberado_por?: string | null
          liberado_por_nome?: string | null
          paciente_id?: string
          periodo_ate?: string
          periodo_de?: string
          storage_path?: string
          tamanho?: number | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_liberados_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_liberados_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      salas: {
        Row: {
          ativa: boolean
          clinica_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          ativa?: boolean
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativa?: boolean
          clinica_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "salas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_assinaturas: {
        Row: {
          assinado_em: string | null
          assinante_cpf: string | null
          assinante_email: string | null
          assinante_nome: string | null
          assinante_parentesco: string | null
          assinante_user_id: string | null
          assinatura_imagem: string | null
          cancelado_em: string | null
          clinica_id: string
          comprovante_hash: string | null
          created_at: string
          decisao: string | null
          id: string
          ip: string | null
          modelo_id: string | null
          paciente_id: string
          solicitado_por: string | null
          solicitado_por_nome: string | null
          status: string
          texto: string
          texto_hash: string
          tipo: string
          titulo: string
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinante_cpf?: string | null
          assinante_email?: string | null
          assinante_nome?: string | null
          assinante_parentesco?: string | null
          assinante_user_id?: string | null
          assinatura_imagem?: string | null
          cancelado_em?: string | null
          clinica_id?: string
          comprovante_hash?: string | null
          created_at?: string
          decisao?: string | null
          id?: string
          ip?: string | null
          modelo_id?: string | null
          paciente_id: string
          solicitado_por?: string | null
          solicitado_por_nome?: string | null
          status?: string
          texto: string
          texto_hash: string
          tipo?: string
          titulo: string
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinante_cpf?: string | null
          assinante_email?: string | null
          assinante_nome?: string | null
          assinante_parentesco?: string | null
          assinante_user_id?: string | null
          assinatura_imagem?: string | null
          cancelado_em?: string | null
          clinica_id?: string
          comprovante_hash?: string | null
          created_at?: string
          decisao?: string | null
          id?: string
          ip?: string | null
          modelo_id?: string | null
          paciente_id?: string
          solicitado_por?: string | null
          solicitado_por_nome?: string | null
          status?: string
          texto?: string
          texto_hash?: string
          tipo?: string
          titulo?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "termos_assinaturas_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_assinaturas_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "termos_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termos_assinaturas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      termos_modelos: {
        Row: {
          ativo: boolean
          clinica_id: string
          created_at: string
          id: string
          texto: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          texto: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          clinica_id?: string
          created_at?: string
          id?: string
          texto?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_modelos_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clinica_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinica_id?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinica_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      guias_uso: {
        Row: {
          guia_id: string | null
          reservadas: number | null
          usadas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "liberacoes_atendimento_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "guias_convenio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_especialidade: {
        Args: { _esp: string; _user_id: string }
        Returns: boolean
      }
      dev_entrar_clinica: { Args: { _slug: string }; Returns: string }
      eh_dev: { Args: never; Returns: boolean }
      familia_agenda: {
        Args: { _paciente: string }
        Returns: {
          cor: string
          especialidade: string
          fim: string
          id: string
          inicio: string
          profissional: string
          sala: string
          status: string
        }[]
      }
      familia_cobrancas: {
        Args: { _paciente: string }
        Returns: {
          clinica_nome: string
          created_at: string
          descricao: string
          forma: string
          id: string
          pagador_cpf: string
          pagador_nome: string
          pago_em: string
          status: string
          token_publico: string
          valor: number
          valor_pago: number
          vencimento: string
        }[]
      }
      familia_criancas: {
        Args: never
        Returns: {
          clinica_nome: string
          data_nascimento: string
          id: string
          nome: string
          termos_pendentes: number
        }[]
      }
      familia_email: { Args: never; Returns: string }
      familia_relatorios: {
        Args: { _paciente: string }
        Returns: {
          created_at: string
          finalidade: string
          id: string
          periodo_ate: string
          periodo_de: string
          titulo: string
        }[]
      }
      familia_sessao_ok: { Args: never; Returns: boolean }
      familia_termos: {
        Args: { _paciente: string }
        Returns: {
          assinado_em: string
          assinante_nome: string
          assinante_parentesco: string
          clinica_nome: string
          created_at: string
          decisao: string
          id: string
          paciente_nome: string
          status: string
          texto: string
          tipo: string
          titulo: string
        }[]
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
      meu_contexto: { Args: never; Returns: Json }
      minha_clinica: { Args: never; Returns: string }
      nome_auditoria: { Args: never; Returns: string }
      registrar_acesso: { Args: { _acao: string }; Returns: undefined }
      responsavel_de: { Args: { _paciente: string }; Returns: boolean }
      tem_especialidade: { Args: { _user_id: string }; Returns: boolean }
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
