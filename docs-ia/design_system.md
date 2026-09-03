# Design System — BaseInfra / Análise Técnica

> Fonte: identidade já adotada no código (`src/index.css`, `src/config/baseinfraTheme.ts`) + diretrizes do documento de contexto (profissional, interno, funcionalidade > ornamentação).

## Princípios de UI

- **Estilo:** profissional, limpo, light mode (uso interno)
- **Prioridade visual:** clareza operacional e leitura técnica — não marketing
- **Tom:** identidade BaseInfra + identidade leve da concessionária (logo/nome no relatório)
- **Não priorizar:** dark mode, efeitos excessivos, dashboards decorativos
- **Referências:** logo BaseInfra (`/logo420.png`), logos de concessionária, relatórios reais fornecidos pelo cliente

---

## Marca

| Item | Valor |
|------|--------|
| Nome curto | BaseInfra |
| Nome completo | BaseInfra Projetos e Consultoria |
| Logo padrão | `/logo420.png` |
| Título padrão de relatório | Relatório de Análise Técnica – Ocupação em Faixa de Domínio |

---

## Paleta de cores

### Primária (azul institucional)

| Token | Hex | Uso |
|-------|-----|-----|
| `primary-900` | `#0f2f73` | Títulos fortes, cabeçalhos PDF |
| `primary-800` | `#163f97` | Ênfase |
| `primary-700` | `#2357c4` | Ações / links ativos |
| `primary-600` | `#2d67db` | Botões primários |
| `primary-100` | `#ddeaff` | Fundos suaves de destaque |
| `primary-50` | `#f2f8ff` | Fundos leves |

### Acento

| Token | Hex | Uso |
|-------|-----|-----|
| `accent-500` | `#f1b726` | Destaque institucional (selo, detalhes) |
| `accent-100` | `#fff4d1` | Fundo de acento |

### Superfície e texto

| Token | Hex | Uso |
|-------|-----|-----|
| `bg` | `#edf7ff` | Fundo da aplicação |
| `bg-soft` | `#f6fbff` | Fundo alternativo |
| `surface` | `#ffffff` | Cards / painéis |
| `surface-alt` | `#f8fbff` | Alternância de blocos |
| `border` | `#d5e3f5` | Bordas |
| `text` | `#14233d` | Texto principal |
| `text-muted` | `#5d708e` | Secundário |
| `text-soft` | `#7686a0` | Terciário |

### Semântica (status / checklist)

| Token | Hex | Uso |
|-------|-----|-----|
| `success` | `#1e9f63` | Conforme / OK |
| `success-bg` | `#e9f9f1` | Fundo conforme |
| `warning` | `#d18807` | Pendente / atenção |
| `warning-bg` | `#fff6de` | Fundo atenção |
| `danger` | `#db3648` | Não conforme / rejeição |
| `danger-bg` | `#ffecee` | Fundo erro |
| `neutral` | `#6b7280` | Não avaliado / neutro |
| `neutral-bg` | `#f3f4f6` | Fundo neutro |

### Criticidade (relatório)

| Nível | Hex |
|-------|-----|
| Baixa | `#1e9f63` |
| Média | `#d18807` |
| Alta | `#db3648` |
| Crítica | `#9f1239` |
| Não avaliada | `#6b7280` |

---

## Tipografia

| Aspecto | Valor |
|---------|--------|
| Família | `'Avenir Next', 'Avenir', 'Segoe UI', 'SF Pro Text', Roboto, sans-serif` |
| Peso base | 400 |
| Line-height | 1.5 |
| Títulos | pesos 600–700, cor `text` / `primary-900` |
| Corpo técnico | legível, preferir densidade controlada em parecer/checklist |

---

## Forma e elevação

| Token | Valor |
|-------|--------|
| `radius-sm` | 8px |
| `radius-md` | 12px |
| `radius-lg` | 16px |
| `radius-xl` | 20px |
| `shadow-sm` | `0 2px 8px rgba(16, 45, 96, 0.08)` |
| `shadow-md` | `0 8px 24px rgba(16, 45, 96, 0.12)` |
| `shadow-lg` | `0 18px 44px rgba(12, 42, 92, 0.18)` |

---

## Componentes e padrões de tela

- **Sidebar** com logo BaseInfra + navegação (Dashboard, Solicitações, Nova Solicitação, Nova Concessionária)
- **Cards** brancos com borda suave e sombra leve
- **Status badges** com cores semânticas
- **Overlay de análise** com etapas (preparando → normas → PDFs → checklist → parecer → final)
- **Relatório:** abas Parecer / Checklist / PDF; edição humana preservada
- **PDF:** logo empresa + logo concessionária; estrutura padrão reutilizada; variar só identidade

---

## Fundo da aplicação

Gradientes suaves em azul claro sobre `--color-bg` (já definidos em `index.css`) — atmosfera institucional, sem dark mode.

---

## Referências visuais solicitadas (materiais do cliente)

- Logos BaseInfra e concessionárias
- Relatórios finais considerados corretos
- Exemplos por concessionária
- Estrutura textual já adotada no sistema (preservar e refinar)

---

## Diretrizes para novas telas

1. Reutilizar tokens acima — não introduzir paleta paralela.
2. Preferir fluxos curtos e claros (formulário → análise → revisão → PDF).
3. Feedback de processamento sempre visível em operações longas.
4. Hierarquia: brand BaseInfra presente; concessionária destacada no relatório, não competindo no chrome principal.
5. Evitar cards/estatísticas decorativas que atrapalhem o fluxo técnico.
