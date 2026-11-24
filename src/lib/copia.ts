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
  pedido_materiais: "Estoque - reservas por pedido",
  retalhos: "Estoque - sobras de chapa",
  inventarios: "Estoque - inventários",
  inventario_itens: "Estoque - contagens",
  requisicoes_compra: "Compras - requisições",
  cotacoes: "Compras - cotações",
  cotacao_itens: "Compras - itens da cotação",
  cotacao_fornecedores: "Compras - fornecedores da cotação",
  cotacao_precos: "Compras - preços da cotação",
  compras: "Compras - pedidos de compra",
  compra_itens: "Compras - itens do pedido",
  recebimentos: "Compras - recebimentos",
  lancamentos: "Financeiro",
  chamados: "Assistência técnica",
  curriculos: "Currículos",
  curriculo_anotacoes: "Currículos - anotações",
  funcionarios: "Funcionários",
  funcionario_documentos: "Funcionários - arquivos",
  funcionario_anotacoes: "Funcionários - anotações",
  funcionario_atestados: "Funcionários - atestados",
  funcionario_ponto: "Funcionários - relógio ponto",
  organograma_pessoas: "Organograma - pessoas e cargos",
  organograma_funcoes: "Organograma - funções",
  organograma_atribuicoes: "Organograma - quem faz cada função",
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
