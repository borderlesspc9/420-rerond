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

export interface EvidenciaConferencia {
  arquivo?: string;
  pagina?: string | null;
  trecho?: string | null;
}

export interface ConferenciaInput {
  campo: string;
  valorFormulario?: string | null;
  valorDocumento?: string | null;
  status: "COMPATIVEL" | "DIVERGENTE" | "AUSENTE_NO_DOCUMENTO" | "AUSENTE_NO_FORMULARIO";
  observacao?: string;
  evidencia?: EvidenciaConferencia;
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

function formatObservacao(
  status: ConferenciaInput["status"],
  form: string | null,
  doc: string | null,
): string {
  if (status === "COMPATIVEL") return "Valores compatíveis após normalização.";
  if (status === "DIVERGENTE") {
    return `Divergência entre formulário e documento. Formulário: ${form} · Documento: ${doc}.`;
  }
  if (status === "AUSENTE_NO_DOCUMENTO") {
    return `Valor informado no formulário, não localizado nos documentos. Formulário: ${form}.`;
  }
  return `Valor encontrado no documento, ausente no formulário. Documento: ${doc}.`;
}

export function parseEvidencia(raw: unknown): EvidenciaConferencia | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const arquivo = obj.arquivo != null ? String(obj.arquivo).trim() : "";
  const pagina = obj.pagina != null ? String(obj.pagina).trim() : "";
  const trecho = obj.trecho != null ? String(obj.trecho).trim() : "";
  if (!arquivo && !pagina && !trecho) return undefined;
  return {
    arquivo: arquivo || undefined,
    pagina: pagina || null,
    trecho: trecho || null,
  };
}

function evidenciaByCampo(
  conferenciaInputs: ConferenciaInput[],
  campo: string,
): EvidenciaConferencia | undefined {
  const key = campo.trim().toLowerCase();
  const match = conferenciaInputs.find((item) => item.campo.trim().toLowerCase() === key);
  return match?.evidencia;
}

function buildConferenciaItem(
  campo: string,
  valorFormulario?: string | null,
  valorDocumento?: string | null,
  comparar?: (form?: string | null, doc?: string | null) => boolean,
  evidencia?: EvidenciaConferencia,
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
      observacao: formatObservacao("AUSENTE_NO_FORMULARIO", null, doc),
      evidencia,
    };
  }
  if (!doc) {
    return {
      campo,
      valorFormulario: form,
      valorDocumento: null,
      status: "AUSENTE_NO_DOCUMENTO",
      observacao: formatObservacao("AUSENTE_NO_DOCUMENTO", form, null),
      evidencia,
    };
  }

  const compativel = comparar ? comparar(form, doc) : form.toLowerCase() === doc.toLowerCase();
  const status = compativel ? "COMPATIVEL" : "DIVERGENTE";
  return {
    campo,
    valorFormulario: form,
    valorDocumento: doc,
    status,
    observacao: formatObservacao(status, form, doc),
    evidencia,
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
  const evidencia = parseEvidencia(item.evidencia);

  if (form && doc && form === doc && !evidencia?.arquivo) {
    return {
      ...item,
      valorFormulario: form,
      valorDocumento: null,
      status: "AUSENTE_NO_DOCUMENTO",
      observacao:
        "valorDocumento igual ao formulário sem evidência independente nos PDFs — tratado como ausente no documento.",
      evidencia,
    };
  }

  if (form && !doc && item.status !== "AUSENTE_NO_DOCUMENTO") {
    return {
      ...item,
      valorFormulario: form,
      valorDocumento: null,
      status: "AUSENTE_NO_DOCUMENTO",
      observacao: formatObservacao("AUSENTE_NO_DOCUMENTO", form, null),
      evidencia,
    };
  }

  return {
    ...item,
    valorFormulario: form,
    valorDocumento: doc,
    evidencia,
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
      evidenciaByCampo(conferenciaInputs, "interessado"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "rodovia",
      dadosForm.rodovia,
      dadosExtraidos.rodovia,
      (form, doc) => normalizeRodovia(form) === normalizeRodovia(doc),
      evidenciaByCampo(conferenciaInputs, "rodovia"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "kilometragem",
      dadosForm.kilometragem,
      dadosExtraidos.kilometragem,
      (form, doc) => kmCompatible(form, doc),
      evidenciaByCampo(conferenciaInputs, "kilometragem"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "municipio",
      dadosForm.municipioEstado,
      dadosExtraidos.municipio,
      municipioCompatible,
      evidenciaByCampo(conferenciaInputs, "municipio"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "uf",
      dadosForm.uf,
      dadosExtraidos.uf,
      textCompatible,
      evidenciaByCampo(conferenciaInputs, "uf"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "extensao",
      dadosForm.extensao,
      dadosExtraidos.extensao,
      textCompatible,
      evidenciaByCampo(conferenciaInputs, "extensao"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "numeroArt",
      dadosForm.numeroArt,
      dadosExtraidos.numeroArt,
      textCompatible,
      evidenciaByCampo(conferenciaInputs, "numeroArt"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "responsavelTecnico",
      dadosForm.responsavelTecnico,
      dadosExtraidos.responsavelTecnico,
      textCompatible,
      evidenciaByCampo(conferenciaInputs, "responsavelTecnico"),
    ),
  );
  pushItem(
    buildConferenciaItem(
      "tipoIntervencao",
      dadosForm.tipoIntervencaoDetalhado,
      dadosExtraidos.tipoIntervencao,
      textCompatible,
      evidenciaByCampo(conferenciaInputs, "tipoIntervencao"),
    ),
  );

  return [...deterministicos, ...extras];
}
