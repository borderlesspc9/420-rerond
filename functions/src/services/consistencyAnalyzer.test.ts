import { describe, expect, it } from "vitest";
import {
  complementarConferenciaDeterministica,
  normalizeRodovia,
  parseEvidencia,
} from "./consistencyAnalyzer";

describe("normalizeRodovia", () => {
  it("trata BR-101 e BR101 como equivalentes", () => {
    expect(normalizeRodovia("BR-101")).toBe(normalizeRodovia("BR101"));
    expect(normalizeRodovia("BR 101")).toBe("BR101");
  });
});

describe("complementarConferenciaDeterministica", () => {
  it("marca kilometragem divergente com observação Formulário × Documento", () => {
    const result = complementarConferenciaDeterministica(
      [],
      {
        rodovia: "BR-101",
        kilometragem: "KM 10+000",
      },
      {
        rodovia: "BR101",
        kilometragem: "KM 12+500",
      },
    );

    const km = result.find((item) => item.campo === "kilometragem");
    expect(km?.status).toBe("DIVERGENTE");
    expect(km?.observacao).toContain("Formulário: KM 10+000");
    expect(km?.observacao).toContain("Documento: KM 12+500");

    const rodovia = result.find((item) => item.campo === "rodovia");
    expect(rodovia?.status).toBe("COMPATIVEL");
  });

  it("marca valor só no formulário como AUSENTE_NO_DOCUMENTO", () => {
    const result = complementarConferenciaDeterministica(
      [],
      { numeroArt: "ES20240012345" },
      { numeroArt: null },
    );

    const art = result.find((item) => item.campo === "numeroArt");
    expect(art?.status).toBe("AUSENTE_NO_DOCUMENTO");
    expect(art?.valorDocumento).toBeNull();
    expect(art?.observacao).toContain("Formulário: ES20240012345");
  });

  it("preserva evidencia da IA no campo determinístico", () => {
    const result = complementarConferenciaDeterministica(
      [
        {
          campo: "rodovia",
          valorFormulario: "BR-101",
          valorDocumento: "BR-101",
          status: "COMPATIVEL",
          evidencia: { arquivo: "Memorial.pdf", pagina: "3", trecho: "BR-101" },
        },
      ],
      { rodovia: "BR-101" },
      { rodovia: "BR-101" },
    );

    const rodovia = result.find((item) => item.campo === "rodovia");
    expect(rodovia?.evidencia?.arquivo).toBe("Memorial.pdf");
    expect(rodovia?.evidencia?.pagina).toBe("3");
  });
});

describe("parseEvidencia", () => {
  it("ignora objeto vazio", () => {
    expect(parseEvidencia({})).toBeUndefined();
  });

  it("normaliza arquivo e página", () => {
    expect(parseEvidencia({ arquivo: " planta.pdf ", pagina: "2" })).toEqual({
      arquivo: "planta.pdf",
      pagina: "2",
      trecho: null,
    });
  });
});
