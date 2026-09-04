# Escopo — Sistema de Análise Técnica com IA

> Atualizado após reunião com o cliente (prioridade: **assertividade da IA**).  
> Este documento é a fonte de verdade para próximos desenvolvimentos.  
> **Não implementar funcionalidades fora das sprints aprovadas neste checklist.**

---

## Visão atualizada do projeto

O sistema **automatiza a análise técnica** de projetos de infraestrutura (hoje focado em faixa de domínio / concessionárias rodoviárias), apontando conformidades, inconformidades, pendências e fundamentação normativa, com **revisão humana obrigatória** e geração de relatório (incluindo PDF).

O sistema **não altera** plantas ou arquivos técnicos. Ele **analisa e aponta**.

### O que o cliente validou nesta reunião

- MVP, estrutura visual, dashboard e organização das informações estão **satisfatórios**.
- O fluxo principal do software está **entregue e compreensível**.
- **Não** priorizar redesenho de interface ou polimento visual sem necessidade.

### Nova prioridade de desenvolvimento

```
ASSERTIVIDADE DA IA
→ REGRAS DE NEGÓCIO
→ TREINAMENTO / FEEDBACK
→ ESTABILIDADE DA ANÁLISE
→ FLEXIBILIDADE DO SISTEMA
```

O principal problema atual é a **qualidade do resultado produzido pela IA**: ela precisa responder no padrão técnico dos analistas, usar o checklist/regras corretos por tipo de análise, e permitir que o próprio cliente **ensine / corrija** o sistema de forma operacional (não só editar texto pontual).

---

## Estado atual

### Concluído (código / produto base)

- Auth Firebase (login interno)
- Layout BaseInfra + dashboard
- Nova solicitação + formulário estruturado
- Upload múltiplo de PDFs + tipagem de documento
- Seleção / cadastro de concessionária (wizard + perfis)
- Análise por IA (checklist, parecer, conferência formulário × documento)
- Escopo de análise / prompt customizado
- Reanálise e complementos do analista
- Overlay / jobs assíncronos (código)
- Aprovação / rejeição
- Base de PDF / identidade BaseInfra + logo da concessionária
- Cadastro persistente de **clientes**
- Select de cliente com opção **Outro** (texto livre, sem `clienteId`) — padrão modular
- Cadastro de concessionária só pelo botão dedicado (sem duplicar no `<select>`)
- Cadastro de **norma custom** e **documento obrigatório custom** no wizard (aparecem na lista na mesma etapa, sem refazer passos)
- **Processos** e revisões **R00 / R01 / R02…**
- Memória entre revisões (contexto da revisão anterior na análise R01+) — código
- Refinamento inicial da IA (taxonomia `NAO_CONFORME` × `INFORMACAO_AUSENTE`, conferência com evidência, labels de peça gráfica, exemplo ECO101)

### Em evolução

- Memória / consistência entre **análise e reanálise** (ainda há perda de contexto e resultados inconsistentes em testes)
- Assertividade por **tipo de análise** (ocupação, acesso, PAC, etc.)
- Análise visual de plantas / projetos geométricos (hoje melhor em texto do que em desenho)
- Deploy produção Firebase (rules/functions) quando conta do projeto estiver disponível
- Validação técnica com casos reais do cliente

### Planejado (pós-reunião — ver sprints)

- Feedback operacional que ensina a IA (base de conhecimento validada)
- Análises modelo / golden cases
- Base de conhecimento segmentada por tipo de análise
- Pipeline documental escalável (chunking / RAG / rate limit / 429)
- Organizações genéricas (concessionárias, água/esgoto, prefeituras, órgãos)
- Normas, padrões de relatório, documentos e checklists **customizáveis**
- Edição de solicitação e gestão de arquivos pós-criação
- Métricas de assertividade e observabilidade

### Em implementação (código — aguarda deploy Firebase/Netlify)

- Coleção / mock **tiposAnalise** + vínculo em nova/editar solicitação + Outro
- **Edição de solicitação e arquivos** (P11) — rota `/solicitacoes/:id/editar`
- **Feedback estruturado** + validação (rascunho/pendente/aprovado/rejeitado) — UI em Configurações
- **Golden cases** — cadastro por tipo
- **Versionamento de análise** — subcoleção `analiseVersoes` (snapshot no processor)
- Documento tipo **Outro** no upload
- Rules Firestore preparadas para `tiposAnalise`, `feedbacksAprendizado`, `goldenCases`, `analiseVersoes`

### Problemas identificados (testes / reunião)

| ID | Problema | Impacto |
|----|----------|---------|
| P1 | IA confunde tipos de análise (ex.: checklist de ocupação em processo de acesso/PAC) | Assertividade |
| P2 | Reanálise considera nova instrução mas “esquece” elementos da análise anterior | Consistência |
| P3 | Reabrir o mesmo processo pode gerar resultados muito diferentes | Consistência |
| P4 | Classificação final às vezes correta com **justificativa incorreta** | Qualidade |
| P5 | IA afirma que informação visual/técnica “não existe” em planta/projeto geométrico | Falsos negativos |
| P6 | Erros ao enviar muitos arquivos; ocorrência de **HTTP 429** | Escalabilidade |
| P7 | PDFs extensos (~100 páginas) / múltiplos PDFs na mesma solicitação | Escalabilidade |
| P8 | Arrastar e soltar fora de modal/campo fecha o componente indevidamente | UX funcional — **corrigido** (dismiss só com mousedown+click no backdrop) |
| P9 | Clique para gerar/reanalisar às vezes “não faz nada” (sem feedback claro) | UX / erros silenciosos |
| P10 | Problemas com acentos/caracteres em alguns fluxos | Estabilidade |
| P11 | Após criar solicitação, não é possível editar dados nem gerenciar arquivos sem nova solicitação | Operação |
| P12 | Lista de tipos de documento insuficiente para categorizar todos os projetos | Flexibilidade |

---

## Novos alinhamentos da reunião

1. **UI/MVP aprovados** — próximas sprints focam em IA e regras de negócio, não redesign.
2. **Feedback ≠ edição de texto** — o analista deve poder registrar correção técnica que alimente análises futuras (com validação, para não contaminar tudo).
3. **Reanálise com memória** — preservar documentos, análise anterior, checklist, feedbacks e versões; não sobrescrever silenciosamente.
4. **Isolamento por tipo de análise** — checklist, normas e exemplos só do domínio pertinente.
5. **Golden cases** — cliente fornecerá casos modelo (documentos + erros da IA + análise correta).
6. **Melhorar leitura de projetos técnicos** — validar evidência, localização, justificativa e norma — não só o veredito.
7. **Arquitetura para muitos/grandes documentos** — não mandar tudo em uma única chamada ao modelo.
8. **Organizações genéricas** — além de rodovias: água, esgoto, prefeituras, órgãos (ex.: Sanepar).
9. **Customização** — normas, padrões de relatório, documentos obrigatórios e checklists configuráveis.
10. **Edição de solicitação + arquivos** após criação.
11. **Correções funcionais de UI** apenas onde quebra fluxo (drag/drop, botões sem feedback).
12. **Observabilidade e métricas de assertividade** para medir se as mudanças melhoram a qualidade.

---

## Perfis de usuário

| Perfil | Descrição | Acesso |
|--------|-----------|--------|
| **Analista interno** | Usuário principal | Login, solicitações, análise, revisão, feedback à IA, aprovação/rejeição, PDF |
| **Admin / Operação** | Configuração | Organizações, normas, tipos de análise, checklists, padrões de relatório, golden cases, validação de conhecimento |
| **Cliente externo** | Fora do escopo atual | Não há portal público; clientes são cadastro interno reutilizável |

Sistema de **uso interno** (poucos usuários no início).

---

## Fluxo central (atualizado)

```
SOLICITAÇÃO
→ DOCUMENTOS (classificados)
→ CONTEXTO (organização + tipo de análise + normas + checklist)
→ PRIMEIRA ANÁLISE (versão 1)
→ REVISÃO HUMANA
→ FEEDBACKS (opcional: pontual e/ou aprendizado)
→ REANÁLISE (versão N, com memória)
→ RELATÓRIO / PDF
```

Fluxo operacional do produto:

1. Login  
2. Cliente (cadastro persistente)  
3. Processo / Solicitação / Revisão (R00…)  
4. Informações do projeto (formulário) — **editáveis após criação** (planejado)  
5. Upload e gestão de documentos — **adicionar/remover/substituir** (planejado)  
6. Seleção da organização / padrão / tipo de análise  
7. Análise da IA (versão versionada)  
8. Revisão humana (concordar, discordar, complementar)  
9. Feedback operacional (ensinar a IA — distinto de editar o texto)  
10. Reanálise com contexto preservado  
11. Geração do relatório técnico / PDF  

---

## Regras de negócio atualizadas

### Gerais (preservadas)

1. A IA analisa texto, imagens/plantas, formulário, anexos e normativas — não só OCR.
2. Comparar formulário × documentos × plantas e evidenciar divergências.
3. Diferenciar **inconformidade** de **informação/documentação ausente**.
4. Não inventar requisitos; usar apenas normas e materiais fornecidos.
5. Não inventar dados não presentes nos documentos.
6. Checklist baseado no padrão da organização + tipo de análise — sem itens fictícios.
7. Relatório editável; analista pode concordar, discordar, corrigir, complementar e reprocessar.
8. Prompt customizado **complementa** regras permanentes; **não** pode fazer a IA ignorar normas.
9. IA não é autoridade técnica final — revisão humana obrigatória.
10. Clientes são persistentes e reutilizados.
11. Revisões R00 / R01 / R02… pertencem ao mesmo processo, com histórico preservado.
12. Análise de revisão posterior deve considerar relatório e pendências anteriores.
13. Não criar/alterar projetos de engenharia automaticamente.
14. Não migrar infraestrutura (Firebase/AWS/IA) sem confirmar com o cliente.
15. **Não afirmar 100% de assertividade** — medir e melhorar continuamente.

### Distinções obrigatórias (novas)

| Conceito | O que é | O que não é |
|----------|---------|-------------|
| **Edição manual do resultado** | Corrigir texto/checklist daquela versão | Treinamento da IA |
| **Instrução da reanálise atual** | Prompt/complemento só para a próxima execução | Regra permanente |
| **Feedback para futuras análises** | Correção técnica registrada como conhecimento | Chatbot pontual |
| **Base de conhecimento permanente** | Itens validados (status aprovado) usados em análises semelhantes | Feedback bruto sem curadoria |

### Feedback / aprendizado

- Fluxo: análise → erro identificado → “considerou X, o correto é Y porque…” → registro estruturado → uso em casos semelhantes **após validação**.
- Feedback incorreto **não** deve contaminar todas as análises (status: rascunho / pendente / aprovado / rejeitado).
- Campos sugeridos: tipo de análise, tipo de projeto, organização, regra relacionada, resposta original, correção humana, justificativa, documentos, data, responsável, status de validação.

### Tipo de análise / isolamento

- Cada tipo (ocupação, acesso, PAC, etc.) tem checklist, regras, normas, documentos e exemplos **próprios**.
- A IA recupera prioritariamente o contexto do tipo selecionado — **não** misturar bases.

### Validação de apontamento

Além de Conforme / Não conforme / Ausente, avaliar:

- evidência utilizada;
- localização (arquivo / página / trecho);
- justificativa;
- norma relacionada;
- confiabilidade do apontamento.

### Escalabilidade documental

Não depender de enviar todos os documentos integralmente em uma única chamada. Pipeline conceitual:

```
UPLOAD → EXTRAÇÃO → NORMALIZAÇÃO → INDEXAÇÃO → CHUNKING
→ CLASSIFICAÇÃO → RECUPERAÇÃO DO CONTEXTO RELEVANTE
→ ANÁLISE → CONSOLIDAÇÃO
```

### Organizações

Entidade genérica **Organização / Órgão / Concessionária** (rodovia, água, esgoto, prefeitura, etc.), sem hardcode exclusivo das concessionárias atuais.

---

## Arquitetura conceitual atualizada

### Já existente (preservar)

- Front: React + Vite (Netlify)
- Auth / dados: Firebase (Auth, Firestore, Storage)
- Análise: Cloud Functions + modelo (OpenAI via gateway/SDK)
- Express legado (PDF / logos) em Render, quando aplicável

### Decisão técnica sugerida (necessita validação técnica antes de implementar)

| Tema | Sugestão | Observação |
|------|----------|------------|
| Golden cases / feedback | Base de conhecimento + RAG / embeddings / exemplos contextualizados | **Não** iniciar por fine-tuning |
| Tipos de análise | Coleção `tiposAnalise` + vínculo a checklist/normas/prompts | Isolar recuperação de contexto |
| Grandes documentos | Chunking + índice + recuperação seletiva + filas/retry/rate limit | Tratar 429 de forma explícita |
| Versionamento de análise | Documentos de versão sob solicitação/processo (não sobrescrever) | Histórico navegável |
| Organizações | Generalizar “concessionária” → organização com categoria | Migração suave dos perfis legado |
| Pipelines de mídia | Separar caminhos texto vs peças gráficas / geométrico | Reduzir falsos negativos visuais |
| Métricas | Eventos de análise + correções humanas | Dashboard simples interno |

---

## Funcionalidades core

### Já existentes (preservar)

- Auth, dashboard, solicitações, upload, concessionárias, análise IA, reanálise, complementos, overlay de job, aprovação/rejeição, PDF base
- Clientes persistentes
- Processos / revisões R00+
- Continuidade R01+ (código) e refino inicial de prompts/conferência

### Evoluções prioritárias (nova ordem)

Ver **Sprints atualizadas** em [`checklist_sprints.md`](./checklist_sprints.md).

---

## Fora do escopo (inalterado / reforçado)

- Criar ou corrigir plantas/projetos automaticamente
- Substituir o engenheiro/analista
- Aprovar tecnicamente sem revisão humana
- Plataforma pública complexa para clientes externos
- Fine-tuning obrigatório sem avaliação prévia de RAG/conhecimento
- Redesign completo de UI / dashboard
- Garantia de 100% de assertividade

---

## Tipos de análise / projeto (exemplos)

Ocupação em faixa de domínio, acessos, PAC, redes elétricas, esgoto, publicidade/outdoors, sinalização e outras intervenções — **somente com normativa/material de referência** e checklist do tipo correspondente.

Expandir para outros domínios (água, saneamento, prefeituras) via **Organização + tipo de análise**, não via fork do produto.

---

## Documentos de entrada

Classificação pelo usuário; lista de tipos deve ser **extensível** (incluir “Outro” + descrição). Não obrigar todos os documentos em toda solicitação; obrigatoriedade por tipo de análise / organização.

**Padrão modular “Outro”:** em selects de entidade (cliente, e futuramente docs/tipos), a lista cadastrada + opção **Outro** com campo livre. Cadastro persistente permanece disponível via tela/botão dedicado — não misturar “cadastrar novo” como opção duplicada no mesmo `<select>`.

**Normas custom no perfil de organização:** no wizard de concessionária, além do catálogo embutido, o analista pode **cadastrar nova norma** (título, órgão e descrição obrigatórios; ano e arquivo opcionais). Arquivo inválido/grande/falha de upload **não impede** salvar o perfil — apenas os dados textuais ficam; campos obrigatórios em branco **impedem concluir** o cadastro da norma.

---

## Critérios de aceite transversais (IA)

Uma melhoria de IA só se considera aceita se:

1. Usa checklist/regras do **tipo de análise** correto.
2. Não mistura requisitos de outro tipo.
3. Em reanálise, preserva o que não foi contestado (ou justifica mudança).
4. Apontamentos trazem evidência + justificativa coerentes (quando aplicável).
5. Erros de limite/token/429 são **visíveis** ao analista, não silenciosos.
6. Feedback de aprendizado só entra em produção após **validação**.

---

## Próximo foco de desenvolvimento

1. **Isolar e assertivar a análise por tipo** (ocupação × acesso × PAC × outros) — checklist, normas e prompts só do domínio correto; reduzir apontamentos tecnicamente errados.  
2. **Fortalecer memória da reanálise** — versionar análises; preservar contexto anterior + feedback da rodada atual.  
3. **Feedback operacional estruturado** — registrar correção humana com status de validação (sem tratar edição de texto como treinamento).  
4. **Receber e estruturar golden cases** fornecidos pelos analistas (casos modelo por tipo).  
5. **Pipeline documental escalável** — chunking/recuperação seletiva e tratamento de 429 / muitos arquivos.

---

## Histórico de atualizações deste documento

| Data | Mudança |
|------|---------|
| (anterior) | Escopo inicial + sprints 0–8 (MVP, clientes, processos, memória R01+, refino IA inicial) |
| Pós-reunião atual | MVP/UI aprovados; prioridade absoluta = assertividade IA; feedback/aprendizado; tipos de análise; golden cases; RAG/escala documental; organizações genéricas; customizações; edição de solicitação/arquivos; observabilidade; sprints futuras reorganizadas |
| Ajustes UX manuais | Cliente Outro; normas/docs custom no wizard; P8 |
| Modularidade (código) | tiposAnalise + P11 editar solicitação/arquivos + feedback estruturado + golden cases + analiseVersoes + Outro docs; rules preparadas; aguarda Firebase/Netlify do cliente |
| Hotfix build | Site quebrado por import duplicado em `NovaSolicitacao` + tipagem em `processoService`; corrigido; **gate:** `npm run build` obrigatório ao fim de tarefa |
| Hotfix build | Site quebrado por import duplicado em `NovaSolicitacao` + tipagem em `processoService`; corrigido; gate: `npm run build` obrigatório ao fim de tarefa |
