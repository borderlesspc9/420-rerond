# Relatório de Análise de Conformidade (PDF)

## Diagnóstico (estado anterior)

| Item | Situação |
|------|----------|
| Frontend | React 19 + TypeScript + Vite |
| Backend análise IA | Firebase Cloud Functions |
| Backend API/uploads | Express (`server/`) proxy via Vercel `/api` |
| Auth | Firebase Auth (Bearer token) |
| Resultado da IA | `checklistConformidade` (JSON), `parecerTecnico` (Markdown), extras |
| UI pós-análise | `RelatorioViewer` com abas Parecer / Checklist; só impressão do navegador |
| PDF | `pdf-parse` / `pdfjs` para **leitura**; sem geração de relatório |

## Arquitetura da solução

```
Análise IA (Cloud Function)
        ↓
Firestore (checklist + parecer)
        ↓
RelatorioViewer → aba "Relatório PDF"
        ↓
montarRelatorioConformidade()  [metadados editáveis ≠ resultado IA]
        ↓
POST /api/solicitacoes/:id/relatorio-pdf  (Express + pdfkit + auth Firebase)
        ↓
Arquivo em uploads/relatorios/ + metadados Firestore relatoriosPdf/
        ↓
GET .../relatorio-pdf/:reportId/download
```

## Como validar

1. Subir stack:
   ```bash
   npm run dev:all
   ```
2. Em desenvolvimento, se necessário (sem token), no `.env` do servidor:
   ```env
   ALLOW_UNAUTHENTICATED_API=true
   ```
   **Não usar em produção.**
3. Abrir uma solicitação já analisada → **Ver relatório**.
4. Aba **Relatório PDF**: revisar resumo, editar metadados, enviar logotipo (PNG/JPG ≤ 2 MB).
5. **Gerar PDF** → **Baixar PDF**.
6. Confirmar histórico (versões anteriores não são sobrescritas).

## Testes

```bash
npm test
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/solicitacoes/:id/relatorio-pdf` | Gera PDF (auth) |
| GET | `/api/solicitacoes/:id/relatorio-pdf` | Lista histórico |
| GET | `/api/solicitacoes/:id/relatorio-pdf/:reportId/download` | Download |
| POST | `/api/logos-concessionaria` | Upload de logo (PNG/JPG) |

## Decisões técnicas

- **pdfkit** no backend Express: layout A4 estável, sem depender de impressão do browser.
- Metadados de apresentação são editáveis; `resultadoOriginalIa` é preservado e versionado.
- SVG **não** é aceito no upload (risco XSS); apenas PNG/JPEG com limite 2 MB e validação de dimensões.
- Logotipo BaseInfra: `public/logo420.png` (tema em `src/config/baseinfraTheme.ts`).
- Nome do arquivo: `relatorio-conformidade-[concessionaria]-[projeto]-[data].pdf`.
