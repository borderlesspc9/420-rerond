"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REGRAS_CONFERENCIA_EVIDENCIA = exports.INSTRUCOES_PECAS_GRAFICAS = exports.TAXONOMIA_STATUS_CHECKLIST = void 0;
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildAnalysisPrompt = buildAnalysisPrompt;
exports.buildInferTipoPrompt = buildInferTipoPrompt;
exports.buildComplementacaoSystemPrompt = buildComplementacaoSystemPrompt;
exports.buildComplementacaoPrompt = buildComplementacaoPrompt;
const v = (s) => s || "não informado";
exports.TAXONOMIA_STATUS_CHECKLIST = `TAXONOMIA OBRIGATÓRIA DO CHECKLIST:
- INFORMACAO_AUSENTE: a evidência (documento, dado, cota ou parâmetro) NÃO foi apresentada nos PDFs. Nunca use NAO_CONFORME só porque o arquivo não existe.
- NAO_CONFORME: a evidência EXISTE nos documentos, mas está incompleta, incorreta ou em desacordo com a norma citada nesta chamada.
- OK: evidência completa nos PDFs e aderente à norma. Presença do arquivo NÃO autoriza OK.
- fundamentacao: cite somente normas anexadas nesta análise (título + artigo/parágrafo/página). Não invente artigo, página ou requisito.
- orientacao: se NAO_CONFORME, o que corrigir no conteúdo apresentado; se INFORMACAO_AUSENTE, o que deve ser apresentado.`;
exports.INSTRUCOES_PECAS_GRAFICAS = `PEÇAS GRÁFICAS (planta baixa, perfil, sinalização e equivalentes):
- Analise o desenho, não só o nome do arquivo: cotas, FXD, faixa non aedificandi, km, sentido, interferência com pista/acostamento.
- Se a peça estiver ilegível, truncada ou sem os elementos acima, use INFORMACAO_AUSENTE — não chute cotas nem geometria.
- Documento gráfico presente mas com parâmetros insuficientes ou em desacordo com a norma → NAO_CONFORME.`;
exports.REGRAS_CONFERENCIA_EVIDENCIA = `CONFERÊNCIA FORMULÁRIO × DOCUMENTOS (conferenciaInputs):
- valorDocumento SOMENTE extraído dos PDFs. Proibido copiar valorFormulario.
- Para cada item, preencha evidencia quando houver: { "arquivo": "nome.pdf", "pagina": "3" ou null, "trecho": "trecho curto ou null" }.
- observacao deve ser explícita. Em DIVERGENTE, use o formato: "Formulário: X · Documento: Y".
- status: COMPATIVEL | DIVERGENTE | AUSENTE_NO_DOCUMENTO | AUSENTE_NO_FORMULARIO.`;
function buildSystemPrompt() {
    return `Você é um especialista técnico em projetos rodoviários e engenharia de transportes, com profundo conhecimento das normas brasileiras vigentes que regulamentam acessos, faixa de domínio, sinalização de obras e infraestrutura viária.

Sua função é analisar projetos rodoviários enviados em PDF e verificar sua conformidade com as normas vigentes enviadas como referência. Compare cada requisito normativo com o que está apresentado no projeto e emita um parecer técnico claro e fundamentado.

REGRAS IMPORTANTES:
- Seja sempre objetivo e técnico
- Nunca invente ou assuma informações não presentes no projeto
- Use somente as normas e requisitos anexados nesta chamada
- Cite sempre a norma, o artigo, parágrafo ou página que fundamenta cada conclusão
- Em caso de dúvida sobre o tipo de projeto, baseie-se no conteúdo dos documentos

${exports.TAXONOMIA_STATUS_CHECKLIST}

${exports.INSTRUCOES_PECAS_GRAFICAS}

${exports.REGRAS_CONFERENCIA_EVIDENCIA}`;
}
function buildAnalysisPrompt(dados, tiposRelatorio, requisitosFormatados, tiposProjetoNome, escopo, promptCustomizado) {
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
2. Leia integralmente os PDFs de norma enviados como referência. Não invente normas fora deste conjunto.
3. Se documentos do projeto estiverem incluídos, leia integralmente os PDFs do cliente, inclusive peças gráficas.
4. Compare o que estiver no escopo com os requisitos listados.
5. ${exports.TAXONOMIA_STATUS_CHECKLIST}
6. ${exports.INSTRUCOES_PECAS_GRAFICAS}
7. ${exports.REGRAS_CONFERENCIA_EVIDENCIA}
8. Respeite estritamente as saídas pedidas:
- ${instrucoesSaida}${promptAdicional}

FORMATO DE SAÍDA OBRIGATÓRIO — responda APENAS com JSON válido, sem texto antes ou depois:
{
  "checklist": [
    {
      "item": "ID_DO_REQUISITO",
      "status": "OK" | "NAO_CONFORME" | "INFORMACAO_AUSENTE",
      "situacaoEncontrada": "O que o projeto apresenta (string curta)",
      "exigenciaNormativa": "O que a norma determina (string curta)",
      "fundamentacao": "Norma + Artigo/Parágrafo específico (somente normas anexadas)",
      "orientacao": "Corrigir (NAO_CONFORME) ou o que apresentar (INFORMACAO_AUSENTE); vazio se OK"
    }
  ],
  "conferenciaInputs": [
    {
      "campo": "string",
      "valorFormulario": "string ou null",
      "valorDocumento": "string ou null",
      "status": "COMPATIVEL | DIVERGENTE | AUSENTE_NO_DOCUMENTO | AUSENTE_NO_FORMULARIO",
      "observacao": "string explícita",
      "evidencia": { "arquivo": "nome.pdf", "pagina": "3 ou null", "trecho": "string ou null" }
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
function buildInferTipoPrompt() {
    return `Analise os documentos PDF enviados e determine o tipo de projeto.
Responda APENAS com uma das seguintes opções, sem texto adicional:
- pit (se for Projeto de Interesse de Terceiros)
- obra_per (se for obra prevista no PER - Programa de Exploração da Rodovia)
- obra_nao_per (se for obra não prevista no PER)`;
}
function buildComplementacaoSystemPrompt() {
    return `Você é um especialista técnico em conformidade de projetos rodoviários.
Sua função é ATUALIZAR um relatório de conformidade já existente, incorporando informações complementares fornecidas pelo analista humano.
Trate os complementos como informação válida para reavaliar os itens correspondentes.
Mantenha rigor técnico, cite fundamentação normativa e produza saída estruturada completa.`;
}
function buildComplementacaoPrompt(dados, tiposProjetoNome, requisitosFormatados, checklistAnterior, parecerAnterior, complementos) {
    const complementosFormatados = complementos
        .map((c) => `- **${c.item}** (${c.descricao}):\n  Informação complementar do analista: ${c.texto}`)
        .join("\n\n");
    return `ATUALIZAÇÃO DE RELATÓRIO COM COMPLEMENTOS DO ANALISTA

IDENTIFICAÇÃO:
- Título: ${dados.titulo}
- Tipo de Obra: ${dados.tipoObra}
- Localização: ${dados.localizacao}
- Tipo normativo: ${tiposProjetoNome}

REQUISITOS DO CATÁLOGO A MANTER NO CHECKLIST:
${requisitosFormatados}

CHECKLIST ANTERIOR (JSON):
${checklistAnterior}

PARECER TÉCNICO ANTERIOR (Markdown):
${parecerAnterior || "(não havia parecer anterior)"}

COMPLEMENTOS INFORMADOS PELO ANALISTA — TRATE COMO VERDADE PARA OS ITENS LISTADOS:
${complementosFormatados}

INSTRUÇÕES:
1. Use os complementos do analista para reavaliar APENAS os itens correspondentes.
2. Regenere o checklist COMPLETO com TODOS os requisitos do catálogo (não omita itens).
3. Para itens com complemento: atualize status (OK, NAO_CONFORME ou INFORMACAO_AUSENTE), situacaoEncontrada, fundamentacao e orientacao. ${exports.TAXONOMIA_STATUS_CHECKLIST}
4. Para itens sem complemento: preserve a avaliação anterior quando ainda fizer sentido.
5. Regenere o parecer técnico COMPLETO em Markdown com todas as seções obrigatórias.
6. Não invente dados além do relatório anterior e dos complementos fornecidos.

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
  "parecerTecnico": "PARECER EM MARKDOWN COMPLETO conforme estrutura padrão"
}

ESTRUTURA DO parecerTecnico (Markdown):

## IDENTIFICAÇÃO DO PROJETO
## NORMAS APLICADAS
## ITENS CONFORMES
## NÃO CONFORMIDADES
## INFORMAÇÕES AUSENTES
## CONCLUSÃO GERAL`;
}
//# sourceMappingURL=prompts.js.map