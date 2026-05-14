"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTipoProjetoConfig = getTipoProjetoConfig;
exports.getFontesParaTipo = getFontesParaTipo;
exports.getRequisitosParaTipo = getRequisitosParaTipo;
exports.getMaxPaginas = getMaxPaginas;
exports.carregarNormaPDF = carregarNormaPDF;
exports.carregarNormasPDFParaTipo = carregarNormasPDFParaTipo;
exports.listarRequisitosFormatados = listarRequisitosFormatados;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const normas_json_1 = __importDefault(require("../config/normas.json"));
const NORMAS_PDF_DIR = path.join(__dirname, "..", "config", "normas-pdf");
function getTipoProjetoConfig(tipo) {
    const config = normas_json_1.default.tiposProjeto[tipo];
    return config ?? null;
}
function getFontesParaTipo(tipo) {
    const config = getTipoProjetoConfig(tipo);
    if (!config)
        return [];
    return normas_json_1.default.fontes.filter((f) => config.fontes.includes(f.id));
}
function getRequisitosParaTipo(tipo) {
    const config = getTipoProjetoConfig(tipo);
    return config?.requisitos ?? [];
}
function getMaxPaginas(tipo) {
    const config = getTipoProjetoConfig(tipo);
    return config?.maxPaginas ?? 10;
}
function carregarNormaPDF(normaId) {
    const fonte = normas_json_1.default.fontes.find((f) => f.id === normaId);
    if (!fonte) {
        throw new Error(`Norma não encontrada no catálogo: ${normaId}`);
    }
    const pdfPath = path.join(NORMAS_PDF_DIR, fonte.pdf);
    if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF da norma não encontrado: ${pdfPath}`);
    }
    return fs.readFileSync(pdfPath);
}
function carregarNormasPDFParaTipo(tipo) {
    const fontes = getFontesParaTipo(tipo);
    return fontes.map((fonte) => ({
        fonte,
        buffer: carregarNormaPDF(fonte.id),
    }));
}
function listarRequisitosFormatados(tipo) {
    const requisitos = getRequisitosParaTipo(tipo);
    if (requisitos.length === 0)
        return "Nenhum requisito configurado.";
    return requisitos
        .map((r) => `- ${r.id}: ${r.descricao}`)
        .join("\n");
}
//# sourceMappingURL=normasService.js.map