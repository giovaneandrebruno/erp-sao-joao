/**
 * Processo do pedido, do fechamento da venda até a conclusão (ou assistência / cancelamento).
 * 11 etapas, cada uma com o que precisa acontecer para passar adiante,
 * 23 situações (com o cargo responsável e o prazo sugerido em dias),
 * 3 checklists e as assinaturas que ficam na pasta do cliente.
 */
import type { TipoDocumento } from "@/lib/documentos";

export const ETAPAS = {
  pre_venda: { nome: "Pré-venda", criterio: "Projeto pronto" },
  venda: { nome: "Venda", criterio: "Contrato assinado" },
  medicao: { nome: "Medição", criterio: "Medição arquivada" },
  executivo: { nome: "Executivo", criterio: "Executivo assinado" },
  fabricacao: { nome: "Fabricação", criterio: "Saiu da fábrica ou chegou no depósito" },
  entrega: { nome: "Entrega", criterio: "Material no local da montagem" },
  montagem: { nome: "Montagem", criterio: "Montagem realizada" },
  pos_montagem: { nome: "Pós-montagem", criterio: "Termo de finalização sem pendência" },
  concluido: { nome: "Concluído", criterio: "" },
  assistencia: { nome: "Assistência técnica", criterio: "Termo de assistência finalizado" },
  cancelamento: { nome: "Cancelamento", criterio: "" },
} as const;
export type Etapa = keyof typeof ETAPAS;
export const ORDEM_ETAPAS = Object.keys(ETAPAS) as Etapa[];
/** Etapas da linha principal (assistência e cancelamento ficam fora da sequência). */
export const LINHA_PRINCIPAL: Etapa[] = ["pre_venda", "venda", "medicao", "executivo", "fabricacao", "entrega", "montagem", "pos_montagem", "concluido"];
export const ehEtapa = (v: unknown): v is Etapa => typeof v === "string" && Object.hasOwn(ETAPAS, v);
export const nomeEtapa = (e: string | null | undefined) => (e && ehEtapa(e) ? ETAPAS[e].nome : "—");

export type Situacao = { etapa: Etapa; nome: string; detalhe?: string; responsavel: string; prazoDias: number | null };

/** As 23 situações. prazoDias é a sugestão para a data limite quando a situação começa. */
export const SITUACOES = {
  qualificar: { etapa: "pre_venda", nome: "Qualificar", detalhe: "Briefing e agendar apresentação", responsavel: "Consultor", prazoDias: 2 },
  projeto_venda: { etapa: "pre_venda", nome: "Projeto de venda", detalhe: "Desenvolver e fazer follow-up", responsavel: "Consultor", prazoDias: 7 },
  em_negociacao: { etapa: "venda", nome: "Em negociação", detalhe: "Assinatura do contrato", responsavel: "Consultor / gerente", prazoDias: 7 },
  carteira_futura: { etapa: "venda", nome: "Carteira futura", detalhe: "Venda para mais adiante", responsavel: "Consultor", prazoDias: 30 },
  medicao_imediata: { etapa: "medicao", nome: "Medição imediata", detalhe: "Previsão para medir", responsavel: "Setor técnico", prazoDias: 5 },
  medicao_futura: { etapa: "medicao", nome: "Medição futura", detalhe: "Obra ainda não liberada", responsavel: "Comercial / projetos", prazoDias: 30 },
  previsao_assinar: { etapa: "executivo", nome: "Previsão para assinar (DLP)", detalhe: "Cliente assinar o executivo", responsavel: "Setor técnico", prazoDias: null },
  aguardando_cliente: { etapa: "executivo", nome: "Aguardando cliente (parado)", detalhe: "Depende de resposta do cliente", responsavel: "Consultor", prazoDias: 7 },
  dle_previsto: { etapa: "executivo", nome: "DLE previsto", detalhe: "Previsão para o início da montagem", responsavel: "Logística", prazoDias: null },
  previsao_saida_fabrica: { etapa: "fabricacao", nome: "Previsão de saída da fábrica", detalhe: "Em fabricação", responsavel: "Logística", prazoDias: 30 },
  dle: { etapa: "fabricacao", nome: "DLE (data limite de entrega)", detalhe: "Prazo final combinado com o cliente", responsavel: "Logística", prazoDias: null },
  previsao_entrega: { etapa: "entrega", nome: "Previsão de entrega", detalhe: "Entrega agendada", responsavel: "Logística", prazoDias: 5 },
  aguardando_cliente_entrega: { etapa: "entrega", nome: "Aguardando cliente", detalhe: "Obra ou cliente sem liberar a entrega", responsavel: "Logística", prazoDias: 7 },
  previsao_termino_montagem: { etapa: "montagem", nome: "Previsão de término da montagem", responsavel: "Supervisor de montagem", prazoDias: 10 },
  pendencia_montagem: { etapa: "montagem", nome: "Pendência na montagem", detalhe: "Peça, avaria ou alteração", responsavel: "Supervisor de montagem", prazoDias: 7 },
  pendencia_pos_montagem: { etapa: "pos_montagem", nome: "Pendência de pós-montagem", detalhe: "Peças pedidas à fábrica", responsavel: "Setor técnico", prazoDias: 30 },
  relatorio_fotografico: { etapa: "pos_montagem", nome: "Relatório fotográfico da finalização", responsavel: "Supervisor de montagem", prazoDias: 2 },
  revisao_programada: { etapa: "concluido", nome: "Revisão programada", detalhe: "Nova venda, financiamento", responsavel: "Pós-venda", prazoDias: 180 },
  avaliacao: { etapa: "concluido", nome: "Avaliação (satisfação)", detalhe: "Nota do cliente de 0 a 10", responsavel: "Pós-venda", prazoDias: 3 },
  depende_loja: { etapa: "assistencia", nome: "Depende só da loja", responsavel: "Pós-venda", prazoDias: 7 },
  depende_fabrica: { etapa: "assistencia", nome: "Depende da fábrica", responsavel: "Setor técnico", prazoDias: 30 },
  comprou_outra_loja: { etapa: "cancelamento", nome: "Comprou em outra loja", responsavel: "Gerente", prazoDias: null },
  outro_motivo: { etapa: "cancelamento", nome: "Outro motivo", detalhe: "Sem informação", responsavel: "Gerente", prazoDias: null },
} as const satisfies Record<string, Situacao>;
export type ChaveSituacao = keyof typeof SITUACOES;
export const ehSituacao = (v: unknown): v is ChaveSituacao => typeof v === "string" && Object.hasOwn(SITUACOES, v);
export const situacoesDa = (e: Etapa) => (Object.entries(SITUACOES) as [ChaveSituacao, Situacao][]).filter(([, s]) => s.etapa === e);
export const nomeSituacao = (s: string | null | undefined) => (s && ehSituacao(s) ? SITUACOES[s].nome : null);

/** Os 3 checklists do processo. */
export const CHECKLISTS = {
  venda_realizada: {
    nome: "Venda realizada",
    periodo: "da venda até a medição",
    itens: [
      "Cliente cadastrado com os dados corretos",
      "Endereço completo da obra",
      "Forma de pagamento combinada registrada",
      "Memorial descritivo e detalhamento do que foi vendido",
      "Contrato de venda assinado",
      "Pasta conferida pelo gerente",
      "Pagamento conferido e parcelas lançadas no financeiro",
      "Medição agendada",
      "Medição feita e arquivada",
      "Medidas dos eletros recebidas ou isenção assinada",
    ],
  },
  executivo_implantado: {
    nome: "Executivo implantado",
    periodo: "do executivo até a fabricação",
    itens: [
      "Projeto executivo desenvolvido",
      "Dúvidas tiradas com consultor, cliente ou arquiteto",
      "Executivo repassado com o consultor",
      "Executivo assinado pelo cliente",
      "Listagem de peças gerada e conferida",
      "Desenhos de peças especiais enviados à fábrica",
      "Pedido enviado à fábrica",
      "Pedidos dos parceiros enviados",
      "Pagamento à fábrica feito",
      "Caderno de montagem gerado e repassado ao montador",
    ],
  },
  finalizacao_obra: {
    nome: "Finalização de obra",
    periodo: "da montagem até a loja, com relatório fotográfico",
    itens: [
      "Mercadoria conferida no cliente",
      "Avarias e divergências registradas nas ocorrências",
      "Montagem concluída conforme o projeto",
      "Limpeza geral e marcações de lápis retiradas",
      "Tapa-furos, capas e acabamentos conferidos",
      "Checklist feito junto com o cliente",
      "Termo de vistoria assinado",
      "Manual de garantia e limpeza entregue",
      "Relatório fotográfico da finalização enviado",
      "Pendências remarcadas como assistência",
    ],
  },
} as const;
export type ChaveChecklist = keyof typeof CHECKLISTS;
export const ehChecklist = (v: unknown): v is ChaveChecklist => typeof v === "string" && Object.hasOwn(CHECKLISTS, v);
export type MarcasChecklists = Partial<Record<ChaveChecklist, Record<string, boolean>>>;

export function progressoChecklist(marcas: MarcasChecklists | null | undefined, c: ChaveChecklist) {
  const feitos = CHECKLISTS[c].itens.filter((i) => marcas?.[c]?.[i]).length;
  return { feitos, total: CHECKLISTS[c].itens.length, completo: feitos === CHECKLISTS[c].itens.length };
}

/** Assinaturas e documentos que a pasta precisa ter, e a etapa em que passam a ser cobrados (para sair dela). */
export const ASSINATURAS: { tipo: TipoDocumento; nome: string; ate: Etapa; ou?: TipoDocumento }[] = [
  { tipo: "pedido_fechado", nome: "Pedido fechado", ate: "venda" },
  { tipo: "contrato", nome: "Contrato de venda", ate: "venda" },
  { tipo: "memorial_descritivo", nome: "Memorial descritivo", ate: "venda" },
  { tipo: "isencao_eletros", nome: "Isenção das medidas dos eletros", ate: "medicao", ou: "eletrodomesticos" },
  { tipo: "executivo_assinado", nome: "Projeto executivo", ate: "executivo" },
  { tipo: "liberacao_entrega", nome: "Liberação de entrega", ate: "entrega" },
  { tipo: "termo_entrega", nome: "Termo de entrega", ate: "entrega" },
  { tipo: "termo_vistoria", nome: "Termo de vistoria (montagem finalizada)", ate: "pos_montagem" },
];

/** O que precisa estar pronto para sair de cada etapa (além das assinaturas acima). */
const CHECKLIST_PARA_SAIR: Partial<Record<Etapa, ChaveChecklist>> = {
  medicao: "venda_realizada",
  fabricacao: "executivo_implantado",
  pos_montagem: "finalizacao_obra",
};

export type DadosParaAvancar = {
  etapaAtual: Etapa;
  destino: Etapa;
  documentos: Set<string>;
  checklists: MarcasChecklists | null | undefined;
  pagamentoCombinado: string | null | undefined;
  pastaDevolvida: boolean;
};

/** Lista o que falta para o pedido passar da etapa atual até a etapa de destino. Vazia = pode passar. */
export function pendenciasParaAvancar(d: DadosParaAvancar): string[] {
  const i = LINHA_PRINCIPAL.indexOf(d.etapaAtual);
  const j = LINHA_PRINCIPAL.indexOf(d.destino);
  if (i < 0 || j < 0 || j <= i) return []; // voltar, assistência e cancelamento não travam
  const faltas: string[] = [];
  if (d.pastaDevolvida) faltas.push("A pasta do cliente está devolvida para correção");
  for (const etapa of LINHA_PRINCIPAL.slice(i, j)) {
    if (etapa === "venda" && !d.pagamentoCombinado?.trim()) faltas.push("Registrar a forma de pagamento combinada no fechamento");
    for (const a of ASSINATURAS.filter((x) => x.ate === etapa)) {
      if (!d.documentos.has(a.tipo) && !(a.ou && d.documentos.has(a.ou))) faltas.push(`Falta na pasta: ${a.nome}${a.ou ? " (ou as medidas dos eletros)" : ""}`);
    }
    const c = CHECKLIST_PARA_SAIR[etapa];
    if (c && !progressoChecklist(d.checklists, c).completo) {
      const p = progressoChecklist(d.checklists, c);
      faltas.push(`Completar o checklist "${CHECKLISTS[c].nome}" (${p.feitos} de ${p.total})`);
    }
  }
  return faltas;
}

/** Situação da assinatura na pasta: já tem, falta (a etapa já passou) ou ainda não é cobrada. */
export function situacaoAssinatura(a: (typeof ASSINATURAS)[number], documentos: Set<string>, etapaAtual: Etapa | null): "tem" | "falta" | "depois" {
  if (documentos.has(a.tipo) || (a.ou && documentos.has(a.ou))) return "tem";
  if (!etapaAtual) return "depois";
  const atual = LINHA_PRINCIPAL.indexOf(etapaAtual === "assistencia" ? "concluido" : etapaAtual);
  if (atual < 0) return "depois";
  return LINHA_PRINCIPAL.indexOf(a.ate) <= atual ? "falta" : "depois";
}

/* ───────────────────────── pagamento do cliente ───────────────────────── */

export type StatusPagamento = "sem_parcelas" | "quitado" | "atrasado" | "em_dia" | "parcial";
export const ROTULO_PAGAMENTO: Record<StatusPagamento, string> = {
  sem_parcelas: "Parcelas não lançadas",
  quitado: "Pago (quitado)",
  atrasado: "Pagamento atrasado",
  em_dia: "Pagamento em dia",
  parcial: "Em dia, falta lançar parcelas",
};
export const COR_PAGAMENTO: Record<StatusPagamento, "green" | "red" | "amber" | "blue" | "stone"> = {
  sem_parcelas: "amber", quitado: "green", atrasado: "red", em_dia: "blue", parcial: "amber",
};

/** Status de pagamento do cliente a partir das parcelas a receber do pedido. */
export function statusPagamento(total: number, parcelas: { valor: number | string; vencimento: string; pago_em: string | null }[], hoje: string) {
  const lancado = parcelas.reduce((s, l) => s + Number(l.valor), 0);
  const recebido = parcelas.filter((l) => l.pago_em).reduce((s, l) => s + Number(l.valor), 0);
  const vencido = parcelas.filter((l) => !l.pago_em && l.vencimento < hoje).reduce((s, l) => s + Number(l.valor), 0);
  let status: StatusPagamento;
  if (!parcelas.length) status = total > 0 ? "sem_parcelas" : "quitado";
  else if (vencido > 0.009) status = "atrasado";
  else if (recebido >= total - 0.009) status = "quitado";
  else if (lancado < total - 0.009) status = "parcial";
  else status = "em_dia";
  return { status, lancado, recebido, vencido };
}

/* ───────────────────────── ocorrências e assistência ───────────────────────── */

export const TIPOS_OCORRENCIA = {
  embalagem_avariada: "Embalagem avariada",
  peca_defeito: "Peça com defeito",
  peca_faltando: "Peça faltando",
  corte_extra: "Corte feito na obra",
  peca_extra: "Peça extra",
  alteracao_projeto: "Alteração de projeto",
  outro: "Outro",
} as const;
export type TipoOcorrencia = keyof typeof TIPOS_OCORRENCIA;
export const ehTipoOcorrencia = (v: unknown): v is TipoOcorrencia => typeof v === "string" && Object.hasOwn(TIPOS_OCORRENCIA, v);

export const TIPOS_ASSISTENCIA = { garantia: "Garantia de fábrica", mau_uso: "Mau uso / fora da garantia" } as const;
export const DEPENDE_DE = { loja: "Depende só da loja", fabrica: "Depende da fábrica" } as const;
/** Garantia de fábrica: 1 ano. */
export const DIAS_GARANTIA = 365;
