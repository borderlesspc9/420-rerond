import type { DadosFormulario, EscopoAnalisePrompt } from "./prompts";
import {
  buildEco101AnalysisPrompt,
  buildEco101SystemPrompt,
  isEco101Concessionaria,
} from "./eco101.prompt";
import {
  buildMotivaAnalysisPrompt,
  buildMotivaSystemPrompt,
  isMotivaConcessionaria,
} from "./motiva.prompt";
import {
  buildArterisAnalysisPrompt,
  buildArterisSystemPrompt,
  isArterisConcessionaria,
} from "./arteris.prompt";
import { buildAnalysisPrompt, buildSystemPrompt } from "./prompts";
import type { TipoRelatorio } from "../services/normasService";

export type ConcessionariaPromptProfile = "eco101" | "motiva" | "arteris" | "default";

export function resolveConcessionariaPromptProfile(
  concessionariaId?: string | null,
): ConcessionariaPromptProfile {
  if (isEco101Concessionaria(concessionariaId)) return "eco101";
  if (isMotivaConcessionaria(concessionariaId)) return "motiva";
  if (isArterisConcessionaria(concessionariaId)) return "arteris";
  return "default";
}

export function isProfileConcessionaria(concessionariaId?: string | null): boolean {
  return resolveConcessionariaPromptProfile(concessionariaId) !== "default";
}

export function getProfileTipoProjetoNome(
  profile: ConcessionariaPromptProfile,
): string | null {
  if (profile === "eco101") return "Ecovias / ECO101 — Ocupação em Faixa de Domínio";
  if (profile === "motiva") return "Motiva — Ocupação em Faixa de Domínio";
  if (profile === "arteris") return "Arteris — PIT / Ocupação em Faixa de Domínio";
  return null;
}

export function buildProfileSystemPrompt(
  profile: ConcessionariaPromptProfile,
): string {
  if (profile === "eco101") return buildEco101SystemPrompt();
  if (profile === "motiva") return buildMotivaSystemPrompt();
  if (profile === "arteris") return buildArterisSystemPrompt();
  return buildSystemPrompt();
}

export function buildProfileAnalysisPrompt(params: {
  profile: ConcessionariaPromptProfile;
  dados: DadosFormulario;
  requisitosFormatados: string;
  tiposAnalise: TipoRelatorio[];
  tiposProjetoNome: string;
  escopo: EscopoAnalisePrompt;
  promptCustomizado?: string;
  contextoRevisaoAnterior?: string;
  exemploSaidaEsperada?: string;
}): string {
  const {
    profile,
    dados,
    requisitosFormatados,
    tiposAnalise,
    tiposProjetoNome,
    escopo,
    promptCustomizado,
    contextoRevisaoAnterior,
    exemploSaidaEsperada,
  } = params;

  let base: string;
  if (profile === "eco101") {
    base = buildEco101AnalysisPrompt(
      dados,
      requisitosFormatados,
      escopo,
      promptCustomizado,
    );
  } else if (profile === "motiva") {
    base = buildMotivaAnalysisPrompt(
      dados,
      requisitosFormatados,
      escopo,
      promptCustomizado,
    );
  } else if (profile === "arteris") {
    base = buildArterisAnalysisPrompt(
      dados,
      requisitosFormatados,
      escopo,
      promptCustomizado,
    );
  } else {
    base = buildAnalysisPrompt(
      dados,
      tiposAnalise,
      requisitosFormatados,
      tiposProjetoNome,
      escopo,
      promptCustomizado,
    );
  }

  const blocos: string[] = [base];

  const exemplo = exemploSaidaEsperada?.trim();
  if (exemplo) {
    blocos.push(`═══════════════════════════════════════
${exemplo}`);
  }

  const contexto = contextoRevisaoAnterior?.trim();
  if (contexto) {
    blocos.push(`═══════════════════════════════════════
CONTEXTO DA REVISÃO ANTERIOR DO MESMO PROCESSO
═══════════════════════════════════════
${contexto}

INSTRUÇÕES DE CONTINUIDADE (OBRIGATÓRIAS NESTA REVISÃO):
1. Priorize verificar se as pendências e não conformidades da revisão anterior foram corrigidas nos documentos atuais.
2. Para cada pendência anterior: indique explicitamente se foi resolvida, parcialmente resolvida ou permanece.
3. Continúe detectando novas inconformidades ou ausências na versão atual — não se limite às pendências antigas.
4. Não trate esta revisão como um processo isolado: use o histórico acima como referência, mas avalie o conteúdo atual dos PDFs.`);
  }

  return blocos.join("\n\n");
}
