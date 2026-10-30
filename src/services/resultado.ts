// Tratamento padronizado de erros da camada de serviços.
import type { z } from "zod";
import { erroAmigavel } from "@/lib/ui-helpers";

/** Erro já com mensagem pronta para a pessoa (e, quando for validação, o campo). */
export class ErroServico extends Error {
  constructor(
    mensagem: string,
    readonly campo?: string,
    readonly campos: Record<string, string> = {},
  ) {
    super(mensagem);
    this.name = "ErroServico";
  }
}

/** Devolve os dados ou lança ErroServico com a mensagem amigável do banco. */
export function garantir<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new ErroServico(erroAmigavel(res.error.message));
  return res.data as T;
}

/** Mapa campo → mensagem com todos os problemas encontrados pelo Zod. */
export function errosPorCampo(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const i of issues) {
    const campo = String(i.path[0] ?? "");
    if (!(campo in mapa)) mapa[campo] = i.message;
  }
  return mapa;
}

/** Valida com Zod antes de ir ao banco; em caso de problema lança ErroServico com o primeiro campo. */
export function validar<S extends z.ZodType>(schema: S, dados: unknown): z.output<S> {
  const r = schema.safeParse(dados);
  if (r.success) return r.data;
  const campos = errosPorCampo(r.error.issues);
  const [campo, mensagem] = Object.entries(campos)[0] ?? ["", "Dados inválidos."];
  throw new ErroServico(mensagem, campo, campos);
}

export const mensagemDeErro = (e: unknown) =>
  e instanceof ErroServico ? e.message : erroAmigavel(e instanceof Error ? e.message : String(e));

/** Tira chaves com undefined (o banco não aceita "undefined" em campos opcionais). */
export function semIndefinidos<T extends object>(o: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
