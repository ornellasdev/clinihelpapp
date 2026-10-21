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

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatarMoeda(valor: number | null | undefined): string {
  return brl.format(Number(valor ?? 0));
}
