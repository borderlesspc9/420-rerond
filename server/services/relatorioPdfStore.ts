import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "./firebaseAdmin.js";

export type RelatorioPdfRecord = {
  id: string;
  solicitacaoId: string;
  identificadorRelatorio: string;
  versao: number;
  fileName: string;
  storagePath: string;
  downloadUrl: string;
  geradoEm: Date;
  geradoPorUid: string | null;
  geradoPorNome: string | null;
  nomeConcessionaria: string;
  nomeProjeto: string;
  percentualConformidade: number;
  statusGeral: string;
  metadadosApresentacao: Record<string, unknown>;
  /** Snapshot do resultado original da IA no momento da geração */
  resultadoOriginalIa: Record<string, unknown> | null;
};

const COLLECTION =
  process.env.FIRESTORE_SOLICITACOES_COLLECTION?.trim() || "solicitacoes";

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
};

export const relatorioPdfStore = {
  async listBySolicitacao(solicitacaoId: string): Promise<RelatorioPdfRecord[]> {
    const snap = await firestore
      .collection(COLLECTION)
      .doc(solicitacaoId)
      .collection("relatoriosPdf")
      .orderBy("geradoEm", "desc")
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        solicitacaoId,
        identificadorRelatorio: String(data.identificadorRelatorio ?? ""),
        versao: Number(data.versao ?? 1),
        fileName: String(data.fileName ?? ""),
        storagePath: String(data.storagePath ?? ""),
        downloadUrl: String(data.downloadUrl ?? ""),
        geradoEm: toDate(data.geradoEm),
        geradoPorUid: data.geradoPorUid ? String(data.geradoPorUid) : null,
        geradoPorNome: data.geradoPorNome ? String(data.geradoPorNome) : null,
        nomeConcessionaria: String(data.nomeConcessionaria ?? ""),
        nomeProjeto: String(data.nomeProjeto ?? ""),
        percentualConformidade: Number(data.percentualConformidade ?? 0),
        statusGeral: String(data.statusGeral ?? ""),
        metadadosApresentacao: (data.metadadosApresentacao as Record<string, unknown>) ?? {},
        resultadoOriginalIa: (data.resultadoOriginalIa as Record<string, unknown>) ?? null,
      };
    });
  },

  async getNextVersion(solicitacaoId: string): Promise<number> {
    const existing = await this.listBySolicitacao(solicitacaoId);
    if (existing.length === 0) return 1;
    return Math.max(...existing.map((r) => r.versao)) + 1;
  },

  async create(
    solicitacaoId: string,
    data: Omit<RelatorioPdfRecord, "id" | "solicitacaoId" | "geradoEm"> & {
      geradoEm?: Date;
    },
  ): Promise<RelatorioPdfRecord> {
    const id = randomUUID();
    const geradoEm = data.geradoEm ?? new Date();
    const payload = {
      ...data,
      geradoEm,
      createdAt: FieldValue.serverTimestamp(),
    };
    await firestore
      .collection(COLLECTION)
      .doc(solicitacaoId)
      .collection("relatoriosPdf")
      .doc(id)
      .set(payload);

    return {
      id,
      solicitacaoId,
      ...data,
      geradoEm,
    };
  },

  async findById(
    solicitacaoId: string,
    reportId: string,
  ): Promise<RelatorioPdfRecord | null> {
    const snap = await firestore
      .collection(COLLECTION)
      .doc(solicitacaoId)
      .collection("relatoriosPdf")
      .doc(reportId)
      .get();

    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    return {
      id: snap.id,
      solicitacaoId,
      identificadorRelatorio: String(data.identificadorRelatorio ?? ""),
      versao: Number(data.versao ?? 1),
      fileName: String(data.fileName ?? ""),
      storagePath: String(data.storagePath ?? ""),
      downloadUrl: String(data.downloadUrl ?? ""),
      geradoEm: toDate(data.geradoEm),
      geradoPorUid: data.geradoPorUid ? String(data.geradoPorUid) : null,
      geradoPorNome: data.geradoPorNome ? String(data.geradoPorNome) : null,
      nomeConcessionaria: String(data.nomeConcessionaria ?? ""),
      nomeProjeto: String(data.nomeProjeto ?? ""),
      percentualConformidade: Number(data.percentualConformidade ?? 0),
      statusGeral: String(data.statusGeral ?? ""),
      metadadosApresentacao: (data.metadadosApresentacao as Record<string, unknown>) ?? {},
      resultadoOriginalIa: (data.resultadoOriginalIa as Record<string, unknown>) ?? null,
    };
  },
};
