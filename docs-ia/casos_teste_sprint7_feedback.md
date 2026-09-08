# Casos de teste — Sprint 7 (feedback aprovado na IA)

## Pré-condições

- Feedback cadastrado em Configurações com `tipoAnaliseId` preenchido.
- Cloud Functions com `feedbackAprendizadoService` + processor atualizado.
- OpenAI para validação empírica (wiring pode ser revisado sem chave).

---

## Caso 1 — Aprovado no mesmo tipo entra

**Entrada:** feedback `aprovado` para tipo `acesso`; nova análise com `tipoAnaliseId=acesso`.

**Esperado:** bloco “APRENDIZADO VALIDADO” no prompt; `feedbackIdsInjetados` gravado na solicitação/versão; correção refletida na interpretação (amostra).

---

## Caso 2 — Outro tipo não recebe

**Entrada:** mesmo feedback de acesso; análise `ocupacao-faixa`.

**Esperado:** feedback **não** listado / não injetado.

---

## Caso 3 — Pendente / rejeitado / revogado

**Entrada:** feedback `pendente` ou `rejeitado` (ou aprovado depois revogado).

**Esperado:** não entra no prompt; análise seguinte após revogar deixa de listar o id.

---

## Salvaguardas (smoke)

| Regra | Comportamento |
|-------|----------------|
| Sem `tipoAnaliseId` na solicitação | Nenhum feedback injetado |
| Feedback sem tipo | Ignorado no parse |
| Máx. 8 itens | Truncamento por `updatedAt` |
| Conflito norma × feedback | Prompt manda prevalecer norma + evidência |

---

## Aceite empírico

Marcar no checklist após deploy + OpenAI nos 3 casos.
