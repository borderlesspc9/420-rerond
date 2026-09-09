# Avaliação Baseinfra (PDF) → correções sem chave OpenAI

Fonte: `.pdf/AVALIAÇÃO DA FERRAMENTA DE ANÁLISE POR IA.pdf` (cliente).

## O que dava para corrigir no código (feito)

| Problema no PDF | Mitigação no código |
| --- | --- |
| Tipologia errada → checklist errado (POC/PAC/PPU/fases) | Seeds distintos: `poc`, `ppu`, `pac-viabilidade`, `pac-executivo` (+ ocupação/acesso); categorias na UI de tipos |
| “Ausente” vs NC confuso; inventar fora dos anexos | `TAXONOMIA_STATUS_CHECKLIST` + `REGRAS_ESCOPO_DOCUMENTOS` nos prompts Eco101/Motiva/Arteris |
| Erros 429 / 400 (contexto) sem orientação | Mensagens acionáveis (`humanizeAnaliseErrorMessage` + processor); botão **Tentar novamente**; hint no overlay |
| Tipos de documento insuficientes | Catálogo ampliado (terraplenagem, drenagem, pavimentação, topográfico, geométrico, PPU, etc.) |
| Transparência do que a IA “viu” | Persistência e exibição de `documentosProcessados` / `documentosOmitidos` |
| Reuso após falha / editar arquivos | Fluxo já em Editar + reanálise na mesma ficha; erro persistido em `analiseErroMensagem` |

## O que ainda exige OpenAI / Sprint 9+

- Qualidade real de leitura de plantas e estabilidade % item a item (validação empírica).
- Pipeline de chunking/lote para executivos enormes (além de orientar o usuário a reduzir anexos).
- Deploy das Cloud Functions + `OPENAI_API_KEY` em produção.
