# Escopo — Sistema de Análise Técnica de Projetos Rodoviários com IA

## Objetivo principal

Automatizar a **análise técnica** de projetos de infraestrutura rodoviária enviados a concessionárias, apontando conformidades, inconformidades, pendências e fundamentação normativa, com revisão humana obrigatória e geração de relatório técnico (incluindo PDF).

O sistema **não altera** plantas ou arquivos técnicos. Ele **analisa e aponta**.

---

## Prioridade máxima

**Qualidade da análise técnica da IA.**

Cadastro, aparência e formatação são importantes, porém secundários frente à precisão da análise.

---

## Perfis de usuário

| Perfil | Descrição | Acesso |
|--------|-----------|--------|
| **Analista interno** | Usuário principal do sistema | Login, solicitações, análise, revisão, aprovação/rejeição, PDF |
| **Admin / Operação** | Configuração operacional | Concessionárias, normas/referências, logos, materiais de contexto |
| **Cliente externo** | Fora do escopo atual | Não há portal público; clientes são cadastro interno reutilizável |

Sistema de **uso interno** da empresa (poucos usuários no início).

---

## Fluxo central

1. Login  
2. Cliente (cadastro persistente)  
3. Solicitação / Processo  
4. Informações do projeto (formulário)  
5. Upload de documentos (múltiplos PDFs + classificação)  
6. Seleção da concessionária / padrão  
7. Análise da IA  
8. Revisão humana (edição / complementos)  
9. Ajustes e reprocessamento  
10. Geração do relatório técnico  
11. Exportação em PDF  

---

## Regras de negócio claras

1. A IA analisa **texto, imagens/plantas, formulário, anexos e normativas** — não só OCR de PDF.
2. Comparar formulário × documentos × plantas e evidenciar **divergências**.
3. Diferenciar **inconformidade** de **informação/documentação ausente**.
4. Não inventar requisitos técnicos; usar apenas normas e materiais fornecidos.
5. Não inventar dados não presentes nos documentos.
6. Checklist baseado no padrão da concessionária e nos documentos reais — sem itens fictícios.
7. Relatório editável; analista pode concordar, discordar, corrigir, complementar e reprocessar.
8. Prompt customizado **complementa** regras permanentes; **não** pode fazer a IA ignorar normas.
9. IA não é autoridade técnica final — revisão humana obrigatória.
10. Concessionárias compartilham template quando possível; variar logo/nome/identidade.
11. Clientes são **persistentes** e reutilizados em novas solicitações/revisões.
12. Revisões **R00 / R01 / R02…** pertencem ao **mesmo processo**, com histórico preservado.
13. Análise de revisão posterior deve considerar relatório e pendências anteriores: *“o que foi pedido foi corrigido?”*
14. Feedback visual de processamento durante análises longas.
15. Não criar/alterar projetos de engenharia automaticamente.
16. Não migrar infraestrutura (Firebase/AWS/IA) sem avaliar o existente e confirmar com o cliente.

---

## Funcionalidades core

### Já existentes (preservar)

- Auth (Firebase)
- Dashboard / listagem de solicitações
- Nova solicitação + formulário estruturado
- Upload múltiplo de PDFs + tipagem de documento
- Seleção / cadastro de concessionária (wizard + perfis)
- Análise por IA (checklist, parecer, conferência formulário×documento)
- Escopo de análise / prompt customizado
- Reanálise e complementos do analista
- Overlay/progresso de análise (jobs assíncronos no código)
- Aprovação / rejeição
- Base de PDF / identidade BaseInfra + logo da concessionária

### Evoluções prioritárias (próximas)

1. **Cadastro persistente de clientes**
2. **Processos e revisões (R00/R01/R02)** vinculados
3. **Memória da análise anterior** na reanálise
4. **Refinamento técnico da IA** (normas, exemplos, vision de plantas)
5. **Feedback de processamento** robusto em produção
6. **PDF final profissional** alinhado ao padrão real
7. **Ajustes de concessionárias** sem duplicar lógica (template compartilhado)

---

## Fora do escopo

- Criar ou corrigir plantas/projetos automaticamente
- Substituir o engenheiro/analista
- Aprovar tecnicamente sem revisão humana
- Plataforma pública complexa para clientes externos
- Fine-tuning obrigatório de modelo (usar contexto/exemplos/RAG quando adequado)

---

## Tipos de projeto (exemplos)

Acessos, ocupações, redes elétricas, esgoto, publicidade/outdoors, sinalização e outras intervenções em faixa de domínio — **somente com normativa/material de referência**.

---

## Documentos de entrada (exemplos)

Requerimento, memorial, plano de trabalho, planta baixa, perfil, sinalização, ART e demais — classificação pelo usuário; **não obrigar todos** em toda solicitação.
