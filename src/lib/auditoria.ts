import { format, parseISO } from "date-fns";

export const AREAS_AUDITORIA: Record<string, string> = {
  acesso: "Acesso ao sistema",
  contas: "Contas da equipe",
  pacientes: "Pacientes",
  paciente_documentos: "Documentos",
  agendamentos: "Agenda",
  atendimento_financeiro: "Financeiro das sessões",
  evolucoes: "Prontuário",
  profiles: "Perfis da equipe",
  user_roles: "Papéis de acesso",
  profissional_especialidades: "Especialidades do profissional",
  profissional_config: "Repasse do profissional",
  salas: "Salas",
  especialidades: "Especialidades",
  convenios: "Convênios",
  convenio_valores: "Valores de convênio",
  cobrancas: "Cobranças",
};

/** Áreas que aparecem no filtro; o prontuário só para quem pode ver esses registros. */
export function areasVisiveis(veProntuario: boolean) {
  return Object.entries(AREAS_AUDITORIA).filter(([k]) => veProntuario || k !== "evolucoes");
}

export const ACOES_AUDITORIA: Record<string, { label: string; tom: "criou" | "alterou" | "removeu" | "neutro" }> = {
  criou: { label: "Criou", tom: "criou" },
  alterou: { label: "Alterou", tom: "alterou" },
  removeu: { label: "Removeu", tom: "removeu" },
  login: { label: "Entrou", tom: "neutro" },
  logout: { label: "Saiu", tom: "neutro" },
  desativou: { label: "Desativou conta", tom: "removeu" },
  reativou: { label: "Reativou conta", tom: "criou" },
  redefiniu_senha: { label: "Redefiniu senha", tom: "alterou" },
};

const CAMPOS: Record<string, string> = {
  nome: "Nome",
  data_nascimento: "Data de nascimento",
  sexo: "Sexo",
  cpf: "CPF",
  diagnostico: "Diagnóstico",
  cid: "CID",
  escola: "Escola",
  ativo: "Ativo",
  ativa: "Ativa",
  convenio: "Convênio",
  convenio_id: "Convênio",
  carteirinha: "Nº da carteirinha",
  cidade: "Município",
  uf: "UF",
  cep: "CEP",
  pais: "País",
  numero: "Número",
  paciente_id: "Paciente",
  profissional_id: "Profissional",
  sala_id: "Sala",
  especialidade_id: "Especialidade",
  user_id: "Profissional",
  inicio: "Início",
  fim: "Fim",
  status: "Status",
  observacoes: "Observações",
  valor: "Valor",
  valor_sessao: "Valor da sessão",
  valor_repasse: "Valor do repasse",
  percentual_repasse: "Repasse (%)",
  percentual_repasse_padrao: "Repasse de profissional (%)",
  valor_sessao_padrao: "Valor da sessão do profissional",
  pagamento_status: "Pagamento",
  repasse_pago: "Repasse pago",
  conteudo: "Texto da evolução",
  data_atendimento: "Data do atendimento",
  profissional_nome: "Nome do profissional",
  profissional_registro: "Registro do profissional",
  categoria: "Categoria",
  role: "Papel",
  papeis: "Papéis",
  email: "E-mail",
  telefone: "Telefone",
  conselho: "Conselho",
  registro_profissional: "Nº do registro",
  descricao: "Descrição",
  tipo: "Tipo",
  cor: "Cor",
  tamanho: "Tamanho",
  mime_type: "Tipo de arquivo",
};

/** Campos técnicos que não ajudam quem lê a auditoria. */
const OCULTOS = new Set(["id", "created_at", "updated_at", "criado_por", "enviado_por", "storage_path", "agendamento_id", "convenio_id_old"]);

export function rotuloCampo(k: string) {
  if (CAMPOS[k]) return CAMPOS[k];
  const t = k.replace(/_/g, " ").replace(/\d+/g, (n) => ` ${n} `).replace(/\s+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function camposVisiveis(dados: Record<string, unknown> | null | undefined) {
  return Object.keys(dados ?? {}).filter((k) => !OCULTOS.has(k));
}

/** Formata um valor gravado (texto, número, data, booleano) para leitura. `nomes` resolve ids de salas, pessoas etc. */
export function formatarValorAuditoria(v: unknown, nomes?: Map<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.map((x) => formatarValorAuditoria(x, nomes)).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (nomes?.has(s)) return nomes.get(s)!;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return format(parseISO(s), "dd/MM/yyyy");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return format(parseISO(s), "dd/MM/yyyy HH:mm");
  return s;
}
