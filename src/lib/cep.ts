export type EnderecoCep = { cep: string; endereco: string; cidade: string; estado: string; pais: string };

/** Mantém só dígitos (máx. 8) e aplica a máscara 00000-000. */
export function formatarCep(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

type RespostaViaCep = { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };

/** Converte a resposta do ViaCEP nos campos do cadastro; null quando o CEP não existe. */
export function enderecoDeViaCep(cep: string, r: RespostaViaCep): EnderecoCep | null {
  if (!r || r.erro || !r.localidade) return null;
  const endereco = [r.logradouro, r.bairro].map((x) => x?.trim()).filter(Boolean).join(" - ");
  return { cep: formatarCep(cep), endereco, cidade: r.localidade, estado: r.uf ?? "", pais: "Brasil" };
}

export async function buscarCep(cep: string, signal?: AbortSignal): Promise<EnderecoCep | null> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal });
  if (!res.ok) throw new Error(`Falha na consulta do CEP (${res.status})`);
  return enderecoDeViaCep(d, (await res.json()) as RespostaViaCep);
}
