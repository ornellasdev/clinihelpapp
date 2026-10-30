import { describe, expect, it } from "vitest";
import { ARTIGOS, CATEGORIAS, buscarArtigos } from "./conteudo";

describe("base de conhecimento", () => {
  it("ids únicos e categorias válidas", () => {
    expect(new Set(ARTIGOS.map((a) => a.id)).size).toBe(ARTIGOS.length);
    for (const a of ARTIGOS) expect(CATEGORIAS).toContain(a.categoria);
  });
  it("busca ignora acentos e maiúsculas", () => {
    expect(buscarArtigos("LIMINAR").map((a) => a.id)).toContain("liminares");
    expect(buscarArtigos("evolucao voz").map((a) => a.id)).toContain("prontuario");
  });
  it("busca sem resultado devolve lista vazia", () => {
    expect(buscarArtigos("xyzinexistente")).toHaveLength(0);
  });
});
