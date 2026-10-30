// Regras da Área dos responsáveis e dos termos assinados (sem acesso a banco).
import { cpfValido, somenteDigitos } from "./cobrancas";

export type TipoTermo = "tratamento" | "imagem" | "outro";
export type Decisao = "concordo" | "autorizo" | "nao_autorizo";

export const TIPOS_TERMO: Record<TipoTermo, string> = {
  tratamento: "Consentimento de tratamento",
  imagem: "Uso de imagem",
  outro: "Outro termo",
};

export const ROTULO_DECISAO: Record<Decisao, string> = {
  concordo: "Li e concordo",
  autorizo: "Autorizo",
  nao_autorizo: "Não autorizo",
};

/** Termo de imagem pede "autorizo/não autorizo"; os demais, só "li e concordo". */
export const decisoesDoTipo = (tipo: string): Decisao[] => (tipo === "imagem" ? ["autorizo", "nao_autorizo"] : ["concordo"]);

export const PARENTESCOS = ["Mãe", "Pai", "Avó", "Avô", "Tutor(a) legal", "Outro"];

/** Rascunhos prontos; cada clínica deve revisar com seu jurídico antes de usar. */
export const MODELOS_TERMO_PADRAO: { tipo: TipoTermo; titulo: string; texto: string }[] = [
  {
    tipo: "tratamento",
    titulo: "Termo de consentimento para tratamento",
    texto: `Eu, responsável legal pela criança {{crianca}}, autorizo a {{clinica}} a realizar avaliações e atendimentos terapêuticos (como fonoaudiologia, terapia ocupacional, psicologia, fisioterapia e psicopedagogia), conforme o plano terapêutico apresentado pela equipe.

Declaro que:
1. Recebi explicações sobre os objetivos, a frequência e a duração prevista dos atendimentos, e pude tirar minhas dúvidas.
2. Sei que os resultados dependem de vários fatores, inclusive da participação da família, e que não há garantia de resultado.
3. Comprometo-me a informar a clínica sobre mudanças de saúde, medicamentos e diagnósticos da criança.
4. Autorizo o registro das sessões em prontuário eletrônico, acessível apenas aos profissionais envolvidos no atendimento, conforme o sigilo profissional e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
5. Posso revogar este consentimento a qualquer momento, por escrito, sem prejuízo dos atendimentos já realizados.`,
  },
  {
    tipo: "imagem",
    titulo: "Autorização de uso de imagem e voz",
    texto: `Eu, responsável legal pela criança {{crianca}}, declaro abaixo se autorizo ou não a {{clinica}} a registrar fotos, vídeos e áudios da criança durante os atendimentos.

Se eu autorizar:
1. Os registros servirão para acompanhamento terapêutico, discussão de caso entre os profissionais da clínica e orientação à família.
2. Nenhuma imagem será usada em redes sociais, propaganda ou material público sem uma nova autorização específica.
3. Os arquivos ficam guardados com segurança e não serão vendidos nem repassados a terceiros.
4. Posso revogar esta autorização a qualquer momento, por escrito.

A recusa não interfere no atendimento da criança.`,
  },
];

export function preencherTermo(texto: string, dados: { crianca: string; clinica: string }) {
  return texto.replaceAll("{{crianca}}", dados.crianca).replaceAll("{{clinica}}", dados.clinica);
}

export const normalizarEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

/** E-mails que dão acesso à Área da família: os três responsáveis da ficha (sem repetir, sem vazios). */
export function emailsDosResponsaveis(p: {
  responsavel_email?: string | null;
  responsavel2_email?: string | null;
  responsavel_financeiro_email?: string | null;
}) {
  return [...new Set([p.responsavel_email, p.responsavel2_email, p.responsavel_financeiro_email].map(normalizarEmail).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
}

export type DadosAssinatura = { nome: string; cpf: string; parentesco: string; decisao: string; assinatura: string; tipo: string };

/** Confere os dados antes de gravar a assinatura; devolve a mensagem de erro ou null. */
export function validarAssinatura(d: DadosAssinatura): string | null {
  if (d.nome.trim().split(/\s+/).length < 2) return "Escreva seu nome completo.";
  if (!cpfValido(d.cpf)) return "CPF inválido.";
  if (!d.parentesco.trim()) return "Informe o parentesco com a criança.";
  if (!decisoesDoTipo(d.tipo).includes(d.decisao as Decisao)) return "Escolha uma opção do termo.";
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(d.assinatura) || d.assinatura.length < 800) return "Faça sua assinatura no quadro.";
  if (d.assinatura.length > 300_000) return "Assinatura muito grande. Limpe e assine novamente.";
  return null;
}

export const formatarCpf = (cpf: string) => {
  const d = somenteDigitos(cpf).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
