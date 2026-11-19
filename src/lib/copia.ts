import type { AbaGravar } from "@/lib/planilha-gravar";

/** Nome de cada assunto do sistema (tabela do banco → aba da planilha). */
export const ASSUNTOS: Record<string, string> = {
  clientes: "Clientes",
  fornecedores: "Fornecedores",
  parceiros: "Equipe e parceiros",
  negociacoes: "Funil de vendas",
  negociacao_notas: "Funil - anotações",
  orcamentos: "Orçamentos",
  orcamento_itens: "Orçamentos - itens",
  pedidos: "Pedidos",
  pedido_itens: "Pedidos - itens",
  pedido_marcos: "Pedidos - prazos",
  ordens_producao: "Produção",
  producao_historico: "Produção - histórico",
  produtos: "Estoque - produtos",
  movimentos_estoque: "Estoque - movimentos",
  lancamentos: "Financeiro",
  chamados: "Assistência técnica",
  configuracoes: "Configurações",
  perfis: "Usuários",
  agendas_google: "Agendas Google",
  visitas: "Visitas",
  importacoes: "Importações",
  melhorias: "Melhorias do sistema",
  auditoria: "Histórico de alterações",
};

export const nomeDoAssunto = (tabela: string) => ASSUNTOS[tabela] ?? tabela;

/** Transforma as linhas de uma tabela numa aba (a primeira linha traz o nome das colunas). */
export function abaDe(nome: string, linhas: Record<string, unknown>[]): AbaGravar {
  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  if (!colunas.length) return { nome, linhas: [["(sem registros)"]] };
  return { nome, linhas: [colunas, ...linhas.map((l) => colunas.map((c) => l[c]))] };
}
