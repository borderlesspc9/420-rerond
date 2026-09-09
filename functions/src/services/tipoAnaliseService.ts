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

const REQ_POC: RequisitoTipoAnalise[] = [
  {
    id: "POC_COMPLETUDE_DOCUMENTAL",
    descricao: "Completude documental do POC (requerimento, memorial, plantas).",
    categoria: "DOCUMENTAL",
  },
  {
    id: "POC_LOCALIZACAO_KM",
    descricao:
      "Localização (km/sentido) coerente entre formulário, memorial e plantas.",
    categoria: "GEOMETRIA",
  },
  {
    id: "POC_COMPAT_MEMORIAL_PLANTAS",
    descricao:
      "Compatibilização Memorial × plantas (sem divergência de cotas/km/escopo).",
    categoria: "TECNICO",
  },
  {
    id: "POC_ART",
    descricao: "ART do POC apresentada e vinculada ao responsável técnico.",
    categoria: "DOCUMENTAL",
  },
  {
    id: "POC_INTERFERENCIA_FXD",
    descricao:
      "Interferência com faixa de domínio / non aedificandi identificada.",
    categoria: "GEOMETRIA",
  },
];

const REQ_PPU: RequisitoTipoAnalise[] = [
  {
    id: "PPU_COMPLETUDE_DOCUMENTAL",
    descricao:
      "Completude documental de publicidade (requerimento, memorial, projeto).",
    categoria: "DOCUMENTAL",
  },
  {
    id: "PPU_ESTRUTURA_SUSTENTACAO",
    descricao:
      "Estrutura de sustentação do dispositivo de publicidade dimensionada/apresentada.",
    categoria: "TECNICO",
  },
  {
    id: "PPU_LOCALIZACAO_KM",
    descricao: "Localização (km/sentido) do ponto de publicidade coerente.",
    categoria: "GEOMETRIA",
  },
  {
    id: "PPU_INTERFERENCIA_SEGURANCA",
    descricao:
      "Avaliação de interferência com segurança viária / visibilidade.",
    categoria: "SEGURANCA",
  },
  {
    id: "PPU_ART",
    descricao: "ART referente ao projeto de publicidade apresentada.",
    categoria: "DOCUMENTAL",
  },
];

const REQ_PAC_VIAB: RequisitoTipoAnalise[] = [
  {
    id: "PACV_COMPLETUDE_DOCUMENTAL",
    descricao: "Documentação mínima de PAC em fase de viabilidade.",
    categoria: "DOCUMENTAL",
  },
  {
    id: "PACV_ESCOPO_FASE",
    descricao:
      "Escopo coerente com fase de viabilidade (não exigir disciplinas só de executivo).",
    categoria: "PLANEJAMENTO",
  },
  {
    id: "PACV_LOCALIZACAO",
    descricao: "Localização e premissas de viabilidade coerentes.",
    categoria: "TECNICO",
  },
  {
    id: "PACV_CRONOGRAMA",
    descricao: "Cronograma/prazos de viabilidade quando exigidos.",
    categoria: "PLANEJAMENTO",
  },
  {
    id: "PACV_ART",
    descricao: "ART aplicável à fase de viabilidade, se exigida.",
    categoria: "DOCUMENTAL",
  },
];

const REQ_PAC_EXEC: RequisitoTipoAnalise[] = [
  {
    id: "PACE_COMPLETUDE_DISCIPLINAS",
    descricao:
      "Completude das disciplinas do executivo enviadas (planta, drenagem, terraplenagem, pavimentação, etc. conforme anexos).",
    categoria: "DOCUMENTAL",
  },
  {
    id: "PACE_COMPAT_ENTRE_PROJETOS",
    descricao: "Compatibilização entre disciplinas/projetos enviados nesta etapa.",
    categoria: "TECNICO",
  },
  {
    id: "PACE_GEOMETRIA",
    descricao:
      "Projeto geométrico / planta compatível com memorial (quando enviados).",
    categoria: "GEOMETRIA",
  },
  {
    id: "PACE_DRENAGEM_TERRAP",
    descricao: "Drenagem e/ou terraplenagem avaliadas se constarem nos anexos.",
    categoria: "TECNICO",
  },
  {
    id: "PACE_SINALIZACAO",
    descricao:
      "Sinalização avaliada se enviada; não exigir se não anexada nesta etapa.",
    categoria: "SEGURANCA",
  },
  {
    id: "PACE_ART",
    descricao: "ART(s) do executivo vinculada(s) aos projetos enviados.",
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
      "ISOLAMENTO OBRIGATÓRIO: use SOMENTE requisitos com prefixo OCUP_. NÃO aplique ACESSO_*, PAC_*, POC_* ou PPU_*.",
    ativo: true,
  },
  {
    id: "poc",
    nome: "POC — Projeto de Ocupação",
    slug: "poc",
    categoria: "poc",
    descricao:
      "Tipologia POC (Projeto de Ocupação) — Ecovias/Capixaba e equivalentes.",
    finalidade: "Checklist específico de POC, distinto de PPU e PAC.",
    normasFontes: ["ANTT_SUROD_13_2025"],
    documentosSugeridos: [
      "requerimento",
      "memorial_descritivo",
      "planta_baixa",
      "perfil_ocupacao",
      "art",
    ],
    requisitos: REQ_POC,
    promptOrientacao:
      "ISOLAMENTO POC: use somente POC_*. Não use checklist genérico de outro domínio nem PPU/PAC/acesso.",
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
      "ISOLAMENTO OBRIGATÓRIO: use SOMENTE ACESSO_*. NÃO aplique OCUP_*, PAC_*, POC_* ou PPU_*.",
    ativo: true,
  },
  {
    id: "pac",
    nome: "PAC (geral)",
    slug: "pac",
    categoria: "pac",
    descricao:
      "PAC genérico — prefira PAC Viabilidade ou PAC Executivo quando a fase for conhecida.",
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
      "ISOLAMENTO: use SOMENTE PAC_*. Se a fase for viabilidade ou executivo, prefira pac-viabilidade / pac-executivo.",
    ativo: true,
  },
  {
    id: "pac-viabilidade",
    nome: "PAC — Viabilidade",
    slug: "pac-viabilidade",
    categoria: "pac",
    descricao:
      "PAC na fase de viabilidade — não exigir disciplinas exclusivas de executivo não enviadas.",
    finalidade: "Checklist de PAC Viabilidade.",
    normasFontes: ["ANTT_SUROD_12_2025"],
    documentosSugeridos: [
      "requerimento",
      "memorial_descritivo",
      "plano_trabalho",
      "art",
    ],
    requisitos: REQ_PAC_VIAB,
    promptOrientacao:
      "FASE VIABILIDADE: use somente PACV_*. Não exija disciplinas de executivo se não foram anexadas.",
    ativo: true,
  },
  {
    id: "pac-executivo",
    nome: "PAC — Executivo",
    slug: "pac-executivo",
    categoria: "pac",
    descricao:
      "PAC executivo — disciplinas conforme documentos enviados nesta etapa.",
    finalidade: "Checklist de PAC Executivo com múltiplas disciplinas.",
    normasFontes: ["ANTT_SUROD_12_2025"],
    documentosSugeridos: [
      "requerimento",
      "memorial_descritivo",
      "planta_baixa",
      "projeto_geometrico",
      "projeto_drenagem",
      "projeto_terraplenagem",
      "projeto_pavimentacao",
      "projeto_sinalizacao",
      "art",
    ],
    requisitos: REQ_PAC_EXEC,
    promptOrientacao:
      "FASE EXECUTIVO: use somente PACE_*. Avalie disciplinas presentes nos anexos; não marque ausente o que não foi enviado.",
    ativo: true,
  },
  {
    id: "ppu",
    nome: "PPU — Publicidade",
    slug: "ppu",
    categoria: "ppu",
    descricao:
      "Projeto de publicidade (PPU) — critérios próprios, não ocupação genérica.",
    finalidade: "Checklist de publicidade / estrutura de sustentação.",
    normasFontes: ["ANTT_SUROD_13_2025"],
    documentosSugeridos: [
      "requerimento",
      "memorial_descritivo",
      "projeto_publicidade",
      "estrutura_sustentacao",
      "planta_baixa",
      "art",
    ],
    requisitos: REQ_PPU,
    promptOrientacao:
      "ISOLAMENTO PPU: use somente PPU_*. PROIBIDO checklist genérico de ocupação em faixa.",
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
      "Tipo Outro: use apenas normas/requisitos informados nesta solicitação. NÃO importe checklist de outro domínio.",
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
