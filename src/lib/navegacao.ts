/**
 * Menu do sistema: seções, abas e sub-abas.
 * No menu lateral cada aba é uma linha só (sem abrir e fechar). Quando a aba tem "filhos",
 * o menu leva para a primeira sub-aba e as sub-abas aparecem como abas no topo da tela.
 * Também alimenta o caminho no topo da tela e a busca rápida (Ctrl+K).
 */
export type Icone =
  | "painel" | "vendas" | "clientes" | "pedidos" | "producao" | "estoque" | "compras"
  | "financeiro" | "analises" | "equipe" | "configuracoes" | "importar" | "agenda" | "curriculos" | "organograma" | "melhorias" | "historico" | "redes" | "funcionarios" | "reunioes" | "comissoes";

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
      {
        rotulo: "Redes sociais",
        icone: "redes",
        filhos: [
          { href: "/redes", rotulo: "Visão geral", dica: "Instagram, Facebook e site num lugar só" },
          { href: "/redes/mensagens", rotulo: "Mensagens", dica: "Directs do Instagram e mensagens da página" },
          { href: "/redes/instagram", rotulo: "Instagram", dica: "Seguidores, alcance e melhores posts" },
          { href: "/redes/facebook", rotulo: "Facebook", dica: "Seguidores, alcance e posts da página" },
          { href: "/redes/site", rotulo: "Uso do site", dica: "Quem usa o sistema e propostas abertas" },
        ],
      },
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
        rotulo: "Comissões",
        icone: "comissoes",
        filhos: [
          { href: "/comissoes", rotulo: "Comissões do mês", dica: "Quanto cada pessoa recebe pelas vendas do mês" },
          { href: "/comissoes/regras", rotulo: "Regras", dica: "Porcentagens e faixas de cada comissão" },
        ],
      },
      { rotulo: "Currículos", icone: "curriculos", href: "/curriculos" },
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
        rotulo: "Funcionários",
        icone: "funcionarios",
        filhos: [
          { href: "/funcionarios", rotulo: "Cadastro", dica: "Dados pessoais, arquivos e anotações de cada pessoa" },
          { href: "/funcionarios/atestados", rotulo: "Atestados", dica: "Atestados e afastamentos do mês" },
          { href: "/funcionarios/ponto", rotulo: "Relógio ponto", dica: "Horas batidas no mês e importação da planilha" },
          { href: "/funcionarios/banco-horas", rotulo: "Banco de horas", dica: "Saldo de horas a mais ou a menos de cada pessoa" },
          { href: "/funcionarios/politicas", rotulo: "Políticas da empresa", dica: "Horários, intervalos, celular e outras regras" },
        ],
      },
      {
        rotulo: "Organograma",
        icone: "organograma",
        filhos: [
          { href: "/organograma", rotulo: "Organograma", dica: "Quem responde a quem" },
          { href: "/organograma/carga", rotulo: "Pessoas e carga", dica: "Quem está sobrecarregado e quem tem folga" },
          { href: "/organograma/funcoes", rotulo: "Funções", dica: "O que precisa ser feito e quem faz" },
        ],
      },
      {
        rotulo: "Reuniões",
        icone: "reunioes",
        filhos: [
          { href: "/reunioes", rotulo: "Atas", dica: "Reuniões da diretoria e o que foi combinado" },
          { href: "/reunioes/acoes", rotulo: "Ações em aberto", dica: "Tudo que está pendente, de todas as reuniões" },
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
      { rotulo: "Melhorias", icone: "melhorias", href: "/melhorias" },
      { rotulo: "Histórico de alterações", icone: "historico", href: "/historico" },
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
  { href: "/funcionarios?novo=1", rotulo: "Cadastrar funcionário" },
  { href: "/reunioes?novo=1", rotulo: "Nova reunião (ata)" },
  { href: "/funcionarios/ponto?importar=1", rotulo: "Importar planilha do relógio ponto" },
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
