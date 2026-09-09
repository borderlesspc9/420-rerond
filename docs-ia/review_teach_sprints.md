# Code review — Teach / Sprint 8 (T3)

Data: 2026-09-09  
Escopo: hub Ensinar a IA, goldenCase front/functions, wiring processor, copy ensino vs edição.

## Findings

| ID | Severidade | Item | Status |
|----|------------|------|--------|
| R1 | Média | Tipagem `filter`/`map` com null em normalize pares/docs | **Corrigido** (loops tipados) |
| R2 | Baixa | `setGoldenCaseStatus` listava todos os casos para merge de observação | **Corrigido** (getDoc / mock find) |
| R3 | Info | Upload Storage de PDF no wizard não implementado (metadado/URL) | **Aceito** (plano T1) |
| R4 | Info | Seeds sintéticos ≠ casos reais do cliente | **Aceito** / documentado |
| R5 | Info | RAG/embeddings não feitos | **Adiado** (backlog com API) |
| R6 | Baixa | Stub golden/feedback removido de Configurações → hub único | **Corrigido** |
| R7 | Info | Análise real ainda depende OpenAI + deploy | **Documentado** |

## Smoke (sem OpenAI)

1. Abrir `/ensinar-ia` — OK (build)
2. Wizard novo caso com ≥1 par — fluxo implementado
3. Aprovar / revogar / preview por tipo — implementado
4. Correção pontual na mesma tela — implementado
5. `npm run build` + `functions tsc` — OK

## Conclusão

Nenhuma feature nova nesta T3 além de correções de review. Ensino pronto no código; execução real pendente chave + deploy.
