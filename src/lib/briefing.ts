/**
 * Briefing do cliente: o que a equipe precisa saber quando o cliente chega.
 * Nome, endereço, telefone e e-mail já ficam no cadastro; aqui ficam as outras perguntas.
 */
export const BRIEFING: { titulo: string; perguntas: { campo: string; pergunta: string; exemplo?: string }[] }[] = [
  {
    titulo: "Visão geral do projeto",
    perguntas: [
      { campo: "descricao", pergunta: "Descrição geral do projeto", exemplo: "Ex.: cozinha, área de serviço e dormitório do casal" },
      { campo: "proposito", pergunta: "Qual o propósito do mobiliário?", exemplo: "Ex.: apartamento novo para morar, imóvel para alugar" },
    ],
  },
  {
    titulo: "Estilo e design",
    perguntas: [
      { campo: "estilo", pergunta: "Estilo desejado", exemplo: "Ex.: clássico, moderno, rústico" },
      { campo: "cores", pergunta: "Preferência de cores" },
      { campo: "inspiracao", pergunta: "Possui alguma inspiração ou referência?", exemplo: "Fotos podem ir em Documentos" },
    ],
  },
  {
    titulo: "Dimensões e espaço",
    perguntas: [
      { campo: "medidas", pergunta: "Plantas, cortes ou medidas do espaço", exemplo: "Arquivos podem ir em Documentos" },
      { campo: "restricoes_espaco", pergunta: "Existem restrições de espaço?" },
    ],
  },
  {
    titulo: "Materiais e acabamentos",
    perguntas: [
      { campo: "materiais", pergunta: "Tipos de materiais", exemplo: "Ex.: madeira, MDF, metal" },
      { campo: "acabamentos", pergunta: "Preferência de acabamentos", exemplo: "Ex.: laca, envernizado, pintura" },
      { campo: "umidade", pergunta: "Precisa considerar resistência à umidade?" },
    ],
  },
  {
    titulo: "Funcionalidades",
    perguntas: [
      { campo: "funcionalidades", pergunta: "Funcionalidades que deve ter", exemplo: "Ex.: prateleiras ajustáveis, gavetas com amortecedor" },
      { campo: "eletrica", pergunta: "Haverá instalações elétricas ou iluminação?" },
    ],
  },
  {
    titulo: "Prazo e orçamento",
    perguntas: [
      { campo: "prazo", pergunta: "Prazo desejado para a entrega (alguma data específica?)" },
      { campo: "orcamento", pergunta: "Orçamento estimado" },
    ],
  },
  {
    titulo: "Restrições ou considerações especiais",
    perguntas: [
      { campo: "restricoes", pergunta: "Limitações da obra, regras do condomínio ou outros fatores a considerar" },
    ],
  },
];

export const CAMPOS_BRIEFING = BRIEFING.flatMap((s) => s.perguntas.map((p) => p.campo));
export type RespostasBriefing = Partial<Record<string, string>>;
