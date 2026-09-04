import { getFirestore } from "firebase-admin/firestore";

export type RequisitoPerfil = {
  id: string;
  descricao: string;
  categoria?: string;
};

export type NormaCustomFirestore = {
  id: string;
  titulo: string;
  orgao: string;
  ano?: number | null;
  descricao: string;
  arquivoNome?: string | null;
  arquivoUrl?: string | null;
  origem?: "manual" | "arquivo";
};

export type DocumentoCustomFirestore = {
  id: string;
  label: string;
  descricao?: string;
};

export type ConcessionariaPerfilFirestore = {
  id: string;
  nome: string;
  aliases: string[];
  ativo: boolean;
  promptProfile: "eco101" | "motiva" | "arteris" | "default" | "custom";
  templateId?: string | null;
  tipoProjetoPadrao: "pit" | "obra_per" | "obra_nao_per";
  normasFontes: string[];
  normasCustom?: NormaCustomFirestore[];
  modeloRelatorio: {
    tituloPadrao: string;
    descricao?: string;
    templateMarkdown: string;
  };
  documentosObrigatorios: string[];
  documentosCustom?: DocumentoCustomFirestore[];
  requisitos: RequisitoPerfil[];
  logoUrl?: string | null;
  perfilCompleto: boolean;
};

const COLLECTION =
  process.env.FIRESTORE_CONCESSIONARIAS_COLLECTION?.trim() || "concessionarias";

const profileCache = new Map<string, ConcessionariaPerfilFirestore | null>();

function parsePerfil(
  id: string,
  raw: FirebaseFirestore.DocumentData,
): ConcessionariaPerfilFirestore {
  return {
    id,
    nome: String(raw.nome ?? ""),
    aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
    ativo: raw.ativo !== false,
    promptProfile:
      raw.promptProfile === "eco101" ||
      raw.promptProfile === "motiva" ||
      raw.promptProfile === "arteris" ||
      raw.promptProfile === "custom"
        ? raw.promptProfile
        : "default",
    templateId: raw.templateId ? String(raw.templateId) : null,
    tipoProjetoPadrao:
      raw.tipoProjetoPadrao === "obra_per" || raw.tipoProjetoPadrao === "obra_nao_per"
        ? raw.tipoProjetoPadrao
        : "pit",
    normasFontes: Array.isArray(raw.normasFontes) ? raw.normasFontes.map(String) : [],
    normasCustom: Array.isArray(raw.normasCustom)
      ? (raw.normasCustom as NormaCustomFirestore[])
          .map((item) => ({
            id: String(item?.id ?? "").trim(),
            titulo: String(item?.titulo ?? "").trim(),
            orgao: String(item?.orgao ?? "").trim(),
            ano:
              typeof item?.ano === "number" && Number.isFinite(item.ano)
                ? item.ano
                : null,
            descricao: String(item?.descricao ?? "").trim(),
            arquivoNome: item?.arquivoNome ? String(item.arquivoNome) : null,
            arquivoUrl: item?.arquivoUrl ? String(item.arquivoUrl) : null,
            origem: item?.origem === "arquivo" ? "arquivo" : "manual",
          }))
          .filter((item) => item.id && item.titulo && item.orgao && item.descricao)
      : [],
    modeloRelatorio: {
      tituloPadrao: String(raw.modeloRelatorio?.tituloPadrao ?? "Parecer Técnico"),
      descricao: raw.modeloRelatorio?.descricao
        ? String(raw.modeloRelatorio.descricao)
        : undefined,
      templateMarkdown: String(raw.modeloRelatorio?.templateMarkdown ?? ""),
    },
    documentosObrigatorios: Array.isArray(raw.documentosObrigatorios)
      ? raw.documentosObrigatorios.map(String)
      : [],
    documentosCustom: Array.isArray(raw.documentosCustom)
      ? (raw.documentosCustom as DocumentoCustomFirestore[])
          .map((item) => ({
            id: String(item?.id ?? "").trim(),
            label: String(item?.label ?? "").trim(),
            descricao: item?.descricao ? String(item.descricao).trim() : undefined,
          }))
          .filter((item) => item.id && item.label)
      : [],
    requisitos: Array.isArray(raw.requisitos)
      ? (raw.requisitos as RequisitoPerfil[])
      : [],
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : null,
    perfilCompleto: raw.perfilCompleto === true,
  };
}

export async function getConcessionariaPerfilFromFirestore(
  concessionariaId?: string | null,
): Promise<ConcessionariaPerfilFirestore | null> {
  if (!concessionariaId) return null;

  if (profileCache.has(concessionariaId)) {
    return profileCache.get(concessionariaId) ?? null;
  }

  try {
    const snap = await getFirestore().collection(COLLECTION).doc(concessionariaId).get();
    if (!snap.exists) {
      profileCache.set(concessionariaId, null);
      return null;
    }

    const parsed = parsePerfil(snap.id, snap.data()!);
    if (!parsed.ativo) {
      profileCache.set(concessionariaId, null);
      return null;
    }

    profileCache.set(concessionariaId, parsed);
    return parsed;
  } catch (error) {
    console.warn(
      `Não foi possível carregar perfil da concessionária ${concessionariaId}:`,
      error,
    );
    profileCache.set(concessionariaId, null);
    return null;
  }
}

export function getRequisitosFromPerfil(
  perfil: ConcessionariaPerfilFirestore | null,
): RequisitoPerfil[] {
  if (!perfil?.perfilCompleto) return [];
  return perfil.requisitos ?? [];
}

export function buildCustomAnalysisPromptAddon(
  perfil: ConcessionariaPerfilFirestore,
): string {
  const docs =
    perfil.documentosObrigatorios.length > 0
      ? perfil.documentosObrigatorios
          .map((id) => {
            const custom = (perfil.documentosCustom ?? []).find((item) => item.id === id);
            if (custom) {
              const extra = custom.descricao ? ` — ${custom.descricao}` : "";
              return `- ${custom.label}${extra}`;
            }
            return `- ${id}`;
          })
          .join("\n")
      : "Nenhum documento obrigatório configurado.";

  const normasCustomSelecionadas = (perfil.normasCustom ?? []).filter((norma) =>
    perfil.normasFontes.includes(norma.id),
  );
  const normasCustomTexto =
    normasCustomSelecionadas.length > 0
      ? `\nNORMAS CUSTOMIZADAS DESTE PERFIL (usar como referência; não inventar além do descrito):\n${normasCustomSelecionadas
          .map((norma) => {
            const ano = norma.ano ? ` (${norma.ano})` : "";
            const arquivo = norma.arquivoNome
              ? ` [arquivo: ${norma.arquivoNome}]`
              : "";
            return `- ${norma.id}: ${norma.titulo} — ${norma.orgao}${ano}${arquivo}\n  ${norma.descricao}`;
          })
          .join("\n")}`
      : "";

  const template = perfil.modeloRelatorio.templateMarkdown?.trim()
    ? `\nESTRUTURA DO RELATÓRIO (seguir quando gerar parecer):\n${perfil.modeloRelatorio.templateMarkdown.trim()}`
    : "";

  return `

PERFIL CUSTOMIZADO DA CONCESSIONÁRIA: ${perfil.nome}
Título padrão do relatório: ${perfil.modeloRelatorio.tituloPadrao}

DOCUMENTOS OBRIGATÓRIOS DESTA CONCESSIONÁRIA:
${docs}
${normasCustomTexto}
${template}

Use somente as normas anexadas nesta chamada e as normas customizadas descritas acima. Presença de arquivo não equivale a conformidade.
INFORMACAO_AUSENTE = evidência não apresentada; NAO_CONFORME = evidência existe mas está incompleta ou em desacordo com a norma.
`;
}
