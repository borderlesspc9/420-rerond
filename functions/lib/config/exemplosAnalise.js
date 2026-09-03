"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEco101ExemploAnaliseBlock = buildEco101ExemploAnaliseBlock;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MAX_CHARS = 4000;
function loadEco101Exemplo() {
    const jsonPath = path_1.default.join(__dirname, "eco101.exemplo-simulado.json");
    try {
        const raw = fs_1.default.readFileSync(jsonPath, "utf8");
        return JSON.parse(raw);
    }
    catch (error) {
        console.warn("Não foi possível carregar eco101.exemplo-simulado.json:", error);
        return null;
    }
}
function buildEco101ExemploAnaliseBlock() {
    const exemplo = loadEco101Exemplo();
    if (!exemplo)
        return "";
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
//# sourceMappingURL=exemplosAnalise.js.map