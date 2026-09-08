import { getFirestore } from "firebase-admin/firestore";

export type RequisitoTipoAnalise = {
  id: string;
  descricao: string;
  categoria?: string;
};

export type TipoAnaliseFirestore = {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  descricao: string;
  finalidade?: string;
  normasFontes: string[];
  documentosSugeridos: string[];
  requisitos: RequisitoTipoAnalise[];
  promptOrientacao?: string;
  ativo: boolean;
};

const COLLECTION =
  process.env.FIRESTORE_TIPOS_ANALISE_COLLECTION?.trim() || "tiposAnalise";

const REQ_OCUPACAO: RequisitoTipoAnalise[] = [
  {
    id: "OCUP_COMPLETUDE_DOCUMENTAL",
    descricao:
      "Completude da documentação de ocupação em faixa de domínio (requerimento, memorial, plantas).",
    categoria: "DOCUMENTAL",
  },
  {
    id: "OCUP_LOCALIZACAO_KM",
    descricao:
      "Localização da ocupação com km e sentido coerentes no memorial e nas plantas.",
    categoria: "GEOMETRIA",
  },
  {
    id: "OCUP_FAIXA_DOMINIO",
    descricao:
      "Interferência com faixa de domínio / non aedificandi identificada e compatível com a norma.",
    categoria: "GEOMETRIA",
  },
  {
    id: "OCUP_PERFIL_TRAVESSIA",
    descricao:
      "Perfil / seção da ocupação ou travessia com cotas e afastamentos mínimos.",
    categoria: "GEOMETRIA",
  },
  {
    id: "OCUP_ART_PROJETO",
    descricao:
      "ART referente ao projeto de ocupação apresentada e vinculada ao responsável técnico.",
    categoria: "DOCUMENTAL",
  },
  {
    id: "OCUP_INTERFERENCIA_PISTA",
    descricao:
      "Avaliação de interferência com pista, acostamento e dispositivos de segurança.",
    categoria: "SEGURANCA",
  },
];

const REQ_ACESSO: RequisitoTipoAnalise[] = [
  {
    id: "ACESSO_COMPLETUDE_DOCUMENTAL",
    descricao:
      "Completude documental do projeto de acesso (requerimento, memorial, planta).",
    categoria: "DOCUMENTAL",
  },
  {
    id: "ACESSO_GEOMETRIA_ENTRADA",
    descricao:
      "Geometria da entrada/saída (raios, ângulos, larguras) conforme diretrizes de acesso.",
    categoria: "GEOMETRIA",
  },
  {
    id: "ACESSO_VISIBILIDADE",
    descricao:
      "Distâncias de visibilidade e sinalização de alerta no acesso à rodovia.",
    categoria: "SEGURANCA",
  },
  {
    id: "ACESSO_DRENAGEM",
    descricao:
      "Solução de drenagem do acesso sem comprometer a plataforma da rodovia.",
    categoria: "DRENAGEM",
  },
  {
    id: "ACESSO_ART",
    descricao: "ART do projeto de acesso vinculada ao responsável técnico.",
    categoria: "DOCUMENTAL",
  },
  {
    id: "ACESSO_PROPRIEDADE_LINDEIRA",
    descricao: "Identificação da propriedade lindeira e finalidade do acesso.",
    categoria: "DOCUMENTAL",
  },
];

const REQ_PAC: RequisitoTipoAnalise[] = [
  {
    id: "PAC_COMPLETUDE_DOCUMENTAL",
    descricao:
      "Completude documental do PAC / plano de adequação (requerimento, memorial, plano de trabalho).",
    categoria: "DOCUMENTAL",
  },
  {
    id: "PAC_ESCOPO_ADEQUACAO",
    descricao:
      "Escopo das adequações proposto está descrito e coerente com o diagnóstico.",
    categoria: "TECNICO",
  },
  {
    id: "PAC_CRONOGRAMA",
    descricao: "Cronograma / plano de trabalho das adequações apresentado.",
    categoria: "PLANEJAMENTO",
  },
  {
    id: "PAC_PARAMETROS_DESEMPENHO",
    descricao:
      "Parâmetros técnicos e de desempenho das adequações compatíveis com o referencial normativo.",
    categoria: "TECNICO",
  },
  {
    id: "PAC_ART",
    descricao: "ART do PAC vinculada ao responsável técnico.",
    categoria: "DOCUMENTAL",
  },
  {
    id: "PAC_CHECKLIST_VERIFICACAO",
    descricao:
      "Check-list ou verificação de adequação preenchido quando exigido pela organização.",
    categoria: "DOCUMENTAL",
  },
];

/** Seed embutido — usado se Firestore estiver vazio ou sem o doc. */
export const TIPOS_ANALISE_SEED: TipoAnaliseFirestore[] = [
  {
    id: "ocupacao-faixa",
    nome: "Ocupação em faixa de domínio",
    slug: "ocupacao-faixa",
    categoria: "ocupacao_faixa",
    descricao:
      "Análise de ocupações (redes, travessias, interferências) na faixa de domínio.",
    finalidade: "Verificar conformidade documental e técnica de ocupação.",
    normasFontes: ["ANTT_SUROD_13_2025"],
    documentosSugeridos: [
      "requerimento",
      "memorial_descritivo",
      "planta_baixa",
      "perfil_ocupacao",
      "art",
    ],
    requisitos: REQ_OCUPACAO,
    promptOrientacao:
      "ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo OCUP_ / domínio ocupação em faixa. NÃO aplique checklist de acesso (ACESSO_*) nem PAC (PAC_*). Não invente requisitos de outros tipos.",
    ativo: true,
  },
  {
    id: "acesso",
    nome: "Acessos",
    slug: "acesso",
    categoria: "acesso",
    descricao: "Análise de projetos de acesso à rodovia / propriedade lindeira.",
    finalidade: "Verificar conformidade de acessos.",
    normasFontes: ["ANTT_SUROD_13_2025"],
    documentosSugeridos: ["requerimento", "memorial_descritivo", "planta_baixa", "art"],
    requisitos: REQ_ACESSO,
    promptOrientacao:
      "ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo ACESSO_ / domínio acessos. NÃO aplique checklist de ocupação (OCUP_*) nem PAC (PAC_*). Não invente requisitos de outros tipos.",
    ativo: true,
  },
  {
    id: "pac",
    nome: "PAC",
    slug: "pac",
    categoria: "pac",
    descricao:
      "Análise de Projetos de Adequação / PAC conforme material da organização.",
    finalidade: "Verificar conformidade de PAC.",
    normasFontes: ["ANTT_SUROD_12_2025"],
    documentosSugeridos: [
      "requerimento",
      "memorial_descritivo",
      "plano_trabalho",
      "art",
    ],
    requisitos: REQ_PAC,
    promptOrientacao:
      "ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo PAC_ / domínio PAC. NÃO aplique checklist de ocupação (OCUP_*) nem acesso (ACESSO_*). Não invente requisitos de outros tipos.",
    ativo: true,
  },
  {
    id: "outro",
    nome: "Outro",
    slug: "outro",
    categoria: "outro",
    descricao:
      "Tipo extensível — descrever a finalidade na solicitação ou no cadastro.",
    finalidade: "Casos pontuais sem tipo pré-cadastrado.",
    normasFontes: [],
    documentosSugeridos: [],
    requisitos: [],
    promptOrientacao:
      "Tipo Outro: use apenas normas, documentos e requisitos informados nesta solicitação/perfil. NÃO importe checklist de ocupação, acesso ou PAC. Não invente requisitos de outro domínio.",
    ativo: true,
  },
];

const cache = new Map<string, TipoAnaliseFirestore | null>();

function parseTipo(
  id: string,
  raw: FirebaseFirestore.DocumentData,
): TipoAnaliseFirestore {
  const seed = TIPOS_ANALISE_SEED.find((item) => item.id === id);
  const requisitosRaw = Array.isArray(raw.requisitos)
    ? (raw.requisitos as RequisitoTipoAnalise[])
    : [];
  return {
    id,
    nome: String(raw.nome ?? seed?.nome ?? id),
    slug: String(raw.slug ?? seed?.slug ?? id),
    categoria: String(raw.categoria ?? seed?.categoria ?? "outro"),
    descricao: String(raw.descricao ?? seed?.descricao ?? ""),
    finalidade: raw.finalidade
      ? String(raw.finalidade)
      : seed?.finalidade,
    normasFontes: Array.isArray(raw.normasFontes)
      ? raw.normasFontes.map(String)
      : seed?.normasFontes ?? [],
    documentosSugeridos: Array.isArray(raw.documentosSugeridos)
      ? raw.documentosSugeridos.map(String)
      : seed?.documentosSugeridos ?? [],
    requisitos:
      requisitosRaw.length > 0
        ? requisitosRaw.filter((r) => r?.id && r?.descricao)
        : seed?.requisitos ?? [],
    promptOrientacao: raw.promptOrientacao
      ? String(raw.promptOrientacao)
      : seed?.promptOrientacao,
    ativo: raw.ativo !== false,
  };
}

export async function getTipoAnaliseFromFirestore(
  tipoAnaliseId?: string | null,
): Promise<TipoAnaliseFirestore | null> {
  if (!tipoAnaliseId?.trim()) return null;
  const id = tipoAnaliseId.trim();

  if (cache.has(id)) {
    return cache.get(id) ?? null;
  }

  try {
    const snap = await getFirestore().collection(COLLECTION).doc(id).get();
    if (snap.exists) {
      const parsed = parseTipo(snap.id, snap.data()!);
      if (!parsed.ativo) {
        cache.set(id, null);
        return null;
      }
      // Se Firestore tem o doc sem requisitos, completa com seed
      if (parsed.requisitos.length === 0) {
        const seed = TIPOS_ANALISE_SEED.find((item) => item.id === id);
        if (seed?.requisitos.length) {
          parsed.requisitos = seed.requisitos;
          parsed.promptOrientacao =
            parsed.promptOrientacao || seed.promptOrientacao;
          parsed.normasFontes =
            parsed.normasFontes.length > 0
              ? parsed.normasFontes
              : seed.normasFontes;
        }
      }
      cache.set(id, parsed);
      return parsed;
    }
  } catch (error) {
    console.warn(`Não foi possível carregar tipo de análise ${id}:`, error);
  }

  const seed = TIPOS_ANALISE_SEED.find((item) => item.id === id) ?? null;
  cache.set(id, seed);
  return seed;
}

export function formatarRequisitosTipoAnalise(
  tipo: TipoAnaliseFirestore | null,
): string {
  if (!tipo?.requisitos?.length) return "";
  return tipo.requisitos
    .map((r) => {
      const cat = r.categoria ? ` [${r.categoria}]` : "";
      return `- ${r.id}: ${r.descricao}${cat}`;
    })
    .join("\n");
}

export function buildTipoAnalisePromptAddon(
  tipo: TipoAnaliseFirestore | null,
  tipoAnaliseDescricao?: string | null,
): string {
  if (!tipo) return "";
  const descExtra =
    tipo.categoria === "outro" && tipoAnaliseDescricao?.trim()
      ? `\nDescrição informada pelo analista: ${tipoAnaliseDescricao.trim()}`
      : "";
  const orientacao = tipo.promptOrientacao?.trim()
    ? `\n${tipo.promptOrientacao.trim()}`
    : "";

  return `

TIPO DE ANÁLISE (DOMÍNIO) — OBRIGATÓRIO RESPEITAR:
- id: ${tipo.id}
- nome: ${tipo.nome}
- categoria: ${tipo.categoria}
- finalidade: ${tipo.finalidade || tipo.descricao}${descExtra}
${orientacao}

PROIBIDO: misturar requisitos, normas ou critérios de outro tipo de análise (ocupação ≠ acesso ≠ PAC ≠ outro).
Use APENAS a lista de requisitos fornecida para este tipo. Cada item do checklist deve usar o ID listado.
`;
}
