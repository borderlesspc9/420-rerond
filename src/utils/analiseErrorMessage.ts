/** Mensagens acionáveis para falhas de análise (sem depender da API). */
export function humanizeAnaliseErrorMessage(raw: string | null | undefined): string {
  const text = (raw || '').trim()
  const lower = text.toLowerCase()

  if (!text) {
    return 'A análise falhou. Edite a solicitação se precisar ajustar arquivos e tente novamente na mesma ficha.'
  }

  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('tokens')
  ) {
    return (
      'Limite de processamento/tokens atingido (erro 429). ' +
      'O que fazer: reduza a quantidade ou o tamanho dos PDFs nesta solicitação, ' +
      'remova anexos desnecessários em Editar, aguarde alguns minutos e clique em Analisar/Reanalisar na mesma ficha — não é preciso criar um novo processo.'
    )
  }

  if (
    lower.includes('context_length') ||
    lower.includes('context length') ||
    lower.includes('maximum context') ||
    lower.includes('context window') ||
    lower.includes('janela de contexto') ||
    (lower.includes('400') && lower.includes('context'))
  ) {
    return (
      'O volume de documentos ultrapassou a janela de contexto do modelo (erro 400). ' +
      'O que fazer: envie só os PDFs da fase atual, remova volumes extras em Editar, ' +
      'e tente de novo na mesma solicitação. Projetos executivos muito grandes podem precisar de lote por disciplina até o pipeline escalável estar ativo.'
    )
  }

  if (lower.includes('openai') && (lower.includes('key') || lower.includes('api'))) {
    return (
      'Chave OpenAI ausente ou inválida no ambiente. ' +
      'Peça ao administrador para configurar OPENAI_API_KEY (secret das Cloud Functions) e republicar as functions.'
    )
  }

  if (lower.includes('pdf') && (lower.includes('omit') || lower.includes('limite'))) {
    return (
      `${text} ` +
      'Remova ou substitua PDFs grandes em Editar e reanalise na mesma solicitação.'
    )
  }

  return (
    `${text} ` +
    'Você pode editar dados/arquivos e tentar novamente nesta mesma solicitação.'
  )
}
