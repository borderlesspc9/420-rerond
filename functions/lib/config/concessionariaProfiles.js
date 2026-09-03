"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveConcessionariaPromptProfile = resolveConcessionariaPromptProfile;
exports.isProfileConcessionaria = isProfileConcessionaria;
exports.getProfileTipoProjetoNome = getProfileTipoProjetoNome;
exports.buildProfileSystemPrompt = buildProfileSystemPrompt;
exports.buildProfileAnalysisPrompt = buildProfileAnalysisPrompt;
const eco101_prompt_1 = require("./eco101.prompt");
const motiva_prompt_1 = require("./motiva.prompt");
const arteris_prompt_1 = require("./arteris.prompt");
const prompts_1 = require("./prompts");
function resolveConcessionariaPromptProfile(concessionariaId) {
    if ((0, eco101_prompt_1.isEco101Concessionaria)(concessionariaId))
        return "eco101";
    if ((0, motiva_prompt_1.isMotivaConcessionaria)(concessionariaId))
        return "motiva";
    if ((0, arteris_prompt_1.isArterisConcessionaria)(concessionariaId))
        return "arteris";
    return "default";
}
function isProfileConcessionaria(concessionariaId) {
    return resolveConcessionariaPromptProfile(concessionariaId) !== "default";
}
function getProfileTipoProjetoNome(profile) {
    if (profile === "eco101")
        return "Ecovias / ECO101 — Ocupação em Faixa de Domínio";
    if (profile === "motiva")
        return "Motiva — Ocupação em Faixa de Domínio";
    if (profile === "arteris")
        return "Arteris — PIT / Ocupação em Faixa de Domínio";
    return null;
}
function buildProfileSystemPrompt(profile) {
    if (profile === "eco101")
        return (0, eco101_prompt_1.buildEco101SystemPrompt)();
    if (profile === "motiva")
        return (0, motiva_prompt_1.buildMotivaSystemPrompt)();
    if (profile === "arteris")
        return (0, arteris_prompt_1.buildArterisSystemPrompt)();
    return (0, prompts_1.buildSystemPrompt)();
}
function buildProfileAnalysisPrompt(params) {
    const { profile, dados, requisitosFormatados, tiposAnalise, tiposProjetoNome, escopo, promptCustomizado, contextoRevisaoAnterior, } = params;
    let base;
    if (profile === "eco101") {
        base = (0, eco101_prompt_1.buildEco101AnalysisPrompt)(dados, requisitosFormatados, escopo, promptCustomizado);
    }
    else if (profile === "motiva") {
        base = (0, motiva_prompt_1.buildMotivaAnalysisPrompt)(dados, requisitosFormatados, escopo, promptCustomizado);
    }
    else if (profile === "arteris") {
        base = (0, arteris_prompt_1.buildArterisAnalysisPrompt)(dados, requisitosFormatados, escopo, promptCustomizado);
    }
    else {
        base = (0, prompts_1.buildAnalysisPrompt)(dados, tiposAnalise, requisitosFormatados, tiposProjetoNome, escopo, promptCustomizado);
    }
    const contexto = contextoRevisaoAnterior?.trim();
    if (!contexto)
        return base;
    return `${base}

═══════════════════════════════════════
CONTEXTO DA REVISÃO ANTERIOR DO MESMO PROCESSO
═══════════════════════════════════════
${contexto}

INSTRUÇÕES DE CONTINUIDADE (OBRIGATÓRIAS NESTA REVISÃO):
1. Priorize verificar se as pendências e não conformidades da revisão anterior foram corrigidas nos documentos atuais.
2. Para cada pendência anterior: indique explicitamente se foi resolvida, parcialmente resolvida ou permanece.
3. Continúe detectando novas inconformidades ou ausências na versão atual — não se limite às pendências antigas.
4. Não trate esta revisão como um processo isolado: use o histórico acima como referência, mas avalie o conteúdo atual dos PDFs.`;
}
//# sourceMappingURL=concessionariaProfiles.js.map