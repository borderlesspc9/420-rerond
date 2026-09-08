# Casos de teste — Sprint 6 (memória e reanálise)

Critérios alinhados ao checklist: versão anterior acessível; instrução da rodada sem esquecer pendências; UI identifica a versão; estabilidade em teste controlado.

## Pré-condições

- Solicitação com análise v1 concluída (parecer + checklist).
- Cloud Functions com processor atualizado (memória da mesma solicitação).
- OpenAI disponível para validação empírica (wiring pode ser revisado sem chave).

---

## Caso 1 — Mesmos docs, mesma instrução (estabilidade)

**Entrada:** reanalisar sem PDFs novos e sem instrução adicional.

**Esperado:**

1. Versão v1 permanece em `analiseVersoes` e aparece no seletor do relatório.
2. Badge indica versão atual (v2) vs histórico (v1).
3. Itens OK não contestados não mudam de status em massa sem justificativa.
4. Variação aceitável (acordar com o cliente): poucos flips de status; flips devem citar evidência.

---

## Caso 2 — Instrução da rodada + pendências anteriores

**Entrada:** reanálise com instrução do tipo “reavalie apenas o item X / ART”.

**Esperado:**

1. Prompt da execução inclui bloco de memória da versão anterior.
2. Pendências relevantes fora de X continuam visíveis (resolvida / parcial / permanece).
3. Instrução não apaga o restante do checklist sem justificativa.

---

## Caso 3 — PDF novo corrige pendência

**Entrada:** anexar memorial/planta que corrige uma pendência de v1; instrução opcional apontando o arquivo.

**Esperado:**

1. Item corrigido muda com justificativa (arquivo/página/trecho).
2. Demais itens estáveis.
3. Histórico: v1 ainda legível (somente leitura); v2 atual editável.

---

## Distinções de UI (smoke)

| Ação | Efeito |
|------|--------|
| Complemento / edição no checklist | Só esta solicitação; **não** treina |
| “Instrução só desta reanálise” no modal | Só a próxima execução |
| Feedback em Configurações | Permanente (Sprint 7 — injeção aprovada) |

---

## Aceite empírico (pendente OpenAI / deploy)

Marcar no checklist após rodar os 3 casos em ambiente com functions atualizadas.
