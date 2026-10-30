// Regras de validação de dados usadas pelos formulários (via Zod em src/services) e testadas em validacao.test.ts.
import { z } from "zod";
import { cpfValido, somenteDigitos } from "./cobrancas";

export { cpfValido };

/** 000.000.000-00 a partir de qualquer digitação com 11 dígitos. */
export function formatarCpf(valor: string): string {
  const d = somenteDigitos(valor);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : valor.trim();
}

/** Telefone brasileiro com DDD: 10 (fixo) ou 11 (celular) dígitos; aceita +55 na frente. */
export function telefoneValido(valor: string): boolean {
  let d = somenteDigitos(valor);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11;
}

export const cepValido = (valor: string) => somenteDigitos(valor).length === 8;
export const ufValida = (valor: string) => /^[A-Z]{2}$/.test(valor.trim().toUpperCase());

/** Código TUSS de procedimento: 8 dígitos (pontos, traços e espaços são ignorados). */
export const tussValido = (valor: string) => /^\d{8}$/.test(valor.replace(/[\s.-]/g, ""));
export const normalizarTuss = (valor: string) => valor.replace(/[\s.-]/g, "");

/** Número da guia / código de faturamento: 1 a 60 caracteres, só letras, números, ponto, traço, barra e espaço. */
export const codigoOperadoraValido = (valor: string) => /^[A-Za-z0-9][A-Za-z0-9./ -]{0,59}$/.test(valor.trim());

/** Valor em reais: não negativo, até R$ 1.000.000,00 e no máximo 2 casas decimais. */
export function valorMonetarioValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0 && valor <= 1_000_000 && Math.abs(Math.round(valor * 100) - valor * 100) < 1e-6;
}

/** Data ISO (aaaa-mm-dd) válida, não futura e depois de 1900 — para nascimento e atendimentos. */
export function dataPassadaValida(iso: string, hoje = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime()) || iso.slice(0, 4) < "1900") return false;
  const limite = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return iso <= limite;
}

// ---------- Arquivos ----------
export const TIPOS_ATESTADO = ["application/pdf", "image/jpeg", "image/png"] as const;
export const TIPOS_GUIA = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const TIPOS_DOCUMENTO = [
  ...TIPOS_GUIA,
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export type RegraArquivo = { tipos: readonly string[]; maxMB: number; descricao: string };
export const REGRA_ATESTADO: RegraArquivo = { tipos: TIPOS_ATESTADO, maxMB: 15, descricao: "PDF, JPG ou PNG" };
export const REGRA_GUIA: RegraArquivo = { tipos: TIPOS_GUIA, maxMB: 15, descricao: "PDF ou foto" };
export const REGRA_DOCUMENTO: RegraArquivo = { tipos: TIPOS_DOCUMENTO, maxMB: 20, descricao: "PDF, foto, Word ou Excel" };

/** null quando o arquivo pode ser enviado; senão, a mensagem para a pessoa. */
export function problemaNoArquivo(arquivo: { name: string; size: number; type: string }, regra: RegraArquivo): string | null {
  if (arquivo.size <= 0) return `${arquivo.name}: o arquivo está vazio.`;
  if (!regra.tipos.includes(arquivo.type)) return `${arquivo.name}: envie ${regra.descricao}.`;
  if (arquivo.size > regra.maxMB * 1024 * 1024) return `${arquivo.name}: passa de ${regra.maxMB} MB.`;
  return null;
}

// ---------- Blocos Zod reutilizáveis ----------
/** Texto opcional: apara espaços e transforma vazio em null. */
export const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null),
    z.string().max(max, `Use no máximo ${max} caracteres.`).nullable(),
  );

const opcionalCom = (teste: (s: string) => boolean, msg: string, max = 120, normalizar?: (s: string) => string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v ?? null),
    z
      .string()
      .max(max)
      .refine(teste, msg)
      .transform((s) => (normalizar ? normalizar(s) : s))
      .nullable(),
  );

export const cpfOpcional = (rotulo = "CPF") => opcionalCom(cpfValido, `${rotulo} inválido.`, 20, formatarCpf);
export const telefoneOpcional = (rotulo = "Telefone") => opcionalCom(telefoneValido, `${rotulo}: informe DDD + número.`, 25);
export const emailOpcional = (rotulo = "E-mail") =>
  opcionalCom((s) => z.string().email().safeParse(s).success, `${rotulo} inválido.`, 255, (s) => s.toLowerCase());

/** Primeira mensagem de erro de um resultado Zod, com o caminho do campo. */
export function primeiroErro(issues: readonly { path: readonly PropertyKey[]; message: string }[]) {
  const i = issues[0];
  return i ? { campo: String(i.path[0] ?? ""), mensagem: i.message } : null;
}
