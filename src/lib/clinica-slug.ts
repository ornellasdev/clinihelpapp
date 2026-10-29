/** Endereços que não podem ser usados por clínicas (já são páginas do sistema). */
export const SLUGS_RESERVADOS = ["auth", "dev", "api", "assets", "admin", "login", "entrar", "static"];

/** Gera o endereço da clínica a partir do nome: "Clínica Sol & Mar" → "clinica-sol-mar". */
export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function slugValido(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 40 && !SLUGS_RESERVADOS.includes(slug);
}
