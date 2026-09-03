import fs from "fs";
import path from "path";

const MAX_CHARS = 4000;

type ExemploEco101 = {
  cenario?: string;
  conclusao_global?: string;
  trechos_parecer_simulados?: Record<
    string,
    { conclusao?: string; analise_resumo?: string; checklist_status?: string }
  >;
  checklist_amostra?: Array<{
    item?: string;
    status?: string;
    situacaoEncontrada?: string;
    orientacao?: string;
  }>;
};

function loadEco101Exemplo(): ExemploEco101 | null {
  const jsonPath = path.join(__dirname, "eco101.exemplo-simulado.json");
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    return JSON.parse(raw) as ExemploEco101;
  } catch (error) {
    console.warn("Não foi possível carregar eco101.exemplo-simulado.json:", error);
    return null;
  }
}

export function buildEco101ExemploAnaliseBlock(): string {
  const exemplo = loadEco101Exemplo();
  if (!exemplo) return "";

  const trechos = Object.entries(exemplo.trechos_parecer_simulados ?? {})
    .slice(0, 3)
    .map(([chave, valor]) => {
      return [
        `- ${chave}: conclusão "${valor.conclusao ?? ""}" → checklist ${valor.checklist_status ?? ""}`,
        `  ${valor.analise_resumo ?? ""}`,
      ].join("\n");
    })
    .join("\n");

  const checklist = (exemplo.checklist_amostra ?? [])
    .slice(0, 3)
    .map((item) => {
      return `- ${item.item}: ${item.status} — ${item.situacaoEncontrada ?? ""} Orientação: ${item.orientacao ?? ""}`;
    })
    .join("\n");

  const bloco = `EXEMPLO DE SAÍDA ESPERADA (ECO101 — copie o RIGOR, não os fatos deste cenário):
Cenário ilustrativo: ${exemplo.cenario ?? "exemplo interno"}
Conclusão ilustrativa: ${exemplo.conclusao_global ?? ""}

Trechos de parecer (padrão de redação):
${trechos || "(sem trechos)"}

Amostra de checklist:
${checklist || "(sem amostra)"}

Regras ao usar este exemplo:
- Não copie nomes, km, ART, municípios ou conclusões do exemplo.
- Replique a diferenciação INFORMACAO_AUSENTE vs NAO_CONFORME e a exigência de evidência no PDF.`;

  return bloco.slice(0, MAX_CHARS);
}
