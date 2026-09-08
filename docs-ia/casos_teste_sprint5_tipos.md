# Casos de teste mínimos — Sprint 5 (isolamento por tipo)

> Validação empírica com OpenAI fica pendente de chave/deploy.  
> Estes casos definem a expectativa de **não misturar** checklists entre domínios.

## Convenção de IDs

| Prefixo | Domínio |
|---------|---------|
| `OCUP_*` | Ocupação em faixa de domínio |
| `ACESSO_*` | Acessos |
| `PAC_*` | PAC / adequação |

## Caso 1 — Ocupação

- **tipoAnaliseId:** `ocupacao-faixa`
- **Entrada:** solicitação com memorial/planta de ocupação (ou mock documental)
- **Esperado no checklist:** somente IDs `OCUP_*`
- **Proibido:** qualquer `ACESSO_*` ou `PAC_*`

## Caso 2 — Acesso

- **tipoAnaliseId:** `acesso`
- **Entrada:** solicitação de acesso à propriedade lindeira
- **Esperado:** somente IDs `ACESSO_*`
- **Proibido:** `OCUP_*` ou `PAC_*`

## Caso 3 — PAC

- **tipoAnaliseId:** `pac`
- **Entrada:** solicitação de plano de adequação / PAC
- **Esperado:** somente IDs `PAC_*`
- **Proibido:** `OCUP_*` ou `ACESSO_*`

## Como verificar (após deploy + OpenAI)

1. Criar/editar solicitação com o `tipoAnaliseId` do caso.
2. Rodar análise.
3. Inspecionar `checklistConformidade` / relatório: cada `item` deve respeitar o prefixo do domínio.
4. Confirmar no header do relatório o **Tipo de análise** exibido.

## Critério de aceite Sprint 5

- Caso 1–3 passam no isolamento de IDs.
- Relatório identifica o tipo usado (`tipoAnaliseNomeUsado`).
- Apontamentos seguem instrução de evidência + localização + justificativa + norma (amostra manual).
