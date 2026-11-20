/**
 * Menu do sistema: seções, abas e sub-abas.
 * No menu lateral cada aba é uma linha só (sem abrir e fechar). Quando a aba tem "filhos",
 * o menu leva para a primeira sub-aba e as sub-abas aparecem como abas no topo da tela.
 * Também alimenta o caminho no topo da tela e a busca rápida (Ctrl+K).
 */
export type Icone =
  | "painel" | "vendas" | "clientes" | "pedidos" | "producao" | "estoque" | "compras"
  | "financeiro" | "analises" | "equipe" | "configuracoes" | "importar" | "agenda";

export type Folha = { href: string; rotulo: string; dica?: string };
export type Aba = { rotulo: string; icone: Icone; href?: string; filhos?: Folha[] };
export type Secao = { titulo?: string; abas: Aba[] };

export const NAVEGACAO: Secao[] = [
  { abas: [{ rotulo: "Painel", icone: "painel", href: "/" }] },
  {
    titulo: "Comercial",
    abas: [
      {
        rotulo: "Vendas",
        icone: "vendas",
        filhos: [
          { href: "/crm", rotulo: "Funil de vendas", dica: "Negociações por etapa" },
          { href: "/orcamentos", rotulo: "Orçamentos", dica: "Propostas e aprovações" },
        ],
      },
      { rotulo: "Agenda", icone: "agenda", href: "/agenda" },
      { rotulo: "Clientes", icone: "clientes", href: "/clientes" },
    ],
  },
  {
    titulo: "Operação",
    abas: [
      {
        rotulo: "Pedidos",
        icone: "pedidos",
        filhos: [
          { href: "/pedidos", rotulo: "Todos os pedidos" },
          { href: "/prazos", rotulo: "Prazos", dica: "Marcos atrasados e próximos" },
        ],
      },
      {
        rotulo: "Produção",
        icone: "producao",
        filhos: [
          { href: "/producao", rotulo: "Quadro de produção", dica: "OS por etapa da legenda" },
          { href: "/producao?ver=planilha", rotulo: "Planilha completa", dica: "Todas as colunas da planilha de PCP" },
          { href: "/producao?ver=concluidos", rotulo: "Concluídos" },
          { href: "/assistencia", rotulo: "Assistência técnica" },
        ],
      },
      {
        rotulo: "Estoque",
        icone: "estoque",
        filhos: [
          { href: "/estoque", rotulo: "Saldo", dica: "Quanto tem, quanto está reservado e quanto está livre" },
          { href: "/estoque/movimentos", rotulo: "Movimentações", dica: "Entradas, saídas e ajustes" },
          { href: "/estoque/reservas", rotulo: "Reservas por pedido", dica: "Material separado para cada pedido" },
          { href: "/estoque/calcular", rotulo: "Calcular material", dica: "Chapas, fita e ferragens a partir das peças" },
          { href: "/estoque/consumo", rotulo: "Consumo por cliente", dica: "Material usado e comprado para cada cliente" },
          { href: "/estoque/inventario", rotulo: "Inventário", dica: "Contagem do estoque e ajuste do saldo" },
          { href: "/estoque/sobras", rotulo: "Sobras de chapa", dica: "Retalhos para reaproveitar" },
        ],
      },
      {
        rotulo: "Compras",
        icone: "compras",
        filhos: [
          { href: "/compras", rotulo: "O que comprar", dica: "Falta para pedidos e abaixo do mínimo" },
          { href: "/compras/requisicoes", rotulo: "Requisições", dica: "Pedidos de material feitos pela equipe" },
          { href: "/compras/cotacoes", rotulo: "Cotações", dica: "Comparar preço e prazo entre fornecedores" },
          { href: "/compras/pedidos", rotulo: "Pedidos de compra", dica: "O que foi comprado de cada fornecedor" },
          { href: "/compras/recebimento", rotulo: "Recebimento", dica: "Conferir o que chegou e dar entrada no estoque" },
          { href: "/fornecedores", rotulo: "Fornecedores" },
        ],
      },
    ],
  },
  {
    titulo: "Gestão",
    abas: [
      {
        rotulo: "Financeiro",
        icone: "financeiro",
        filhos: [
          { href: "/financeiro", rotulo: "Lançamentos" },
          { href: "/financeiro?situacao=vencidos", rotulo: "Vencidos" },
          { href: "/financeiro/extrato", rotulo: "Conferir com o extrato", dica: "Marca como pago o que já caiu no banco" },
        ],
      },
      {
        rotulo: "Análises e relatórios",
        icone: "analises",
        filhos: [
          { href: "/analises", rotulo: "Visão geral" },
          { href: "/analises?aba=vendas", rotulo: "Vendas" },
          { href: "/analises?aba=funil", rotulo: "Funil" },
          { href: "/analises?aba=producao", rotulo: "Produção e prazos" },
          { href: "/analises?aba=financeiro", rotulo: "Financeiro" },
          { href: "/relatorios", rotulo: "Relatórios do mês" },
        ],
      },
    ],
  },
  {
    titulo: "Sistema",
    abas: [
      { rotulo: "Importar arquivos", icone: "importar", href: "/importar" },
      {
        rotulo: "Melhorias e histórico",
        icone: "analises",
        filhos: [
          { href: "/melhorias", rotulo: "Melhorias do sistema", dica: "Ideias com nota de ajuda e de trabalho" },
          { href: "/historico", rotulo: "Histórico de alterações", dica: "Quem mudou o quê e quando" },
        ],
      },
      { rotulo: "Equipe e parceiros", icone: "equipe", href: "/equipe" },
      { rotulo: "Configurações", icone: "configuracoes", href: "/configuracoes" },
    ],
  },
];

/** Ações rápidas da busca (Ctrl+K). */
export const ACOES_RAPIDAS: Folha[] = [
  { href: "/clientes/novo", rotulo: "Cadastrar cliente" },
  { href: "/crm/nova", rotulo: "Nova negociação" },
  { href: "/orcamentos/novo", rotulo: "Novo orçamento" },
  { href: "/producao/nova", rotulo: "Nova ordem de serviço (produção)" },
  { href: "/estoque/novo", rotulo: "Cadastrar produto" },
  { href: "/compras/requisicoes?novo=1", rotulo: "Nova requisição de compra" },
  { href: "/compras/pedidos?novo=1", rotulo: "Novo pedido de compra" },
  { href: "/financeiro?novo=1", rotulo: "Novo lançamento financeiro" },
];

const semBusca = (href: string) => href.split("?")[0];

/** Todas as telas, com o caminho "Seção / Aba" para mostrar na busca e no topo. */
export function telas() {
  const lista: { href: string; rotulo: string; caminho: string; dica?: string }[] = [];
  for (const s of NAVEGACAO) {
    for (const a of s.abas) {
      if (a.href) lista.push({ href: a.href, rotulo: a.rotulo, caminho: s.titulo ?? "Início" });
      for (const f of a.filhos ?? []) lista.push({ ...f, caminho: [s.titulo, a.rotulo].filter(Boolean).join(" / ") });
    }
  }
  return lista;
}

/** A aba e a sub-aba que correspondem ao endereço atual. */
export function localizar(caminho: string, busca: string) {
  let melhor: { secao?: string; aba: Aba; folha?: Folha; nota: number } | null = null;
  for (const s of NAVEGACAO) {
    for (const a of s.abas) {
      const candidatos: (Folha | undefined)[] = a.filhos ?? [undefined];
      for (const f of candidatos) {
        const href = f?.href ?? a.href!;
        const base = semBusca(href);
        const query = href.includes("?") ? href.split("?")[1] : "";
        const bate = base === "/" ? caminho === "/" : caminho === base || caminho.startsWith(`${base}/`);
        if (!bate) continue;
        const parametros = new URLSearchParams(query);
        const atual = new URLSearchParams(busca);
        let queryBate = true;
        for (const [k, v] of parametros) if (atual.get(k) !== v) queryBate = false;
        if (!queryBate) continue;
        const nota = base.length * 10 + [...parametros].length;
        if (!melhor || nota > melhor.nota) melhor = { secao: s.titulo, aba: a, folha: f, nota };
      }
    }
  }
  return melhor;
}

export function hrefsDaAba(a: Aba) {
  return (a.filhos ?? []).map((f) => semBusca(f.href)).concat(a.href ? [semBusca(a.href)] : []);
}
