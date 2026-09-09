# Casos de teste — Golden cases / Ensinar a IA

## Pré-condições

- Hub `/ensinar-ia` disponível.
- Functions com `goldenCaseService` (wiring); OpenAI opcional para análise real.

---

## Caso 1 — Aprovado no mesmo tipo

**Entrada:** golden `aprovado` para tipo `acesso`; preview ou análise com `tipoAnaliseId=acesso`.

**Esperado:** bloco CASOS MODELO; IDs em `goldenCaseIdsInjetados` (quando houver análise).

---

## Caso 2 — Outro tipo não recebe

**Entrada:** caso de acesso; preview/análise `ocupacao-faixa`.

**Esperado:** caso de acesso **não** listado.

---

## Caso 3 — Rejeitado / pendente / inativo

**Esperado:** não entram no preview nem no loader das functions.

---

## Caso 4 — UI pares

**Esperado:** abrir caso no drawer mostra todos os pares errado × certo lado a lado.

---

## Aceite empírico com OpenAI

Pendente chave + deploy. Wiring e preview podem ser validados sem API.
