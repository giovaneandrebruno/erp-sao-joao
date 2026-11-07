const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function brl(valor: number | string | null | undefined) {
  return moeda.format(Number(valor ?? 0));
}

export function data(valor: string | null | undefined) {
  if (!valor) return "—";
  const [a, m, d] = valor.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function texto(form: FormData, campo: string) {
  const v = String(form.get(campo) ?? "").trim();
  return v === "" ? null : v;
}

export function numero(form: FormData, campo: string) {
  const v = String(form.get(campo) ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const ROTULOS = {
  unidade: { marcenaria: "Marcenaria", loja: "Loja" },
  statusOrcamento: { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado" },
  statusPedido: {
    aberto: "Aberto",
    em_producao: "Em produção",
    pronto: "Pronto",
    entregue: "Entregue",
    cancelado: "Cancelado",
  },
  etapa: {
    aguardando: "Aguardando",
    corte: "Corte",
    fita_borda: "Fita de borda",
    montagem: "Montagem",
    acabamento: "Acabamento",
    pronto: "Pronto",
    instalacao: "Instalação",
    concluido: "Concluído",
  },
  tipoProduto: { materia_prima: "Matéria-prima", produto: "Produto", servico: "Serviço" },
} as const;

export const ETAPAS = Object.keys(ROTULOS.etapa) as (keyof typeof ROTULOS.etapa)[];

export const COR_PEDIDO = { aberto: "blue", em_producao: "amber", pronto: "green", entregue: "stone", cancelado: "red" } as const;

export const ROTULOS2 = {
  etapaNegociacao: {
    novo: "Novo contato",
    contato: "Em conversa",
    medicao: "Medição",
    projeto: "Projeto",
    proposta: "Proposta enviada",
    negociacao: "Negociação",
    ganho: "Ganho",
    perdido: "Perdido",
  },
  tipoParceiro: { vendedor: "Vendedor", arquiteto: "Arquiteto / designer", montador: "Montador" },
  formaPagamento: {
    pix: "Pix",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    cartao_credito: "Cartão de crédito",
    cartao_debito: "Cartão de débito",
    financiamento: "Financiamento",
  },
  marco: {
    medicao: "Medição",
    projeto_executivo: "Projeto executivo",
    compra_material: "Compra de material",
    producao: "Produção concluída",
    entrega: "Entrega",
    montagem: "Montagem",
    vistoria: "Vistoria final",
  },
  statusChamado: { aberto: "Aberto", agendado: "Agendado", em_atendimento: "Em atendimento", resolvido: "Resolvido" },
} as const;

export const ETAPAS_NEGOCIACAO = Object.keys(ROTULOS2.etapaNegociacao) as (keyof typeof ROTULOS2.etapaNegociacao)[];

export function pct(valor: number | string | null | undefined) {
  return `${Number(valor ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}
