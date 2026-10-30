/** Chamadas à API do Asaas (somente servidor). O ambiente vem da própria chave: _hmlg_ = teste. */

export type AmbienteAsaas = "sandbox" | "producao";

export function ambienteDaChave(apiKey: string): AmbienteAsaas {
  return apiKey.includes("_hmlg_") ? "sandbox" : "producao";
}

function base(apiKey: string) {
  return ambienteDaChave(apiKey) === "sandbox" ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

export class ErroAsaas extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function asaas<T = any>(apiKey: string, caminho: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${base(apiKey)}${caminho}`, {
    method: init.method ?? "GET",
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
      "User-Agent": "CliniHelp",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const texto = await res.text();
  let json: any = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    /* resposta não-JSON */
  }
  if (!res.ok) {
    const desc = json?.errors?.map((e: { description?: string }) => e.description).filter(Boolean).join(" ");
    console.error(`Asaas ${init.method ?? "GET"} ${caminho.split("?")[0]} [${res.status}]: ${texto.slice(0, 500)}`);
    if (res.status === 401) throw new ErroAsaas("A chave de acesso do Asaas foi recusada.", 401);
    throw new ErroAsaas(desc || `O serviço de pagamentos recusou a operação (${res.status}).`, res.status);
  }
  return json as T;
}

export type PagamentoAsaas = {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  dueDate: string;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string | null;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  confirmedDate?: string | null;
  deleted?: boolean;
  externalReference?: string | null;
};
