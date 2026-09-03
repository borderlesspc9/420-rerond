import { describe, expect, it } from "vitest";
import { buildEco101ExemploAnaliseBlock } from "./exemplosAnalise";

describe("buildEco101ExemploAnaliseBlock", () => {
  it("injeta rigor do exemplo sem instruir copiar fatos", () => {
    const bloco = buildEco101ExemploAnaliseBlock();
    expect(bloco).toContain("EXEMPLO DE SAÍDA ESPERADA");
    expect(bloco).toContain("Não copie nomes");
    expect(bloco).toContain("INFORMACAO_AUSENTE");
    expect(bloco.length).toBeGreaterThan(200);
    expect(bloco.length).toBeLessThanOrEqual(4000);
  });
});
