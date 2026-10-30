// Domínio Pacientes: cadastro administrativo (recepção) e dados clínicos (equipe terapêutica), sempre validados com Zod.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  cepValido,
  cidValido,
  cpfOpcional,
  dataPassadaValida,
  emailOpcional,
  telefoneOpcional,
  textoOpcional,
  ufValida,
} from "@/lib/validacao";
import { formatarCep } from "@/lib/cep";
import { errosPorCampo, garantir, validar } from "./resultado";

/** Campos que a tela de cadastro nunca envia: dados clínicos (outra tabela), consentimento LGPD (vem do termo) e metadados. */
type CamposForaDoCadastro =
  | "id"
  | "created_at"
  | "updated_at"
  | "criado_por"
  | "clinica_id"
  | "diagnostico"
  | "cid"
  | "alergias"
  | "medicamentos"
  | `lgpd_${string}`;

export type CadastroPaciente = Omit<TablesInsert<"pacientes">, CamposForaDoCadastro>;

const vazioParaNulo = (v: unknown) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null);

export const pacienteSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo da criança.").max(200, "Nome muito longo."),
  data_nascimento: z.preprocess(
    vazioParaNulo,
    z.string().refine((s) => dataPassadaValida(s), "Data de nascimento inválida ou no futuro.").nullable(),
  ),
  sexo: z.preprocess(vazioParaNulo, z.enum(["Feminino", "Masculino", "Outro"], "Sexo inválido.").nullable()),
  cpf: cpfOpcional("CPF da criança"),
  escola: textoOpcional(200),
  responsavel_nome: textoOpcional(200),
  responsavel_parentesco: textoOpcional(60),
  responsavel_cpf: cpfOpcional("CPF do responsável principal"),
  responsavel_telefone: telefoneOpcional("Telefone do responsável principal"),
  responsavel_email: emailOpcional("E-mail do responsável principal"),
  responsavel2_nome: textoOpcional(200),
  responsavel2_parentesco: textoOpcional(60),
  responsavel2_cpf: cpfOpcional("CPF do segundo responsável"),
  responsavel2_telefone: telefoneOpcional("Telefone do segundo responsável"),
  responsavel2_email: emailOpcional("E-mail do segundo responsável"),
  responsavel_financeiro_nome: textoOpcional(200),
  responsavel_financeiro_parentesco: textoOpcional(60),
  responsavel_financeiro_cpf: cpfOpcional("CPF do responsável financeiro"),
  responsavel_financeiro_telefone: telefoneOpcional("Telefone do responsável financeiro"),
  responsavel_financeiro_email: emailOpcional("E-mail do responsável financeiro"),
  cep: z.preprocess(vazioParaNulo, z.string().refine(cepValido, "CEP precisa ter 8 dígitos.").transform(formatarCep).nullable()),
  endereco: textoOpcional(300),
  numero: textoOpcional(20),
  complemento: textoOpcional(120),
  cidade: textoOpcional(120),
  estado: textoOpcional(60),
  uf: z.preprocess(
    vazioParaNulo,
    z
      .string()
      .refine(ufValida, "UF precisa ter 2 letras (ex.: SP).")
      .transform((s) => s.toUpperCase())
      .nullable(),
  ),
  pais: textoOpcional(60),
  convenio_id: z.preprocess(vazioParaNulo, z.string().uuid("Convênio inválido.").nullable()),
  convenio: textoOpcional(120),
  carteirinha: textoOpcional(60),
  observacoes: textoOpcional(5000),
  ativo: z.boolean().default(true),
});

/** Problemas por campo, para destacar no formulário antes de salvar. */
export function errosDoCadastro(dados: CadastroPaciente): Record<string, string> {
  const r = pacienteSchema.safeParse(dados);
  return r.success ? {} : errosPorCampo(r.error.issues);
}

export async function criarPaciente(dados: CadastroPaciente): Promise<string> {
  const valido = validar(pacienteSchema, dados);
  const { data, error } = await supabase.from("pacientes").insert(valido).select("id").single();
  garantir({ data, error });
  return data!.id;
}

export async function atualizarPaciente(id: string, dados: CadastroPaciente): Promise<void> {
  const valido = validar(pacienteSchema, dados);
  garantir(await supabase.from("pacientes").update(valido).eq("id", id));
}

// ---------- Dados clínicos (diagnóstico, CID, alergias, medicação) ----------
export const dadosClinicosSchema = z.object({
  diagnostico: textoOpcional(10000),
  cid: z.preprocess(
    vazioParaNulo,
    z
      .string()
      .max(200)
      .refine(cidValido, "CID inválido. Use o formato F84.0 (separe vários por vírgula).")
      .transform((s) => s.toUpperCase())
      .nullable(),
  ),
  alergias: textoOpcional(5000),
  medicamentos: textoOpcional(5000),
});
export type DadosClinicos = z.input<typeof dadosClinicosSchema>;

/** Só o master e o terapeuta do paciente recebem a linha; para os demais o banco devolve vazio. */
export const dadosClinicosQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["dados_clinicos", pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paciente_dados_clinicos")
        .select("diagnostico, cid, alergias, medicamentos, updated_at, atualizado_por")
        .eq("paciente_id", pacienteId)
        .maybeSingle();
      garantir({ data, error });
      return data;
    },
  });

export async function salvarDadosClinicos(pacienteId: string, dados: DadosClinicos): Promise<void> {
  const valido = validar(dadosClinicosSchema, dados);
  garantir(
    await supabase.from("paciente_dados_clinicos").upsert({ paciente_id: pacienteId, ...valido }, { onConflict: "paciente_id" }),
  );
}
