/** Nomes usados nas telas de Estoque e Compras. */

export const CATEGORIAS = {
  chapa: "Chapas (MDF, MDP, compensado)",
  fita: "Fitas de borda",
  ferragem: "Ferragens (dobradiças, corrediças...)",
  acessorio: "Acessórios e puxadores",
  insumo: "Insumos (cola, parafuso, lixa...)",
  vidro_aluminio: "Vidros, espelhos e alumínio",
  embalagem: "Embalagem e proteção",
  outro: "Outros",
} as const;
export type Categoria = keyof typeof CATEGORIAS;

/** Nome curto da categoria, para listas e selos. */
export const CATEGORIA_CURTA: Record<Categoria, string> = {
  chapa: "Chapa",
  fita: "Fita de borda",
  ferragem: "Ferragem",
  acessorio: "Acessório",
  insumo: "Insumo",
  vidro_aluminio: "Vidro / alumínio",
  embalagem: "Embalagem",
  outro: "Outro",
};

export const TIPO_MOVIMENTO = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste (novo saldo)" } as const;

export const ORIGEM_MOVIMENTO = {
  manual: "Lançamento manual",
  compra: "Recebimento de compra",
  pedido: "Uso em pedido",
  inventario: "Inventário",
  perda: "Perda ou avaria",
  devolucao: "Devolução",
} as const;
export type Origem = keyof typeof ORIGEM_MOVIMENTO;

export const STATUS_COMPRA = {
  rascunho: "Rascunho",
  enviado: "Enviado ao fornecedor",
  parcial: "Recebido em parte",
  recebido: "Recebido",
  cancelado: "Cancelado",
} as const;
export type StatusCompra = keyof typeof STATUS_COMPRA;
export const COR_COMPRA = { rascunho: "stone", enviado: "blue", parcial: "amber", recebido: "green", cancelado: "red" } as const;

export const STATUS_REQUISICAO = { aberta: "Aberta", em_cotacao: "Em cotação", comprada: "Comprada", cancelada: "Cancelada" } as const;
export type StatusRequisicao = keyof typeof STATUS_REQUISICAO;
export const COR_REQUISICAO = { aberta: "blue", em_cotacao: "amber", comprada: "green", cancelada: "stone" } as const;

export const STATUS_COTACAO = { aberta: "Aberta", fechada: "Fechada", cancelada: "Cancelada" } as const;
export type StatusCotacao = keyof typeof STATUS_COTACAO;
export const COR_COTACAO = { aberta: "blue", fechada: "green", cancelada: "stone" } as const;

export const STATUS_INVENTARIO = { aberto: "Em contagem", concluido: "Concluído", cancelado: "Cancelado" } as const;
export type StatusInventario = keyof typeof STATUS_INVENTARIO;
export const COR_INVENTARIO = { aberto: "amber", concluido: "green", cancelado: "stone" } as const;

/** Medida padrão de chapa quando o cadastro não informa (mm). */
export const CHAPA_PADRAO = { largura: 2750, altura: 1850 };

/** Arredonda quantidades (3 casas, como no banco). */
export const arred = (n: number) => Math.round(n * 1000) / 1000;

/** Quantidade com unidade, sem zeros sobrando: "12,5 m". */
export function qtd(n: number | string | null | undefined, unidade?: string | null) {
  const v = Number(n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return unidade ? `${v} ${unidade}` : v;
}

/** Total do pedido de compra: itens + frete − desconto. */
export const totalDaCompra = (c: { frete: number | string; desconto: number | string; itens: { quantidade: number | string; preco_unitario: number | string }[] }) =>
  c.itens.reduce((s, i) => s + Number(i.quantidade) * Number(i.preco_unitario), 0) + Number(c.frete) - Number(c.desconto);
