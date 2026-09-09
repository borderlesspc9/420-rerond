# Code review — Teach / Sprint 8 (T3)

Data: 2026-09-09 (revisão com limiar 80% de confiança)  
Escopo: hub Ensinar a IA, goldenCase front/functions, wiring processor, copy ensino vs edição.

## Findings (≥80% — corrigidos nesta passagem)

| ID | Conf. | Item | Status |
|----|-------|------|--------|
| R1 | 95% | `updateGoldenCase` espalhava `undefined` e apagava `observacoes` no mock / risco no Firestore | **Corrigido** (strip `undefined` + merge explícito) |
| R2 | 95% | `setGoldenCaseStatus` sem nota ainda mandava `observacoes: undefined` | **Corrigido** (só atualiza status) |
| R3 | 90% | Wizard resetava código a cada reload da lista | **Corrigido** (ref: só quando o tipo muda) |
| R4 | 90% | `createGoldenCase` com `snap.data()` vazio podia quebrar parse | **Corrigido** (fallback `base`) |
| R5 | 85% | Status vazio/inválido no backend virava `aprovado` e injetava | **Corrigido** (inválido = não injeta; sem campo = legado aprovado) |
| R6 | 90% | `listGoldenCasesByTipo` morto | **Removido** |
| R7 | 85% | UI: status inválido promovido a aprovado | **Corrigido** → `pendente` |

## Findings (<80% — não alterado)

| ID | Conf. | Item | Por quê não mexi |
|----|-------|------|------------------|
| L1 | 60% | Sincronizar seeds mock → Firestore em produção | Decisão de produto/deploy; risco de poluir acervo |
| L2 | 55% | Upload nativo Storage no wizard | Plano aceitou metadado/URL |
| L3 | 50% | Warning CSS minify `margin-bottom: 12px` | Legado fora do hub; não isolado |
| L4 | 65% | Drawer `selecionado` stale se lista mudar | UX rara; ao aprovar o drawer fecha |
| L5 | 70% | Query functions filtra em memória (limit 80) | OK até escala; índice depois |

## Smoke (sem OpenAI)

1. Abrir `/ensinar-ia` — build OK  
2. Wizard / aprovar / preview — coberto no código  
3. `npm run build` + `functions tsc` — OK após correções  

## Conclusão

Bugs de merge/status/wizard com alta confiança corrigidos. Itens &lt;80% só documentados. Ensino pronto no código; execução real pendente chave + deploy.
