import type { GoldenCase } from '../../models/GoldenCase'
import { newParId } from '../../utils/goldenCasePrompt'

/** Seeds sintéticos para mock/demo — substituir pelos casos reais do cliente. */
export const GOLDEN_CASES_SEED: Omit<GoldenCase, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'seed-ocupacao-001',
    codigo: 'ocupacao-faixa/caso-001',
    titulo: 'Ocupação — ART vinculada ao projeto',
    tipoAnaliseId: 'ocupacao-faixa',
    descricao: 'Caso modelo: IA marcou ART como ausente embora constasse no PDF.',
    erroIa: 'Declarou ART ausente sem citar inspeção do PDF anexado.',
    analiseCorreta:
      'ART presente no arquivo indicado; status OK com evidência de página e vínculo ao RT.',
    observacoes: 'Seed sintético — substituir por caso real do cliente.',
    pares: [
      {
        id: newParId(),
        regraOuItem: 'ART do projeto',
        original: 'ART não encontrada nos documentos.',
        correto:
          'ART constante no PDF de ART, vinculada ao responsável técnico do memorial.',
        justificativa:
          'Só declarar ausência após citar arquivo/páginas inspecionadas; o PDF de ART estava anexado.',
      },
    ],
    documentosRef: [{ nome: 'art-exemplo.pdf', url: null, storagePath: null }],
    status: 'aprovado',
    ativo: true,
  },
  {
    id: 'seed-acesso-001',
    codigo: 'acesso/caso-001',
    titulo: 'Acesso — geometria de entrada',
    tipoAnaliseId: 'acesso',
    descricao: 'Caso modelo: IA aplicou checklist de ocupação em processo de acesso.',
    erroIa: 'Exigiu perfil de travessia de ocupação em faixa em projeto de acesso.',
    analiseCorreta:
      'Avaliar geometria de entrada/saída e visibilidade; não exigir itens exclusivos de ocupação.',
    observacoes: 'Seed sintético — substituir por caso real do cliente.',
    pares: [
      {
        id: newParId(),
        regraOuItem: 'Isolamento por tipo',
        original: 'Falta perfil de travessia / seção de ocupação.',
        correto:
          'Item de ocupação não se aplica; verificar raios, larguras e visibilidade do acesso.',
        justificativa:
          'Checklist de ocupação não deve contaminar análise de acesso (mesmo tipoAnaliseId=acesso).',
      },
    ],
    documentosRef: [{ nome: 'planta-acesso-exemplo.pdf', url: null, storagePath: null }],
    status: 'aprovado',
    ativo: true,
  },
  {
    id: 'seed-pac-001',
    codigo: 'pac/caso-001',
    titulo: 'PAC — documentação mínima',
    tipoAnaliseId: 'pac',
    descricao: 'Caso modelo: IA exigiu memorial de ocupação em PAC.',
    erroIa: 'Solicitou memorial descritivo de ocupação em faixa para PAC.',
    analiseCorreta:
      'Usar requisitos PAC (documentação e escopo do plano); não importar OCUP_*.',
    observacoes: 'Seed sintético — substituir por caso real do cliente.',
    pares: [
      {
        id: newParId(),
        regraOuItem: 'Escopo PAC',
        original: 'Memorial de ocupação incompleto (afastamentos laterais).',
        correto: 'Avaliar documentação do PAC conforme checklist do tipo; item OCUP não se aplica.',
        justificativa: 'Isolamento por tipo: PAC ≠ ocupação em faixa.',
      },
    ],
    documentosRef: [{ nome: 'pac-exemplo.pdf', url: null, storagePath: null }],
    status: 'aprovado',
    ativo: true,
  },
]
