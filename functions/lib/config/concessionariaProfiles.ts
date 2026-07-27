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
}): string {
  const {
    profile,
    dados,
    requisitosFormatados,
    tiposAnalise,
    tiposProjetoNome,
    escopo,
    promptCustomizado,
  } = params;

  if (profile === "eco101") {
    return buildEco101AnalysisPrompt(
      dados,
      requisitosFormatados,
      escopo,
      promptCustomizado,
    );
  }
  if (profile === "motiva") {
    return buildMotivaAnalysisPrompt(
      dados,
      requisitosFormatados,
      escopo,
      promptCustomizado,
    );
  }
  if (profile === "arteris") {
    return buildArterisAnalysisPrompt(
      dados,
      requisitosFormatados,
      escopo,
      promptCustomizado,
    );
  }

  return buildAnalysisPrompt(
    dados,
    tiposAnalise,
    requisitosFormatados,
    tiposProjetoNome,
    escopo,
    promptCustomizado,
  );
}
