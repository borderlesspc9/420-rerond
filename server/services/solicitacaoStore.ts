import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebaseAdmin.js";

export type SolicitacaoRecord = {
  id: string;
  titulo: string;
  tipoObra: string;
  localizacao: string;
  descricao: string;
  status: string;
  arquivos: string | null;
  relatorioIA: string | null;
  analisadoPorIA: boolean;
  analisadoEm: Date | null;
  createdBy: string | null;
  cliente: string | null;
  kilometragem: string | null;
  nroProcessoErp: string | null;
  rodovia: string | null;
  nomeConcessionaria: string | null;
  sentido: string | null;
  ocupacao: string | null;
  municipioEstado: string | null;
  ocupacaoArea: string | null;
  responsavelTecnico: string | null;
  faseProjeto: string | null;
  analistaResponsavel: string | null;
  memorial: string | null;
  dataRecebimento: string | null;
  numeroRevisao: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateSolicitacaoInput = Omit<SolicitacaoRecord, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type UpdateSolicitacaoInput = Partial<Omit<SolicitacaoRecord, "id" | "createdAt" | "updatedAt">>;

const COLLECTION_NAME =
  process.env.FIRESTORE_SOLICITACOES_COLLECTION?.trim() || "solicitacoes";
const collectionRef = firestore.collection(COLLECTION_NAME);

const optionalNullStringFields: Array<keyof SolicitacaoRecord> = [
  "arquivos",
  "relatorioIA",
  "createdBy",
  "cliente",
  "kilometragem",
  "nroProcessoErp",
  "rodovia",
  "nomeConcessionaria",
  "sentido",
  "ocupacao",
  "municipioEstado",
  "ocupacaoArea",
  "responsavelTecnico",
  "faseProjeto",
  "analistaResponsavel",
  "memorial",
  "dataRecebimento",
  "numeroRevisao",
];

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const maybeTimestamp = value as { toDate: () => Date };
    return maybeTimestamp.toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const ensureNullableString = (value: unknown): string | null => {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
};

const normalizeRecord = (id: string, rawData: Record<string, unknown>): SolicitacaoRecord => {
  const createdAt = toDate(rawData.createdAt) ?? new Date();
  const updatedAt = toDate(rawData.updatedAt) ?? createdAt;

  const record: SolicitacaoRecord = {
    id,
    titulo: String(rawData.titulo ?? ""),
    tipoObra: String(rawData.tipoObra ?? ""),
    localizacao: String(rawData.localizacao ?? ""),
    descricao: String(rawData.descricao ?? ""),
    status: String(rawData.status ?? "pendente"),
    arquivos: ensureNullableString(rawData.arquivos),
    relatorioIA: ensureNullableString(rawData.relatorioIA),
    analisadoPorIA: Boolean(rawData.analisadoPorIA),
    analisadoEm: toDate(rawData.analisadoEm),
    createdBy: ensureNullableString(rawData.createdBy),
    cliente: ensureNullableString(rawData.cliente),
    kilometragem: ensureNullableString(rawData.kilometragem),
    nroProcessoErp: ensureNullableString(rawData.nroProcessoErp),
    rodovia: ensureNullableString(rawData.rodovia),
    nomeConcessionaria: ensureNullableString(rawData.nomeConcessionaria),
    sentido: ensureNullableString(rawData.sentido),
    ocupacao: ensureNullableString(rawData.ocupacao),
    municipioEstado: ensureNullableString(rawData.municipioEstado),
    ocupacaoArea: ensureNullableString(rawData.ocupacaoArea),
    responsavelTecnico: ensureNullableString(rawData.responsavelTecnico),
    faseProjeto: ensureNullableString(rawData.faseProjeto),
    analistaResponsavel: ensureNullableString(rawData.analistaResponsavel),
    memorial: ensureNullableString(rawData.memorial),
    dataRecebimento: ensureNullableString(rawData.dataRecebimento),
    numeroRevisao: ensureNullableString(rawData.numeroRevisao),
    createdAt,
    updatedAt,
  };

  return record;
};

const removeUndefinedFields = (raw: Record<string, unknown>) => {
  return Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined));
};

const normalizeNullableFields = (raw: Record<string, unknown>) => {
  const normalized = { ...raw };
  for (const key of optionalNullStringFields) {
    if (key in normalized) {
      normalized[key] = ensureNullableString(normalized[key]);
    }
  }
  return normalized;
};

export const solicitacaoStore = {
  async findMany(): Promise<SolicitacaoRecord[]> {
    const snapshot = await collectionRef.orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => normalizeRecord(doc.id, doc.data()));
  },

  async findUnique(id: string): Promise<SolicitacaoRecord | null> {
    const snapshot = await collectionRef.doc(id).get();
    if (!snapshot.exists) {
      return null;
    }
    return normalizeRecord(snapshot.id, snapshot.data() ?? {});
  },

  async create(data: CreateSolicitacaoInput): Promise<SolicitacaoRecord> {
    const id = data.id ?? randomUUID();
    const createdAt = data.createdAt ?? new Date();
    const updatedAt = data.updatedAt ?? createdAt;

    const payload = normalizeNullableFields(
      removeUndefinedFields({
        ...data,
        createdAt,
        updatedAt,
      }),
    );

    await collectionRef.doc(id).set(payload);
    return normalizeRecord(id, payload);
  },

  async update(id: string, data: UpdateSolicitacaoInput): Promise<SolicitacaoRecord> {
    const ref = collectionRef.doc(id);
    const existing = await ref.get();
    if (!existing.exists) {
      throw new Error(`Solicitação ${id} não encontrada`);
    }

    const payload = normalizeNullableFields(
      removeUndefinedFields({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );

    await ref.update(payload);
    const updated = await ref.get();
    return normalizeRecord(id, updated.data() ?? {});
  },

  async delete(id: string): Promise<void> {
    await collectionRef.doc(id).delete();
  },
};
