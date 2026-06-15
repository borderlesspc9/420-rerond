export interface DadosExtraidosAnalise {
  rodovia?: string | null;
  kilometragem?: string | null;
  municipio?: string | null;
  uf?: string | null;
  interessado?: string | null;
  numeroArt?: string | null;
  responsavelTecnico?: string | null;
  extensao?: string | null;
  tipoIntervencao?: string | null;
}

export interface ConferenciaInput {
  campo: string;
  valorFormulario?: string | null;
  valorDocumento?: string | null;
  status: "COMPATIVEL" | "DIVERGENTE" | "AUSENTE_NO_DOCUMENTO" | "AUSENTE_NO_FORMULARIO";
  observacao?: string;
}

export interface DadosFormConferencia {
  interessado?: string | null;
  rodovia?: string | null;
  kilometragem?: string | null;
  municipioEstado?: string | null;
  uf?: string | null;
  extensao?: string | null;
  numeroArt?: string | null;
  responsavelTecnico?: string | null;
  tipoIntervencaoDetalhado?: string | null;
}

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

export function normalizeRodovia(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
  const match = normalized.match(/BR(\d{3})/);
  return match ? `BR${match[1]}` : normalized || null;
}

export function normalizeKm(value?: string | null): number | null {
  if (!value) return null;
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

function normalizeText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function kmCompatible(a?: string | null, b?: string | null): boolean {
  const na = normalizeKm(a);
  const nb = normalizeKm(b);
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) < 0.001;
}

function municipioCompatible(form?: string | null, doc?: string | null): boolean {
  const f = normalizeText(form)?.toLowerCase();
  const d = normalizeText(doc)?.toLowerCase();
  if (!f || !d) return false;
  return f.includes(d) || d.includes(f);
}

function textCompatible(a?: string | null, b?: string | null): boolean {
  const na = normalizeText(a)?.toLowerCase();
  const nb = normalizeText(b)?.toLowerCase();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function buildConferenciaItem(
  campo: string,
  valorFormulario?: string | null,
  valorDocumento?: string | null,
  comparar?: (form?: string | null, doc?: string | null) => boolean,
): ConferenciaInput | null {
  const form = normalizeText(valorFormulario);
  const doc = normalizeText(valorDocumento);

  if (!form && !doc) return null;
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

function isCampoExcluido(campo: string): boolean {
  return CAMPOS_EXCLUIDOS_CONFERENCIA.has(campo.trim().toLowerCase());
}

function isCampoGerenciado(campo: string): boolean {
  const key = campo.trim().toLowerCase().replace(/\s+/g, "");
  return CAMPOS_GERENCIADOS.has(key);
}

function sanitizeConferenciaItem(item: ConferenciaInput): ConferenciaInput {
  const form = normalizeText(item.valorFormulario);
  const doc = normalizeText(item.valorDocumento);

  if (form && doc && form === doc) {
    return {
      ...item,
      valorFormulario: form,
      valorDocumento: null,
      status: "AUSENTE_NO_DOCUMENTO",
      observacao:
        "valorDocumento igual ao formulário sem evidência independente nos PDFs — tratado como ausente no documento.",
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

export function complementarConferenciaDeterministica(
  conferenciaInputs: ConferenciaInput[],
  dadosForm: DadosFormConferencia,
  dadosExtraidos: DadosExtraidosAnalise | null,
): ConferenciaInput[] {
  const extras = conferenciaInputs
    .filter((item) => !isCampoExcluido(item.campo) && !isCampoGerenciado(item.campo))
    .map(sanitizeConferenciaItem);

  if (!dadosExtraidos) return extras;

  const deterministicos: ConferenciaInput[] = [];

  const pushItem = (item: ConferenciaInput | null) => {
    if (item) deterministicos.push(item);
  };

  pushItem(
    buildConferenciaItem(
      "interessado",
      dadosForm.interessado,
      dadosExtraidos.interessado,
      textCompatible,
    ),
  );
  pushItem(
    buildConferenciaItem(
      "rodovia",
      dadosForm.rodovia,
      dadosExtraidos.rodovia,
      (form, doc) => normalizeRodovia(form) === normalizeRodovia(doc),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "kilometragem",
      dadosForm.kilometragem,
      dadosExtraidos.kilometragem,
      (form, doc) => kmCompatible(form, doc),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "municipio",
      dadosForm.municipioEstado,
      dadosExtraidos.municipio,
      municipioCompatible,
    ),
  );
  pushItem(
    buildConferenciaItem("uf", dadosForm.uf, dadosExtraidos.uf, textCompatible),
  );
  pushItem(
    buildConferenciaItem(
      "extensao",
      dadosForm.extensao,
      dadosExtraidos.extensao,
      textCompatible,
    ),
  );
  pushItem(
    buildConferenciaItem(
      "numeroArt",
      dadosForm.numeroArt,
      dadosExtraidos.numeroArt,
      textCompatible,
    ),
  );
  pushItem(
    buildConferenciaItem(
      "responsavelTecnico",
      dadosForm.responsavelTecnico,
      dadosExtraidos.responsavelTecnico,
      textCompatible,
    ),
  );
  pushItem(
    buildConferenciaItem(
      "tipoIntervencao",
      dadosForm.tipoIntervencaoDetalhado,
      dadosExtraidos.tipoIntervencao,
      textCompatible,
    ),
  );

  return [...deterministicos, ...extras];
}
