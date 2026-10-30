/**
 * Migração de dados (painel /dev): leitura de CSV e validação linha a linha dos modelos.
 * Funções puras — usadas pelo navegador (pré-visualização) e pelo servidor (revalidação).
 */
import { cpfValido, telefoneValido, cepValido } from "./validacao";

export type TipoMigracao = "pacientes" | "convenios";

export const COLUNAS: Record<TipoMigracao, string[]> = {
  convenios: ["nome", "tipo"],
  pacientes: [
    "nome", "data_nascimento", "cpf", "sexo", "escola", "convenio", "carteirinha",
    "responsavel_nome", "responsavel_parentesco", "responsavel_cpf", "responsavel_telefone", "responsavel_email",
    "responsavel2_nome", "responsavel2_parentesco", "responsavel2_cpf", "responsavel2_telefone", "responsavel2_email",
    "responsavel_financeiro_nome", "responsavel_financeiro_parentesco", "responsavel_financeiro_cpf",
    "responsavel_financeiro_telefone", "responsavel_financeiro_email",
    "cep", "endereco", "numero", "complemento", "cidade", "estado", "uf", "pais", "observacoes",
  ],
};

const EXEMPLOS: Record<TipoMigracao, string[]> = {
  convenios: ["Unimed", "convenio"],
  pacientes: [
    "Lucas Exemplo", "15/03/2019", "", "M", "Escola Exemplo", "Unimed", "",
    "Maria Exemplo", "Mãe", "", "(11) 91234-5678", "maria@exemplo.com",
    "", "", "", "", "", "", "", "", "", "",
    "01001-000", "Praça da Sé", "100", "", "São Paulo", "São Paulo", "SP", "Brasil", "",
  ],
};

export const TIPOS_CONVENIO = ["convenio", "particular", "liminar"] as const;
export const MAX_LINHAS = 2000;

/** CSV com ";" (padrão do Excel em português) ou ",". Aceita aspas. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "");
  const primeira = limpo.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "", linha: string[] = [], aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((v) => v.trim())) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v.trim())) linhas.push(linha);
  return linhas;
}

export function modeloCsv(tipo: TipoMigracao): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "\uFEFF" + [COLUNAS[tipo], EXEMPLOS[tipo]].map((l) => l.map(esc).join(";")).join("\r\n") + "\r\n";
}

/** "15/03/2019" ou "2019-03-15" → "2019-03-15"; null se inválida. */
export function lerData(v: string): string | null {
  const t = v.trim();
  let a: number, m: number, d: number;
  let r = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (r) [d, m, a] = [+r[1]!, +r[2]!, +r[3]!];
  else if ((r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) [a, m, d] = [+r[1]!, +r[2]!, +r[3]!];
  else return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (a < 1900 || dt.getTime() > Date.now()) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type LinhaValidada = { linha: number; dados: Record<string, string | null>; erros: string[] };

const normCab = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 255;

export function validarPlanilha(tipo: TipoMigracao, tabela: string[][]): { linhas: LinhaValidada[]; erroGeral?: string } {
  if (tabela.length < 2) return { linhas: [], erroGeral: "A planilha não tem linhas de dados." };
  const cab = tabela[0]!.map(normCab);
  if (!cab.includes("nome")) return { linhas: [], erroGeral: "Falta a coluna \"nome\". Use o modelo oficial." };
  if (tabela.length - 1 > MAX_LINHAS) return { linhas: [], erroGeral: `Máximo de ${MAX_LINHAS} linhas por arquivo.` };
  const conhecidas = new Set(COLUNAS[tipo]);
  const nomesVistos = new Set<string>();

  const linhas = tabela.slice(1).map((cols, i) => {
    const bruto: Record<string, string> = {};
    cab.forEach((c, j) => { if (conhecidas.has(c)) bruto[c] = (cols[j] ?? "").trim(); });
    const dados: Record<string, string | null> = {};
    for (const c of COLUNAS[tipo]) dados[c] = bruto[c] ? bruto[c].slice(0, 500) : null;
    const erros: string[] = [];
    const nome = dados["nome"] ?? "";
    if (nome.length < 2) erros.push("Nome obrigatório.");

    if (tipo === "convenios") {
      const t = (dados["tipo"] ?? "convenio").toLowerCase();
      if (!(TIPOS_CONVENIO as readonly string[]).includes(t)) erros.push("Tipo deve ser convenio, particular ou liminar.");
      dados["tipo"] = t;
      if (nome.length > 80) erros.push("Nome do convênio até 80 caracteres.");
    } else {
      if (dados["data_nascimento"]) {
        const d = lerData(dados["data_nascimento"]);
        if (!d) erros.push("Data de nascimento inválida (use DD/MM/AAAA).");
        dados["data_nascimento"] = d;
      }
      for (const p of ["", "responsavel_", "responsavel2_", "responsavel_financeiro_"]) {
        const cpf = dados[`${p}cpf`];
        if (cpf && !cpfValido(cpf)) erros.push(`${p ? rotulo(p) + ": " : ""}CPF inválido.`);
        if (p) {
          const tel = dados[`${p}telefone`];
          if (tel && !telefoneValido(tel)) erros.push(`${rotulo(p)}: telefone sem DDD.`);
          const em = dados[`${p}email`];
          if (em && !emailOk(em)) erros.push(`${rotulo(p)}: e-mail inválido.`);
          if (em) dados[`${p}email`] = em.toLowerCase();
        }
      }
      if (dados["cep"] && !cepValido(dados["cep"])) erros.push("CEP inválido.");
      if (dados["uf"]) {
        dados["uf"] = dados["uf"].toUpperCase();
        if (!/^[A-Z]{2}$/.test(dados["uf"])) erros.push("UF deve ter 2 letras.");
      }
      if (dados["sexo"]) {
        const s = dados["sexo"].toUpperCase()[0];
        dados["sexo"] = s === "M" || s === "F" ? s : null;
      }
    }
    const chave = normCab(nome) + "|" + (dados["data_nascimento"] ?? dados["cpf"] ?? "");
    if (nome && nomesVistos.has(chave)) erros.push("Linha repetida no arquivo.");
    nomesVistos.add(chave);
    return { linha: i + 2, dados, erros };
  });
  return { linhas };
}

function rotulo(p: string) {
  return p === "responsavel_" ? "Responsável 1" : p === "responsavel2_" ? "Responsável 2" : "Resp. financeiro";
}
