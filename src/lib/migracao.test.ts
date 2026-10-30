import { describe, expect, it } from "vitest";
import { lerCsv, lerData, modeloCsv, validarPlanilha } from "./migracao";

describe("migração de dados", () => {
  it("lê CSV com ponto e vírgula e aspas", () => {
    expect(lerCsv('nome;tipo\r\n"Uni; med";convenio\r\n')).toEqual([["nome", "tipo"], ["Uni; med", "convenio"]]);
  });

  it("converte data brasileira e rejeita data impossível", () => {
    expect(lerData("15/03/2019")).toBe("2019-03-15");
    expect(lerData("31/02/2019")).toBeNull();
  });

  it("modelo de pacientes é válido sem erros", () => {
    const { linhas } = validarPlanilha("pacientes", lerCsv(modeloCsv("pacientes")));
    expect(linhas).toHaveLength(1);
    expect(linhas[0].erros).toEqual([]);
  });

  it("aponta CPF e telefone inválidos com o número da linha", () => {
    const { linhas } = validarPlanilha("pacientes", [
      ["nome", "responsavel_cpf", "responsavel_telefone"],
      ["Ana", "111.111.111-11", "91234"],
    ]);
    expect(linhas[0].linha).toBe(2);
    expect(linhas[0].erros).toEqual(["Responsável 1: CPF inválido.", "Responsável 1: telefone sem DDD."]);
  });

  it("tipo de convênio precisa ser convenio, particular ou liminar", () => {
    const { linhas } = validarPlanilha("convenios", [["nome", "tipo"], ["X Saúde", "plano"]]);
    expect(linhas[0].erros).toHaveLength(1);
  });

  it("detecta linha repetida", () => {
    const { linhas } = validarPlanilha("convenios", [["nome"], ["Unimed"], ["Unimed"]]);
    expect(linhas[1].erros).toContain("Linha repetida no arquivo.");
  });
});
