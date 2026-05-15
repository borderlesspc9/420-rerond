import type { TipoRelatorio } from "../services/normasService";

export interface DadosFormulario {
  titulo: string;
  tipoObra: string;
  localizacao: string;
  descricao: string;
  cliente?: string;
  kilometragem?: string;
  nroProcessoErp?: string;
  rodovia?: string;
  nomeConcessionaria?: string;
  sentido?: string;
  ocupacao?: string;
  municipioEstado?: string;
  ocupacaoArea?: string;
  responsavelTecnico?: string;
  faseProjeto?: string;
  analistaResponsavel?: string;
  memorial?: string;
  dataRecebimento?: string;
  numeroRevisao?: string;
}

export interface EscopoAnalisePrompt {
  incluirDadosFormulario: boolean;
  incluirDocumentosProjeto: boolean;
  gerarChecklistConformidade: boolean;
  gerarParecerTecnico: boolean;
}

const v = (s: string | undefined) => s || "não informado";

export function buildSystemPrompt(): string {
  return `Você é um especialista técnico em projetos rodoviários e engenharia de transportes, com profundo conhecimento das normas brasileiras vigentes que regulamentam acessos, faixa de domínio, sinalização de obras e infraestrutura viária.

Sua função é analisar projetos rodoviários enviados em PDF e verificar sua conformidade com as normas vigentes enviadas como referência. Compare cada requisito normativo com o que está apresentado no projeto e emita um parecer técnico claro e fundamentado.

REGRAS IMPORTANTES:
- Seja sempre objetivo e técnico
- Nunca invente ou assuma informações não presentes no projeto
- Se um item não puder ser verificado por ausência de informação no PDF, registre como "INFORMACAO_AUSENTE"
- Cite sempre a norma, o artigo, parágrafo ou página que fundamenta cada conclusão
- Em caso de dúvida sobre o tipo de projeto, baseie-se no conteúdo dos documentos`;
}

export function buildAnalysisPrompt(
  dados: DadosFormulario,
  tiposRelatorio: TipoRelatorio[],
  requisitosFormatados: string,
  tiposProjetoNome: string,
  escopo: EscopoAnalisePrompt,
  promptCustomizado?: string,
): string {
  const blocoFormulario = escopo.incluirDadosFormulario
    ? `DADOS DO FORMULÁRIO DE SOLICITAÇÃO:
- Cliente: ${v(dados.cliente)}
- Kilometragem: ${v(dados.kilometragem)}
- Nro Processo ERP: ${v(dados.nroProcessoErp)}
- Rodovia: ${v(dados.rodovia)}
- Nome Concessionária: ${v(dados.nomeConcessionaria)}
- Sentido: ${v(dados.sentido)}
- Ocupação: ${v(dados.ocupacao)}
- Município - Estado: ${v(dados.municipioEstado)}
- Ocupação Área: ${v(dados.ocupacaoArea)}
- Responsável Técnico: ${v(dados.responsavelTecnico)}
- Fase do Projeto: ${v(dados.faseProjeto)}
- Analista Responsável: ${v(dados.analistaResponsavel)}
- Memorial: ${v(dados.memorial)}
- Data de Recebimento: ${v(dados.dataRecebimento)}
- Número da Revisão: ${v(dados.numeroRevisao)}
- Título: ${dados.titulo}
- Tipo de Obra: ${dados.tipoObra}
- Localização: ${dados.localizacao}
 - Descrição: ${dados.descricao}`
    : `DADOS DO FORMULÁRIO DE SOLICITAÇÃO: NÃO UTILIZAR.
Ignore completamente campos do formulário e baseie a análise apenas no restante do contexto permitido.`;

  const instrucoesEntrada = [
    escopo.incluirDadosFormulario
      ? "Formulário: incluído."
      : "Formulário: excluído por decisão do usuário.",
    escopo.incluirDocumentosProjeto
      ? "Documentos do projeto (PDFs anexados): incluídos."
      : "Documentos do projeto (PDFs anexados): excluídos por decisão do usuário.",
  ].join("\n- ");

  const instrucoesSaida = [
    escopo.gerarChecklistConformidade
      ? "Gerar checklist de conformidade."
      : "NÃO gerar checklist de conformidade.",
    escopo.gerarParecerTecnico
      ? "Gerar parecer técnico em markdown."
      : "NÃO gerar parecer técnico.",
  ].join("\n- ");

  const tiposSelecionados = tiposRelatorio.join(", ");
  const promptAdicional = promptCustomizado?.trim()
    ? `\nPROMPT ADICIONAL DO USUÁRIO (priorize sem quebrar as regras estruturais de saída):\n${promptCustomizado.trim()}`
    : "";

  return `${blocoFormulario}

TIPOS DE PROJETO PARA ANÁLISE NORMATIVA: ${tiposProjetoNome} (${tiposSelecionados})

REQUISITOS DE CONFORMIDADE A VERIFICAR:
${requisitosFormatados}

INSTRUÇÕES:
1. Respeite estritamente o escopo definido pelo usuário:
- ${instrucoesEntrada}
2. Leia integralmente os PDFs de norma enviados como referência.
3. Se documentos do projeto estiverem incluídos, leia integralmente os PDFs do cliente.
4. Compare o que estiver no escopo com os requisitos listados.
5. Para cada requisito listado, verifique se o projeto atende, não atende ou se a informação está ausente.
6. Respeite estritamente as saídas pedidas:
- ${instrucoesSaida}${promptAdicional}

FORMATO DE SAÍDA OBRIGATÓRIO — responda APENAS com JSON válido, sem texto antes ou depois:
{
  "checklist": [
    {
      "item": "ID_DO_REQUISITO",
      "status": "OK" | "NAO_CONFORME" | "INFORMACAO_AUSENTE",
      "situacaoEncontrada": "O que o projeto apresenta (string curta)",
      "exigenciaNormativa": "O que a norma determina (string curta)",
      "fundamentacao": "Norma + Artigo/Parágrafo específico",
      "orientacao": "O que precisa ser corrigido (vazio se OK)"
    }
  ],
  "parecerTecnico": "PARECER EM MARKDOWN conforme estrutura abaixo (ou string vazia se não solicitado)"
}

ESTRUTURA DO parecerTecnico (Markdown):

## IDENTIFICAÇÃO DO PROJETO
[Tipo de projeto, rodovia, km, solicitante — extraído dos documentos e formulário]

## NORMAS APLICADAS
[Liste quais normas foram usadas na análise]

## ITENS CONFORMES
[Para cada item OK: **[Item]** — OK]

## NÃO CONFORMIDADES
[Para cada item com problema:]
**Item:** [Nome do requisito]
**Situação encontrada:** [O que o projeto apresenta]
**Exigência normativa:** [O que a norma determina]
**Fundamentação:** [Norma + Artigo/Parágrafo/Página]
**Orientação:** [O que precisa ser corrigido]

## INFORMAÇÕES AUSENTES
[Para cada item sem informação suficiente:]
**Item:** [Nome do requisito]
**O que deve ser apresentado:** [Descrição]

## CONCLUSÃO GERAL
[Parecer final: Aceito / Aceito com ressalvas / Não aceito (rejeitado) — com resumo objetivo]`;
}

export function buildInferTipoPrompt(): string {
  return `Analise os documentos PDF enviados e determine o tipo de projeto.
Responda APENAS com uma das seguintes opções, sem texto adicional:
- pit (se for Projeto de Interesse de Terceiros)
- obra_per (se for obra prevista no PER - Programa de Exploração da Rodovia)
- obra_nao_per (se for obra não prevista no PER)`;
}
