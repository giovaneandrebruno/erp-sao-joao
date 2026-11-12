/**
 * Menu do sistema: seções, abas e sub-abas.
 * Uma aba com "filhos" abre e fecha no menu lateral; sem filhos, é um link direto.
 * Também alimenta o caminho no topo da tela e a busca rápida (Ctrl+K).
 */
export type Icone =
  | "painel" | "vendas" | "clientes" | "pedidos" | "producao" | "estoque"
  | "financeiro" | "analises" | "equipe" | "configuracoes" | "campo" | "importar";

export type Folha = { href: string; rotulo: string; dica?: string };
export type Aba = { rotulo: string; icone: Icone; href?: string; filhos?: Folha[] };
export type Secao = { titulo?: string; abas: Aba[] };

export const NAVEGACAO: Secao[] = [
  { abas: [{ rotulo: "Painel", icone: "painel", href: "/" }] },
  {
    titulo: "Vendas",
    abas: [
      {
        rotulo: "Comercial",
        icone: "vendas",
        filhos: [
          { href: "/crm", rotulo: "Funil de vendas", dica: "Negociações por etapa" },
          { href: "/orcamentos", rotulo: "Orçamentos", dica: "Propostas e aprovações" },
          { href: "/comissoes", rotulo: "Comissões", dica: "Vendedores e arquitetos" },
        ],
      },
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
          { href: "/agenda", rotulo: "Agenda", dica: "Medições, entregas e montagens" },
        ],
      },
      {
        rotulo: "Produção",
        icone: "producao",
        filhos: [
          { href: "/producao", rotulo: "Ordens de produção" },
          { href: "/assistencia", rotulo: "Assistência técnica" },
          { href: "/campo", rotulo: "App do montador" },
        ],
      },
      {
        rotulo: "Estoque e compras",
        icone: "estoque",
        filhos: [
          { href: "/estoque", rotulo: "Produtos e saldo" },
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
          { href: "/financeiro?tipo=receber", rotulo: "A receber" },
          { href: "/financeiro?tipo=pagar", rotulo: "A pagar" },
          { href: "/financeiro?situacao=vencidos", rotulo: "Vencidos" },
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
  { href: "/estoque/novo", rotulo: "Cadastrar produto" },
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
