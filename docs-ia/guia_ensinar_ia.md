# Guia — Ensinar a IA

## O que isto é

Fluxo para o analista **ensinar** análises futuras: registrar o que a IA errou e o que seria o certo, por **tipo de análise**.

Isto **não** é:

- edição de parecer/checklist na solicitação (não treina);
- instrução só da reanálise (vale só aquela execução);
- fine-tune / “modelo treinado” (não há).

## Onde acessar

Menu **Ensinar a IA** (`/ensinar-ia`).

| Aba | Uso |
|-----|-----|
| Casos modelo | Lista, filtro, abrir pares errado×certo, aprovar/revogar |
| Novo caso | Wizard: tipo → pares → docs → validação |
| Correção pontual | Um único item (feedback rápido) |
| O que a IA receberia | Preview do bloco de prompt (sem chamar OpenAI) |

Tipos de análise continuam em **Configurações**.

## Como ensinar (caso completo)

1. Escolha o **tipo** (ocupação, acesso, PAC…).
2. Cadastre **pares** errado × certo + justificativa.
3. (Opcional) documentos de referência (nome/URL).
4. Envie para **validação**.
5. Admin **aprova**. Só então o caso entra no acervo usado pela análise (mesmo tipo, máx. 3).

## O que entra na chamada vs o que fica no acervo

| Status | Entra no prompt? |
|--------|------------------|
| aprovado + ativo | Sim (mesmo `tipoAnaliseId`) |
| pendente / rascunho / rejeitado | Não |
| inativo | Não |

Correções pontuais aprovadas: até 8 por tipo (Sprint 7).  
Golden cases aprovados: até 3 por tipo.

Em conflito: **normas + PDFs da solicitação** prevalecem sobre o ensino.

## Sem chave OpenAI

O acervo, a validação e o **preview** funcionam. A análise real só roda com `OPENAI_API_KEY` + deploy das Cloud Functions.

## Seeds de demonstração

No modo mock local há 3 casos sintéticos (ocupação / acesso / PAC). Substitua pelos casos reais do cliente quando disponíveis.
