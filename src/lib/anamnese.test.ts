import { describe, expect, it } from "vitest";
import { SECOES_ANAMNESE, TODOS_CAMPOS, erroDoCampo, preencherDaFicha, validarAnamnese, type Respostas } from "./anamnese";

/** Responde tudo de forma válida (o que for visível com os valores dados). */
function completo(extra: Respostas = {}): Respostas {
  const r: Respostas = { resp2_existe: "Não", ...extra };
  for (const c of TODOS_CAMPOS) {
    if (r[c.id] !== undefined) continue;
    if (c.tipo === "multipla") r[c.id] = [c.opcoes![0]!];
    else if (c.tipo === "simnao" || c.tipo === "escolha") r[c.id] = c.opcoes![0]!;
    else if (c.tipo === "data") r[c.id] = "2019-05-10";
    else if (c.formato === "email") r[c.id] = "mae@exemplo.com";
    else if (c.formato === "telefone") r[c.id] = "(11) 98888-7777";
    else if (c.formato === "cpf") continue;
    else r[c.id] = "Resposta";
  }
  return r;
}

describe("formulário de avaliação inicial (anamnese)", () => {
  it("tem as 17 partes do modelo da clínica", () => {
    expect(SECOES_ANAMNESE).toHaveLength(17);
  });
  it("ids das perguntas são únicos", () => {
    expect(new Set(TODOS_CAMPOS.map((c) => c.id)).size).toBe(TODOS_CAMPOS.length);
  });
  it("todas as perguntas são obrigatórias, salvo as poucas marcadas como opcionais", () => {
    expect(TODOS_CAMPOS.filter((c) => c.opcional).map((c) => c.id).sort()).toEqual(
      ["crianca_cpf", "prioridades_4", "prioridades_5", "rede_10", "rede_4"].sort(),
    );
  });
  it("formulário completo é aceito", () => {
    expect(validarAnamnese(completo()).ok).toBe(true);
  });
  it("pergunta obrigatória vazia impede o envio e aponta a parte", () => {
    const r = completo();
    delete r["motivo_1"];
    const v = validarAnamnese(r);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.secao).toBe(2);
      expect(v.erros["motivo_1"]).toBeTruthy();
    }
  });
  it("só espaços conta como vazio", () => {
    expect(validarAnamnese(completo({ motivo_1: "   " })).ok).toBe(false);
  });
  it("dados do 2º responsável só são exigidos quando há segundo responsável", () => {
    expect(validarAnamnese(completo({ resp2_existe: "Não" })).ok).toBe(true);
    const r = completo({ resp2_existe: "Sim" });
    const campos = TODOS_CAMPOS.filter((c) => c.dependeDe);
    for (const c of campos) delete r[c.id];
    expect(validarAnamnese(r).ok).toBe(false);
  });
  it("respostas do 2º responsável escondido não são gravadas", () => {
    const v = validarAnamnese(completo({ resp2_existe: "Não", resp2_nome: "Fulano" }));
    expect(v.ok && v.respostas["resp2_nome"]).toBe(false);
  });
  it("confere e-mail, telefone com DDD, CPF e opções", () => {
    const campo = (id: string) => TODOS_CAMPOS.find((c) => c.id === id)!;
    expect(erroDoCampo(campo("resp1_email"), { resp1_email: "sem-arroba" })).toMatch(/E-mail/);
    expect(erroDoCampo(campo("resp1_telefone"), { resp1_telefone: "98888-7777" })).toMatch(/DDD/);
    expect(erroDoCampo(campo("crianca_cpf"), { crianca_cpf: "111.111.111-11" })).toMatch(/CPF/);
    expect(erroDoCampo(campo("crianca_cpf"), {})).toBeNull();
    expect(erroDoCampo(campo("identificacao_11"), { identificacao_11: "Noite" })).toMatch(/opções/);
  });
  it("data de nascimento no futuro não é aceita", () => {
    const c = TODOS_CAMPOS.find((x) => x.id === "crianca_nascimento")!;
    expect(erroDoCampo(c, { crianca_nascimento: "2099-01-01" }, "2026-10-30")).toMatch(/futuro/);
  });
  it("pré-preenche com os dados da ficha da clínica", () => {
    const r = preencherDaFicha({ nome: "Léo Lima", endereco: "Rua A", numero: "10", cidade: "Recife", uf: "PE", responsavel2_nome: "João" });
    expect(r["crianca_nome"]).toBe("Léo Lima");
    expect(r["crianca_endereco"]).toBe("Rua A, 10");
    expect(r["crianca_cidade"]).toBe("Recife/PE");
    expect(r["resp2_existe"]).toBe("Sim");
  });
});
