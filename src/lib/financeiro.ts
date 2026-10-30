/** Repasse do profissional: percentual ajustável por sessão aplicado sobre o valor do atendimento. */
export function calcularRepasse(valor: number, percentual: number): number {
  const v = Number.isFinite(valor) && valor > 0 ? valor : 0;
  const p = Math.min(100, Math.max(0, Number.isFinite(percentual) ? percentual : 0));
  return Math.round(v * p) / 100;
}

export function liquidoClinica(valor: number, percentual: number): number {
  const v = Number.isFinite(valor) && valor > 0 ? valor : 0;
  return Math.round((v - calcularRepasse(v, percentual)) * 100) / 100;
}

type FinSessao = {
  valor: number | string | null;
  percentual_repasse?: number | string | null;
  /** Falso nas faltas não cobradas e cancelamentos (gravado pelo banco a partir do status). */
  cobrar?: boolean | null;
  /** Falso quando a sessão não gera repasse ao profissional. */
  repassar?: boolean | null;
};

/** Valor que a sessão gera de cobrança (zero quando é falta não cobrada). */
export function valorCobrado(fin: FinSessao | null | undefined): number {
  if (!fin || fin.cobrar === false) return 0;
  return Number(fin.valor ?? 0);
}

/** Repasse devido ao profissional (zero quando a sessão não gera repasse). */
export function repasseDevido(fin: FinSessao | null | undefined): number {
  if (!fin || fin.repassar === false || fin.cobrar === false) return 0;
  return calcularRepasse(Number(fin.valor ?? 0), Number(fin.percentual_repasse ?? 0));
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatarMoeda(valor: number | null | undefined): string {
  return brl.format(Number(valor ?? 0));
}
