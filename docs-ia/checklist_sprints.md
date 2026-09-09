# Checklist de Sprints — Análise Técnica com IA

> **Ordem atual (pós-reunião):** assertividade da IA → feedback/aprendizado → memória/reanálise → escala documental → modularidade → gestão de solicitações → estabilidade → UI só se quebrar fluxo.  
> **Não** gastar sprint relevante com redesign: o cliente aprovou visual/MVP.  
> **Não implementar funcionalidades fora destas sprints sem aprovação.**  
> **Gate de qualidade:** nunca encerrar entrega com app quebrado — rodar `npm run build` (ou ao menos `tsc -b`) antes de concluir; Vite em erro de parse deixa o site inacessível.  
> Detalhes de regras e problemas: [`escopo.md`](./escopo.md).

---

## Histórico — sprints concluídas (preservar)

### Sprint 0 — Alinhamento e baseline (MVP)

- [x] Auth Firebase (login interno)
- [x] Layout BaseInfra + dashboard
- [x] Nova solicitação + formulário estruturado
- [x] Upload múltiplo de PDFs + tipagem de documento
- [x] Seleção/cadastro de concessionária (wizard + perfis)
- [x] Análise IA (checklist, parecer, conferência)
- [x] Reanálise / complementos do analista
- [x] Aprovação e rejeição
- [x] Overlay de progresso / jobs assíncronos (código)
- [ ] Confirmar deploy produção: Netlify (front) + Firebase rules/functions + Render (Express legado)

### Sprint 1 — Cadastro persistente de clientes

- [x] Modelo Firestore `clientes`
- [x] CRUD interno de clientes
- [x] Vincular solicitação/processo a `clienteId`
- [x] Selecionar cliente existente na nova solicitação
- [x] Opção **Outro** no select de cliente (texto livre sem `clienteId`)
- [x] Regras Firestore para `clientes` (no repo; publicar no deploy)
- [x] Compatibilidade com solicitações antigas (campo cliente livre)

### Sprint 2 — Processos e revisões (R00 / R01 / R02)

- [x] Modelo de processo agrupando revisões
- [x] Campo/revisão R00, R01, R02…
- [x] UI: criar processo → primeira análise (R00)
- [x] UI: nova revisão a partir do processo (R01+)
- [x] Histórico navegável Cliente → Processo → Revisões
- [x] Não sobrescrever R00 ao criar R01
- [x] Status de processo coerente com o fluxo
- [x] Regras Firestore para `processos` (no repo; publicar no deploy)

### Sprint 3 — Memória entre revisões (base)

- [x] Ao analisar R01+, enviar relatório anterior + pendências + docs novos
- [x] Prompt priorizando "o que foi pedido foi corrigido?"
- [x] Ainda detectar novas inconformidades
- [x] UI de comparação revisão anterior × atual (resumo)
- [x] Código no repo; publicar functions no deploy
- [ ] Testes com casos reais do cliente
- [x] Consistência plena na reanálise (ver Sprint 6 — evolução) — wiring concluído; validação empírica pendente

### Sprint 4 — Refinamento técnico inicial da IA

- [x] Diferenciação inconformidade × documentação ausente
- [x] Conferência formulário × documentos com evidência
- [x] Labels/instruções para peças gráficas (sem rasterizar PDF)
- [x] Exemplo ECO101 injetado no prompt (rigor, não fatos)
- [x] Código no repo; publicar functions no deploy
- [ ] Validação técnica com o cliente
- [ ] Ajustes de prompt a partir de feedback real (segue nas sprints de assertividade)

---

## Próximas sprints (reorganizadas pós-reunião)

> Numeração continua a partir da **Sprint 5**. Itens das antigas sprints 5–8 (jobs produção, PDF, concessionárias, polimento UX) foram redistribuídos: o que é crítico à IA sobe; o resto foi para **Backlog**.

### Sprint 5 — IA: assertividade e isolamento por tipo de análise

**Objetivo:** a IA usar apenas checklist, normas e contexto do **tipo de análise** selecionado (ocupação ≠ acesso ≠ PAC ≠ outros).

- [x] Modelo de **tipo de análise** (descrição, finalidade, checklist, normas, docs, prompts) — coleção + seed + UI Configurações
- [x] Vincular solicitação/processo ao tipo de análise — vínculo na nova/editar solicitação (`tipoAnaliseId`)
- [x] Recuperação de contexto **somente** do tipo pertinente (não misturar bases) — wiring no `analiseJobProcessor` + seed de requisitos
- [x] Garantir que checklist de um tipo não seja aplicado a outro — IDs prefixados `OCUP_` / `ACESSO_` / `PAC_` + prompt de isolamento
- [x] Reforçar validação de apontamento: evidência + localização + justificativa + norma (não só o veredito) — prompts atualizados
- [x] Separar/orientar pipeline texto vs peças gráficas / projeto geométrico (piloto) — instruções reforçadas (não declarar ausente sem citar inspeção)
- [ ] Reduzir falsos negativos em plantas ("informação existe no desenho e a IA diz que não") — depende validação empírica com OpenAI + amostras reais
- [x] Casos de teste mínimos por tipo (ocupação, acesso, PAC — conforme material do cliente) — ver [`casos_teste_sprint5_tipos.md`](./casos_teste_sprint5_tipos.md)

**Critérios de aceite**

1. Análise de tipo A não traz itens exclusivos do checklist de tipo B. *(código: isolamento por seed/prompt; validação empírica pendente OpenAI)*
2. Em amostra definida com o cliente, apontamentos com justificativa incoerente caem vs baseline atual. *(pendente validação)*
3. Peças gráficas classificadas seguem instrução específica (não tratadas só como PDF genérico). *(instrução no prompt; validação pendente)*
4. Relatório/checklist identifica o tipo de análise usado. *(UI + `tipoAnaliseNomeUsado`)*

**Nota:** deploy das Cloud Functions + chave OpenAI necessários para fechar validação em produção.

---

### Sprint 6 — IA: memória, versionamento e reanálise consistente

**Objetivo:** reanálise preservar contexto; não sobrescrever análise anterior; resultados estáveis e justificáveis.

- [x] Versionar cada execução de análise (v1, v2…) sem apagar a anterior — subcoleção `analiseVersoes` no processor
- [x] Reanálise recebe: docs originais + docs novos + análise anterior + checklist + regras + observações + feedback da rodada — memória da mesma solicitação + continuidade R00→R01
- [x] Itens não contestados permanecem (ou mudança vem com justificativa explícita) — regras no prompt de continuidade
- [x] Histórico navegável de versões na UI do analista — seletor + badge no `RelatorioViewer`
- [x] Evitar "reabrir o mesmo processo e obter resultado radicalmente diferente" sem mudança de entrada — âncora na versão anterior + temperature baixa *(validação empírica pendente OpenAI)*
- [x] Distinguir na UI: edição manual × instrução só desta reanálise × feedback permanente (este último na Sprint 7)

**Critérios de aceite**

1. Após reanálise, a versão anterior continua acessível. *(Firestore + UI)*
2. Em teste controlado (mesmos docs + mesma instrução), variação de checklist fica dentro de limite acordado com o cliente. *(ver [`casos_teste_sprint6_reanalise.md`](./casos_teste_sprint6_reanalise.md) — empírica pendente)*
3. Feedback/instrução da reanálise atual é aplicado sem "esquecer" pendências anteriores relevantes. *(wiring no processor)*
4. UI mostra claramente qual versão está sendo visualizada. *(badge + seletor)*

**Nota:** deploy das Cloud Functions necessário para memória da reanálise em produção.

---

### Sprint 7 — IA: feedback operacional e aprendizado controlado

**Objetivo:** o analista ensina a IA após erro — sem confundir com edição de texto ou chatbot pontual.

- [x] Fluxo: análise → identificar erro → registrar "X estava errado; correto é Y porque…" — UI Configurações (registro estruturado)
- [x] Persistência estruturada (tipo, organização, regra, original, correção, justificativa, docs, autor, data)
- [x] Status de validação: rascunho / pendente / aprovado / rejeitado
- [x] Apenas conhecimento **aprovado** entra em análises futuras semelhantes — injeção no prompt (`feedbackAprendizadoService` + bloco no processor)
- [x] UI deixa explícito que edição do parecer **não** treina a IA
- [x] Admin pode revisar/aprovar/rejeitar feedbacks (+ revogar aprovado)
- [x] Salvaguardas para não contaminar todas as análises com um feedback ruim — só mesmo tipo; máx. 8; truncamento; normas prevalecem; sem tipo = não injeta

**Critérios de aceite**

1. Feedback aprovado influencia nova análise do **mesmo tipo** (demonstrável em caso de teste). *(wiring + [`casos_teste_sprint7_feedback.md`](./casos_teste_sprint7_feedback.md); empírica pendente OpenAI/deploy)*
2. Feedback pendente/rejeitado **não** altera análises. *(filtro `status==aprovado`)*
3. Analista consegue concluir o fluxo em menos de 2 minutos em caso típico. *(UI Configurações)*
4. Edição manual do checklist/parecer não cria registro de aprendizado automaticamente. *(fluxo separado)*

**Nota:** deploy das Cloud Functions necessário para injeção em produção.

---

### Sprint 8 — IA: base de conhecimento e análises modelo (golden cases)

**Objetivo:** estruturar materiais dos analistas como referência de qualidade (RAG/exemplos — **sem** fine-tune obrigatório).

- [x] Estrutura por tipo: `/tipo/caso-00N` (docs originais, análise IA, erros, análise correta, observações) — coleção + seed + hub **Ensinar a IA**
- [x] Cadastro/associação: tipo, organização, regras, justificativas — wizard com pares errado×certo + status de validação
- [x] Recuperação por tipo na análise (determinística; máx. 3) — `functions` `goldenCaseService` + processor *(RAG/embeddings = fase 2 com API)*
- [x] Seeds mínimos ocupação/acesso/PAC (sintéticos; substituir pelos do cliente)
- [x] Documentar o que entra no contexto da chamada vs o que fica só no acervo — [`guia_ensinar_ia.md`](./guia_ensinar_ia.md)
- [ ] Ingestão dos primeiros casos **reais** fornecidos pelo cliente
- [ ] Recuperação semântica / embeddings (backlog — requer API)

**Critérios de aceite**

1. Pelo menos N casos modelo (N definido com o cliente) cadastrados e recuperáveis por tipo. *(3 seeds + UI; N reais pendente cliente)*
2. Análise de um tipo prioriza exemplos daquele tipo. *(wiring + preview; empírica OpenAI pendente)*
3. Nenhuma afirmação de "modelo treinado/fine-tuned" sem decisão explícita. *(copy do hub)*
4. Analista/admin consegue abrir um golden case e ver pares errado×correto. *(drawer no hub)*

**Nota:** ver também [`casos_teste_sprint8_golden.md`](./casos_teste_sprint8_golden.md). Deploy + OpenAI para efeito em produção.

---

### Sprint 9 — Infra IA: grandes documentos, muitos arquivos e rate limit

**Objetivo:** suporte a memoriais longos, muitos PDFs e evitar falhas 429 / ação silenciosa.

- [ ] Pipeline: upload → extração → normalização → indexação → chunking → classificação → recuperação → análise → consolidação
- [ ] Processamento por documento / em lotes (não um único prompt com tudo)
- [ ] Controle de tokens, retry, rate limiting, filas quando aplicável
- [ ] Mensagens claras para 429 / timeout / limite de arquivos
- [ ] Armazenar resultados intermediários / resumos estruturados
- [ ] Telemetria básica: duração, nº arquivos, tamanho, tokens aproximados, erro

**Critérios de aceite**

1. Solicitação com volume acordado completa ou falha com mensagem acionável (nunca silenciosa).
2. Erro 429 gera retry e/ou aviso compreensível ao analista.
3. Logs internos permitem identificar qual etapa falhou.
4. Não resolver só aumentando limite de caracteres sem recuperação seletiva.

---

### Sprint 10 — Plataforma: organizações, normas, docs e checklists customizáveis

**Objetivo:** flexibilidade para novas concessionárias/órgãos (ex.: Sanepar) sem hardcode.

- [ ] Entidade **Organização** (nome, categoria, área, normas, tipos de análise, modelos, docs, checklist)
- [ ] Migração suave a partir de concessionárias atuais (eco101/motiva/arteris/custom)
- [ ] Cadastro de **normas** (existentes + "Outro" + PDF anexo + vínculo org/tipo)
- [x] MVP no wizard de concessionária: **cadastrar nova norma** (manual e/ou arquivo; obrigatórios bloqueiam; upload não quebra; aparece na lista na mesma etapa)
- [x] MVP no wizard: **cadastrar novo documento obrigatório** (aparece e já fica selecionável sem refazer etapas)
- [ ] **Padrões de relatório** criáveis/editáveis e associáveis a org/tipo
- [ ] Tipos de **documento** extensíveis ("Outro", obrigatório/opcional por tipo)
  - Parcial: cadastro custom no perfil da concessionária + **Outro** no upload da solicitação/edição
- [ ] Checklist/regras configuráveis (CRUD, categoria, prioridade, vínculo a norma)
- [ ] (Opcional) auxiliar extração de requisitos a partir de PDF de norma — confirmação humana obrigatória
  - Nota: hoje o arquivo de norma é anexado/metadado; extração automática de requisitos ainda não entra sem confirmação humana.

**Critérios de aceite**

1. É possível cadastrar organização nova (ex.: água/esgoto) sem alterar código de perfil legado.
2. Norma custom com PDF anexado entra no contexto da análise daquela org/tipo.
3. Novo tipo de documento aparece no upload sem lista hardcoded exclusiva.
4. Item de checklist criado pelo admin aparece na próxima análise do tipo vinculado.

---

### Sprint 11 — Solicitações: edição, arquivos e histórico

**Objetivo:** corrigir dados e documentos sem abrir solicitação nova.

- [x] Editar nome, descrição, tipo de projeto/análise, organização, metadados, observações
- [x] Registrar mudanças relevantes no histórico
- [x] Adicionar / remover / substituir arquivos
- [x] Visualizar e reclassificar tipo de documento
- [ ] Reanálise usa o conjunto **atualizado** de documentos — já lê arquivos atuais; validar em prod após deploy
- [x] Corrigir fechamento indevido de modal ao arrastar/soltar fora (P8)
- [ ] Garantir feedback visual em ações de gerar/reanalisar (loading/erro) (P9)

**Critérios de aceite**

1. Analista edita campos e salva sem criar novo ID de solicitação.
2. Remover/substituir PDF reflete na próxima análise.
3. Drag fora do modal não fecha o diálogo indevidamente.
4. Clique em analisar/reanalisar sempre mostra loading ou erro explícito.

---

### Sprint 12 — Estabilidade, observabilidade e métricas de assertividade

**Objetivo:** medir se a IA está melhorando; falhas visíveis e rastreáveis.

- [ ] Logs e códigos internos de erro (429, acentos/charset, timeout, falha de geração)
- [ ] Mensagens amigáveis ao analista
- [ ] Telemetria de análise (tokens, arquivos, duração)
- [ ] Métricas: análises, reanálises, correções humanas, falsos positivos/negativos estimados, % aceitos vs corrigidos, feedbacks por tipo
- [ ] Tratar problemas de acentos/caracteres reportados
- [ ] Jobs assíncronos robustos em produção (se ainda pendente de deploy)

**Critérios de aceite**

1. Painel ou export mínimo mostra tendência de correções humanas por tipo de análise.
2. Falha de IA nunca aparece como sucesso silencioso.
3. Caso de acento/caractere reportado pelo cliente está coberto por teste ou correção documentada.
4. Deploy de rules/functions confirmado em produção (fecha gap da Sprint 0).

---

## Backlog (menor prioridade — não bloquear assertividade)

Itens das antigas sprints 6–8 e pedidos secundários:

- [ ] PDF final profissional alinhado ao modelo correto do cliente (layout sem alterar conteúdo técnico)
- [ ] Template compartilhado Ecovias (estrutura igual; muda concessão/logo) — parcialmente coberto na Sprint 10
- [ ] Documentar perfil custom vs legado (eco101/motiva/arteris)
- [ ] Limpar ambiguidades Firestore vs localStorage (migração suave)
- [ ] Melhorias de listagem/filtros por cliente, processo e status
- [ ] Checklist de QA interno com poucos usuários reais
- [ ] Documentar operação (analista) e configuração (admin)
- [ ] Revisar custos/limites de IA e tamanho de PDF antes de escalar
- [ ] Polimento UX amplo do fluxo (**somente** se não for redesign)

---

## Fora destas sprints (requer nova aprovação)

- Portal público para clientes externos  
- Edição automática de plantas  
- Migração de Firebase/AWS sem decisão do cliente  
- Fine-tuning de modelo como requisito (avaliar RAG/conhecimento primeiro)  
- Novos tipos de projeto **sem** normativa/material de referência  
- Redesign completo de dashboard/UI  

---

## Mapa rápido: prioridade da reunião → sprint

| Prioridade | Sprint |
|------------|--------|
| 1 Assertividade / isolamento por tipo | 5 |
| 2 Feedback e aprendizado | 7 (+ golden cases na 8) |
| 3 Reanálise e memória | 6 |
| 4 Escalabilidade documental | 9 |
| 5 Modularidade (orgs, normas, checklists) | 10 |
| 6 Gestão de solicitações / arquivos | 11 |
| 7 Estabilidade / métricas | 12 |
| 8 Interface (só bugs funcionais) | 11 (itens P8/P9) + backlog |

---

## Próximo foco de desenvolvimento

1. **Deploy Firebase Functions + Netlify** + `OPENAI_API_KEY` — ativa Sprints 5–8 + ensino.  
2. Ingestão dos golden cases **reais** do cliente no hub Ensinar a IA.  
3. Empírica: isolamento, memória, feedback, golden.  
4. **Sprint 9** — escala documental e 429.  
5. (Backlog) embeddings/RAG semântico.
