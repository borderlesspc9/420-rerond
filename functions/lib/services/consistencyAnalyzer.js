"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRodovia = normalizeRodovia;
exports.normalizeKm = normalizeKm;
exports.complementarConferenciaDeterministica = complementarConferenciaDeterministica;
const CAMPOS_EXCLUIDOS_CONFERENCIA = new Set(["cliente"]);
const CAMPOS_GERENCIADOS = new Set([
    "interessado",
    "rodovia",
    "kilometragem",
    "municipio",
    "uf",
    "extensao",
    "numeroart",
    "responsaveltecnico",
    "tipointervencao",
]);
function normalizeRodovia(value) {
    if (!value)
        return null;
    const normalized = value
        .toUpperCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "");
    const match = normalized.match(/BR(\d{3})/);
    return match ? `BR${match[1]}` : normalized || null;
}
function normalizeKm(value) {
    if (!value)
        return null;
    const upper = value.toUpperCase();
    const match = upper.match(/(\d{1,3})\s*\+\s*(\d{1,3})/);
    if (match) {
        const km = Number(match[1]);
        const metros = Number(match[2]);
        if (Number.isFinite(km) && Number.isFinite(metros)) {
            return km + metros / 1000;
        }
    }
    const simple = upper.match(/KM\s*(\d+(?:[.,]\d+)?)/);
    if (simple) {
        return Number(simple[1].replace(",", "."));
    }
    return null;
}
function normalizeText(value) {
    const trimmed = value?.trim();
    return trimmed || null;
}
function kmCompatible(a, b) {
    const na = normalizeKm(a);
    const nb = normalizeKm(b);
    if (na === null || nb === null)
        return false;
    return Math.abs(na - nb) < 0.001;
}
function municipioCompatible(form, doc) {
    const f = normalizeText(form)?.toLowerCase();
    const d = normalizeText(doc)?.toLowerCase();
    if (!f || !d)
        return false;
    return f.includes(d) || d.includes(f);
}
function textCompatible(a, b) {
    const na = normalizeText(a)?.toLowerCase();
    const nb = normalizeText(b)?.toLowerCase();
    if (!na || !nb)
        return false;
    return na === nb || na.includes(nb) || nb.includes(na);
}
function buildConferenciaItem(campo, valorFormulario, valorDocumento, comparar) {
    const form = normalizeText(valorFormulario);
    const doc = normalizeText(valorDocumento);
    if (!form && !doc)
        return null;
    if (!form) {
        return {
            campo,
            valorFormulario: null,
            valorDocumento: doc,
            status: "AUSENTE_NO_FORMULARIO",
            observacao: "Valor encontrado no documento, ausente no formulário.",
        };
    }
    if (!doc) {
        return {
            campo,
            valorFormulario: form,
            valorDocumento: null,
            status: "AUSENTE_NO_DOCUMENTO",
            observacao: "Valor informado no formulário, não localizado nos documentos.",
        };
    }
    const compativel = comparar ? comparar(form, doc) : form.toLowerCase() === doc.toLowerCase();
    return {
        campo,
        valorFormulario: form,
        valorDocumento: doc,
        status: compativel ? "COMPATIVEL" : "DIVERGENTE",
        observacao: compativel
            ? "Valores compatíveis após normalização."
            : "Divergência entre formulário e documento.",
    };
}
function isCampoExcluido(campo) {
    return CAMPOS_EXCLUIDOS_CONFERENCIA.has(campo.trim().toLowerCase());
}
function isCampoGerenciado(campo) {
    const key = campo.trim().toLowerCase().replace(/\s+/g, "");
    return CAMPOS_GERENCIADOS.has(key);
}
function sanitizeConferenciaItem(item) {
    const form = normalizeText(item.valorFormulario);
    const doc = normalizeText(item.valorDocumento);
    if (form && doc && form === doc) {
        return {
            ...item,
            valorFormulario: form,
            valorDocumento: null,
            status: "AUSENTE_NO_DOCUMENTO",
            observacao: "valorDocumento igual ao formulário sem evidência independente nos PDFs — tratado como ausente no documento.",
        };
    }
    if (form && !doc && item.status !== "AUSENTE_NO_DOCUMENTO") {
        return {
            ...item,
            valorFormulario: form,
            valorDocumento: null,
            status: "AUSENTE_NO_DOCUMENTO",
            observacao: "Valor não localizado nos documentos.",
        };
    }
    return {
        ...item,
        valorFormulario: form,
        valorDocumento: doc,
    };
}
function complementarConferenciaDeterministica(conferenciaInputs, dadosForm, dadosExtraidos) {
    const extras = conferenciaInputs
        .filter((item) => !isCampoExcluido(item.campo) && !isCampoGerenciado(item.campo))
        .map(sanitizeConferenciaItem);
    if (!dadosExtraidos)
        return extras;
    const deterministicos = [];
    const pushItem = (item) => {
        if (item)
            deterministicos.push(item);
    };
    pushItem(buildConferenciaItem("interessado", dadosForm.interessado, dadosExtraidos.interessado, textCompatible));
    pushItem(buildConferenciaItem("rodovia", dadosForm.rodovia, dadosExtraidos.rodovia, (form, doc) => normalizeRodovia(form) === normalizeRodovia(doc)));
    pushItem(buildConferenciaItem("kilometragem", dadosForm.kilometragem, dadosExtraidos.kilometragem, (form, doc) => kmCompatible(form, doc)));
    pushItem(buildConferenciaItem("municipio", dadosForm.municipioEstado, dadosExtraidos.municipio, municipioCompatible));
    pushItem(buildConferenciaItem("uf", dadosForm.uf, dadosExtraidos.uf, textCompatible));
    pushItem(buildConferenciaItem("extensao", dadosForm.extensao, dadosExtraidos.extensao, textCompatible));
    pushItem(buildConferenciaItem("numeroArt", dadosForm.numeroArt, dadosExtraidos.numeroArt, textCompatible));
    pushItem(buildConferenciaItem("responsavelTecnico", dadosForm.responsavelTecnico, dadosExtraidos.responsavelTecnico, textCompatible));
    pushItem(buildConferenciaItem("tipoIntervencao", dadosForm.tipoIntervencaoDetalhado, dadosExtraidos.tipoIntervencao, textCompatible));
    return [...deterministicos, ...extras];
}
//# sourceMappingURL=consistencyAnalyzer.js.map