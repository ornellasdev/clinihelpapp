/** Regras de senha segura do CliniHelp (todas obrigatórias). */
export const REQUISITOS_SENHA = [
  { id: "tamanho", label: "Pelo menos 8 caracteres", ok: (s: string) => s.length >= 8 },
  { id: "maiuscula", label: "Uma letra maiúscula (A-Z)", ok: (s: string) => /[A-Z]/.test(s) },
  { id: "minuscula", label: "Uma letra minúscula (a-z)", ok: (s: string) => /[a-z]/.test(s) },
  { id: "numero", label: "Um número (0-9)", ok: (s: string) => /\d/.test(s) },
  { id: "especial", label: "Um caractere especial (ex.: ! @ # $ %)", ok: (s: string) => /[^A-Za-z0-9\s]/.test(s) },
  { id: "espaco", label: "Sem espaços", ok: (s: string) => s.length > 0 && !/\s/.test(s) },
] as const;

/** Limite do algoritmo de senha do servidor de login. */
export const SENHA_MAX = 72;

export function avaliarSenha(s: string) {
  return REQUISITOS_SENHA.map((r) => ({ id: r.id, label: r.label, ok: r.ok(s) }));
}

export function senhaForte(s: string): boolean {
  return s.length <= SENHA_MAX && REQUISITOS_SENHA.every((r) => r.ok(s));
}

export const MSG_SENHA_FRACA =
  "A senha precisa ter pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial, sem espaços.";

const MAIUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
const NUMEROS = "23456789";
const ESPECIAIS = "!@#$%&*?";

function sortear(conjunto: string, n: number): string[] {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (v) => conjunto[v % conjunto.length]!);
}

/** Senha temporária aleatória de 12 caracteres que já cumpre todas as regras (sem caracteres ambíguos). */
export function gerarSenhaTemporaria(): string {
  const todos = MAIUSCULAS + MINUSCULAS + NUMEROS + ESPECIAIS;
  const chars = [...sortear(MAIUSCULAS, 2), ...sortear(MINUSCULAS, 4), ...sortear(NUMEROS, 2), ...sortear(ESPECIAIS, 2), ...sortear(todos, 2)];
  const ordem = new Uint32Array(chars.length);
  crypto.getRandomValues(ordem);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = ordem[i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
