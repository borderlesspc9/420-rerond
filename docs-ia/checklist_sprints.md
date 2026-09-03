# Checklist de Sprints — Análise Técnica Rodoviária com IA

> Ordem lógica: preservar o que já funciona → fechar lacunas de modelo de negócio → elevar qualidade da IA → PDF/produção.  
> **Não implementar funcionalidades fora destas sprints sem aprovação.**

---

## Sprint 0 — Alinhamento e baseline (já existente)

- [x] Auth Firebase (login interno)
- [x] Layout BaseInfra + dashboard
- [x] Nova solicitação + formulário estruturado
- [x] Upload múltiplo de PDFs + tipagem de documento
- [x] Seleção/cadastro de concessionária (wizard + perfis)
- [x] Análise IA (checklist, parecer, conferência)
- [x] Reanálise / complementos do analista
- [x] Aprovação e rejeição
- [x] Overlay de progresso / jobs assíncronos (código)
- [ ] Confirmar deploy produção: Netlify (front) + Firebase rules/functions + Render (Express legado)

---

## Sprint 1 — Cadastro persistente de clientes

- [x] Modelo Firestore `clientes` (dados reutilizáveis: razão social, CNPJ, contatos, etc.)
- [x] CRUD interno de clientes (listar / criar / editar)
- [x] Vincular solicitação/processo a um `clienteId`
- [x] Selecionar cliente existente na nova solicitação (sem redigitar tudo)
- [x] Regras Firestore para `clientes` (no repo; publicar no deploy)
- [x] Migração/compatibilidade com solicitações antigas (campo cliente livre)

---

## Sprint 2 — Processos e revisões (R00 / R01 / R02)

- [ ] Modelo de **processo** (atendimento) agrupando revisões
- [ ] Campo/revisão: `R00`, `R01`, `R02`… no mesmo processo
- [ ] UI: criar processo → primeira análise (R00)
- [ ] UI: abrir nova revisão a partir do processo (R01+)
- [ ] Histórico navegável: Cliente → Processo → Revisões → Relatórios
- [ ] Preservar vínculos e resultados anteriores (não sobrescrever R00 ao criar R01)
- [ ] Status de processo coerente com fluxo existente (`pendente`, `em_analise`, `aprovada`, `rejeitada` / equivalentes)

---

## Sprint 3 — Memória entre revisões (continuidade da análise)

- [ ] Ao analisar R01+, enviar à IA: relatório anterior + pendências + documentos novos
- [ ] Prompt/escopo: priorizar “o que foi solicitado foi corrigido?”
- [ ] Ainda detectar novas inconformidades na versão atual
- [ ] Exibir no UI comparação revisão anterior × atual (resumo)
- [ ] Não tratar revisão posterior como processo isolado
- [ ] Testes com casos reais fornecidos pelo cliente

---

## Sprint 4 — Refinamento técnico da IA

- [ ] Consolidar uso de normativas + exemplos por concessionária (contexto/RAG, sem fine-tune obrigatório)
- [ ] Reforçar diferenciação: inconformidade × documentação ausente
- [ ] Melhorar conferência formulário × documentos (divergências rastreáveis)
- [ ] Evoluir análise visual de plantas (visão multimodal) com casos piloto
- [ ] Validação técnica com o cliente (não assumir correção de engenharia sozinho)
- [ ] Ajustes de prompt a partir de feedback — sem inventar normas

---

## Sprint 5 — Feedback de processamento em produção

- [ ] Garantir jobs assíncronos ativos em produção (Cloud Functions + rules)
- [ ] Estados claros: uploaded / queued / extracting / analyzing / generating_report / completed / failed
- [ ] Overlay/lista refletindo progresso real (não só simulado)
- [ ] Retomada de job ao recarregar a página
- [ ] Mensagens de falha acionáveis para o analista
- [ ] Evitar análise duplicada concorrente no mesmo processo/revisão

---

## Sprint 6 — PDF final profissional

- [ ] Fechar PDF com estrutura padrão da empresa/concessionária
- [ ] Logo BaseInfra + logo/identidade da concessionária
- [ ] Seções: identificação, checklist, conclusões, observações
- [ ] Não alterar conteúdo técnico só por layout
- [ ] Reutilizar template compartilhado (evitar duplicar por concessionária)
- [ ] Validar PDF com relatório “modelo correto” do cliente

---

## Sprint 7 — Concessionárias (ajustes finos, sem duplicar lógica)

- [ ] Manter template compartilhado Ecovias (estrutura igual; muda concessão/logo)
- [ ] Completar materiais de referência por concessionária (normas, exemplos, logos)
- [ ] Garantir que perfil Firestore alimenta a IA sem hardcode desnecessário
- [ ] Documentar o que é “perfil custom” vs perfis legado (eco101/motiva/arteris)
- [ ] Limpar ambiguidades de cadastro (Firestore vs localStorage) com migração suave

---

## Sprint 8 — Polimento operacional (secundário à qualidade da IA)

- [ ] Ajustes de UX no fluxo Cliente → Processo → Revisão → Análise → PDF
- [ ] Melhorias de listagem/filtros por cliente, processo e status
- [ ] Checklist de QA interno com poucos usuários reais
- [ ] Documentar como operar (analista) e como configurar (admin)
- [ ] Revisar custos/limites de IA e tamanho de PDF antes de escalar

---

## Fora destas sprints (requer nova aprovação)

- Portal público para clientes externos  
- Edição automática de plantas  
- Migração de Firebase/AWS sem decisão do cliente  
- Fine-tuning de modelo como requisito  
- Novos tipos de projeto sem normativa fornecida  
