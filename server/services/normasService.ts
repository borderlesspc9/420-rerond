import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NORMAS_FILE = path.join(__dirname, "../config/normas.json");

interface FonteNormativa {
  id: string;
  titulo: string;
  orgao: string;
  ano: number;
  url: string;
}

interface RequisitoNormativo {
  id: string;
  descricao: string;
}

interface TipoProjetoNormativo {
  nome: string;
  fontes: string[];
  requisitos: RequisitoNormativo[];
}

interface NormasCatalogo {
  fontes: FonteNormativa[];
  tiposProjeto: Record<string, TipoProjetoNormativo>;
}

export interface NormasSelecionadas {
  tiposSelecionados: string[];
  tiposInvalidos: string[];
  tiposValidos: Array<{ id: string; nome: string }>;
  fontes: FonteNormativa[];
  requisitos: Array<RequisitoNormativo & { tipoProjetoId: string; tipoProjetoNome: string }>;
}

function validarCatalogoBruto(data: unknown): data is NormasCatalogo {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const catalogo = data as Partial<NormasCatalogo>;
  return (
    Array.isArray(catalogo.fontes) &&
    !!catalogo.tiposProjeto &&
    typeof catalogo.tiposProjeto === "object" &&
    !Array.isArray(catalogo.tiposProjeto)
  );
}

export function carregarCatalogoNormas(): NormasCatalogo {
  if (!fs.existsSync(NORMAS_FILE)) {
    throw new Error(`Arquivo de normas não encontrado: ${NORMAS_FILE}`);
  }

  const raw = fs.readFileSync(NORMAS_FILE, "utf-8");
  const parsed: unknown = JSON.parse(raw);

  if (!validarCatalogoBruto(parsed)) {
    throw new Error("Estrutura inválida em normas.json");
  }

  return parsed;
}

export function parseTiposProjetoPraComparar(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const maybeArray: unknown = JSON.parse(trimmed);
      if (Array.isArray(maybeArray)) {
        return maybeArray
          .map((item) => String(item).trim().toLowerCase())
          .filter((item) => item.length > 0);
      }
    } catch {
      // segue fallback de CSV simples
    }

    return trimmed
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0);
  }

  return [];
}

export function obterNormasSelecionadas(tiposProjeto: string[]): NormasSelecionadas {
  const catalogo = carregarCatalogoNormas();
  const tiposUnicos = Array.from(new Set(tiposProjeto.map((tipo) => tipo.toLowerCase())));

  const tiposInvalidos: string[] = [];
  const tiposValidos: Array<{ id: string; nome: string }> = [];
  const requisitos: Array<
    RequisitoNormativo & { tipoProjetoId: string; tipoProjetoNome: string }
  > = [];
  const fontesIds = new Set<string>();

  tiposUnicos.forEach((tipo) => {
    const config = catalogo.tiposProjeto[tipo];
    if (!config) {
      tiposInvalidos.push(tipo);
      return;
    }

    tiposValidos.push({ id: tipo, nome: config.nome });
    config.fontes.forEach((fonteId) => fontesIds.add(fonteId));

    config.requisitos.forEach((requisito) => {
      requisitos.push({
        ...requisito,
        tipoProjetoId: tipo,
        tipoProjetoNome: config.nome,
      });
    });
  });

  const fontes = catalogo.fontes.filter((fonte) => fontesIds.has(fonte.id));

  return {
    tiposSelecionados: tiposUnicos,
    tiposInvalidos,
    tiposValidos,
    fontes,
    requisitos,
  };
}

export function montarBlocoNormativoParaPrompt(normas: NormasSelecionadas): string {
  const linhas: string[] = [];

  if (normas.tiposValidos.length === 0) {
    linhas.push("TIPOS DE PROJETO PARA COMPARACAO: nenhum tipo normativo valido informado.");
  } else {
    linhas.push(
      `TIPOS DE PROJETO PARA COMPARACAO: ${normas.tiposValidos.map((tipo) => `${tipo.nome} (${tipo.id})`).join(", ")}`,
    );
  }

  if (normas.tiposInvalidos.length > 0) {
    linhas.push(
      `TIPOS IGNORADOS (NAO ENCONTRADOS NO CATALOGO): ${normas.tiposInvalidos.join(", ")}`,
    );
  }

  linhas.push("\nFONTES NORMATIVAS APLICADAS:");
  if (normas.fontes.length === 0) {
    linhas.push("- Nenhuma fonte normativa aplicavel encontrada para os tipos selecionados.");
  } else {
    normas.fontes.forEach((fonte) => {
      const ano = fonte.ano > 0 ? fonte.ano : "s.d.";
      linhas.push(`- ${fonte.titulo} (${fonte.orgao}, ${ano}) | id=${fonte.id} | ${fonte.url}`);
    });
  }

  linhas.push("\nREQUISITOS DE CONFORMIDADE A VERIFICAR:");
  if (normas.requisitos.length === 0) {
    linhas.push("- Sem requisitos configurados para os tipos selecionados.");
  } else {
    normas.requisitos.forEach((requisito) => {
      linhas.push(
        `- [${requisito.tipoProjetoNome}] ${requisito.id}: ${requisito.descricao}`,
      );
    });
  }

  linhas.push("\nFORMATO DE SAIDA OBRIGATORIO:");
  linhas.push("Retorne APENAS um JSON valido com esta estrutura:");
  linhas.push("{");
  linhas.push('  "metadados": {');
  linhas.push('    "tiposProjetoComparados": ["duplicacao"],');
  linhas.push('    "aviso": "texto opcional"');
  linhas.push("  },");
  linhas.push('  "itens": [');
  linhas.push("    {");
  linhas.push('      "item": "NOME_DO_REQUISITO",');
  linhas.push('      "status": "OK" | "NAO_CONFORME",');
  linhas.push('      "onde_esta_errado": "texto curto ou vazio",');
  linhas.push('      "por_que_esta_errado": "texto curto ou vazio",');
  linhas.push('      "referencia_normativa": "norma + artigo/paragrafo + pagina quando houver evidência"');
  linhas.push("    }");
  linhas.push("  ]");
  linhas.push("}");
  linhas.push("Se um item estiver conforme, use status=OK e deixe os demais campos com string vazia.");

  return linhas.join("\n");
}
