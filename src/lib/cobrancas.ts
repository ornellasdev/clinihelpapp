/** Regras e textos das cobranças aos responsáveis (sem dependências de servidor). */

export type StatusCobranca = "pendente" | "em_analise" | "pago" | "vencido" | "estornado" | "contestado" | "cancelada";
export type FormaCobranca = "pix" | "boleto" | "cartao" | "todas";
export type TipoCobranca = "sessao" | "mensal" | "avulsa";

/** Endereço público onde os responsáveis abrem a página de pagamento. */
export const URL_PUBLICA = "https://clinihelpsystem.lovable.app";
export const linkPagamento = (token: string) => `${URL_PUBLICA}/pagar/${token}`;
export const URL_WEBHOOK_ASAAS = `${URL_PUBLICA}/api/public/asaas/webhook`;

/** Menor valor que o Asaas aceita numa cobrança. */
export const VALOR_MINIMO_COBRANCA = 5;

export const STATUS_COBRANCA: Record<StatusCobranca, { label: string; className: string }> = {
  pendente: { label: "Aguardando", className: "bg-warning/25 text-warning-foreground" },
  em_analise: { label: "Em análise", className: "bg-secondary text-secondary-foreground" },
  pago: { label: "Pago", className: "bg-success/15 text-success" },
  vencido: { label: "Vencido", className: "bg-destructive/15 text-destructive" },
  estornado: { label: "Estornado", className: "bg-muted text-muted-foreground" },
  contestado: { label: "Contestado", className: "bg-destructive/15 text-destructive" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
};

export const FORMAS_COBRANCA: { value: FormaCobranca; label: string }[] = [
  { value: "todas", label: "Responsável escolhe (Pix, boleto ou cartão)" },
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão de crédito" },
];
export const rotuloForma = (f: string) =>
  ({ todas: "Pix, boleto ou cartão", pix: "Pix", boleto: "Boleto", cartao: "Cartão" })[f] ?? f;

/** Forma no CliniHelp → tipo de cobrança do Asaas. */
export function billingTypeAsaas(forma: FormaCobranca): "PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED" {
  return forma === "pix" ? "PIX" : forma === "boleto" ? "BOLETO" : forma === "cartao" ? "CREDIT_CARD" : "UNDEFINED";
}

/** Situação do Asaas → situação no CliniHelp. */
export function statusDoAsaas(status: string, removida = false): StatusCobranca {
  if (removida) return "cancelada";
  switch (status) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "pago";
    case "OVERDUE":
      return "vencido";
    case "AWAITING_RISK_ANALYSIS":
      return "em_analise";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "REFUND_IN_PROGRESS":
      return "estornado";
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
      return "contestado";
    default:
      return "pendente";
  }
}

/** Cobrança ainda pode ser paga (mostra Pix/boleto/cartão na página pública). */
export const podePagar = (s: StatusCobranca) => s === "pendente" || s === "vencido";
/** Cobrança ainda pode ser cancelada pela clínica. */
export const podeCancelar = (s: StatusCobranca) => s === "pendente" || s === "vencido";

/**
 * Como a sessão fica no Financeiro depois da mudança na cobrança:
 * pago → sessão paga; estorno/cancelamento de algo que estava pago → volta a pendente.
 */
export function efeitoNasSessoes(anterior: StatusCobranca, novo: StatusCobranca): "pago" | "pendente" | null {
  if (novo === "pago" && anterior !== "pago") return "pago";
  if (anterior === "pago" && novo !== "pago") return "pendente";
  return null;
}

/** Uma sessão = "por sessão"; várias = "mensal" (soma do mês); nenhuma = valor livre. */
export function tipoPorSessoes(qtd: number): TipoCobranca {
  return qtd === 0 ? "avulsa" : qtd === 1 ? "sessao" : "mensal";
}

/** Sessões já presas a uma cobrança ativa não podem ser cobradas de novo. */
export const STATUS_QUE_PRENDEM_SESSAO: StatusCobranca[] = ["pendente", "em_analise", "pago", "vencido", "contestado"];

export const somenteDigitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export function cpfValido(valor: string | null | undefined): boolean {
  const c = somenteDigitos(valor);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export type DadosResponsaveis = {
  responsavel_nome?: string | null;
  responsavel_cpf?: string | null;
  responsavel_email?: string | null;
  responsavel_telefone?: string | null;
  responsavel_financeiro_nome?: string | null;
  responsavel_financeiro_cpf?: string | null;
  responsavel_financeiro_email?: string | null;
  responsavel_financeiro_telefone?: string | null;
};

/** Quem paga: o responsável financeiro; se não houver, o responsável principal. */
export function pagadorDoPaciente(p: DadosResponsaveis) {
  const fin = (p.responsavel_financeiro_nome ?? "").trim();
  const usarFinanceiro = fin.length > 0 || somenteDigitos(p.responsavel_financeiro_cpf).length > 0;
  const nome = (usarFinanceiro ? fin : (p.responsavel_nome ?? "").trim()) || null;
  const cpf = somenteDigitos(usarFinanceiro ? p.responsavel_financeiro_cpf : p.responsavel_cpf) || null;
  const email = ((usarFinanceiro ? p.responsavel_financeiro_email : p.responsavel_email) ?? "").trim() || null;
  const telefone = somenteDigitos(usarFinanceiro ? p.responsavel_financeiro_telefone : p.responsavel_telefone) || null;
  return { nome, cpf, email, telefone, origem: usarFinanceiro ? ("financeiro" as const) : ("principal" as const) };
}

export function mensagemWhatsapp(clinica: string, descricao: string, valor: string, link: string) {
  return `Olá! Segue a cobrança da ${clinica}: ${descricao} — ${valor}.\nPague por Pix, boleto ou cartão neste link: ${link}`;
}
