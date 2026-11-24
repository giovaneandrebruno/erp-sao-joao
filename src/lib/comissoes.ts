/**
 * Regras de comissão (editáveis em Comissões / Regras):
 *  - rt: % sobre cada pedido com arquiteto ou indicador (se o pedido tiver uma % própria, vale a do pedido);
 *  - comercial: % sobre o total vendido pelo vendedor no mês, pela maior faixa atingida (abaixo da primeira, nada);
 *  - equipe: % sobre as vendas gerais do mês, para uma pessoa ou função, a partir de um mínimo vendido no mês.
 */
export type Regra = {
  id: string; tipo: "rt" | "comercial" | "equipe"; nome: string; percentual: number; minimo_mes: number;
  pessoa: string | null; observacao: string | null; ativo: boolean; ordem: number;
};
export type Faixa = { id: string; a_partir_de: number; percentual: number };

/** A % da maior faixa que o valor atingiu (0 se não chegou na primeira). */
export function faixaDoValor(valor: number, faixas: Faixa[]) {
  const ordenadas = [...faixas].sort((a, b) => Number(a.a_partir_de) - Number(b.a_partir_de));
  let atual: Faixa | null = null;
  for (const f of ordenadas) if (valor >= Number(f.a_partir_de)) atual = f;
  const proxima = ordenadas.find((f) => Number(f.a_partir_de) > valor) ?? null;
  return { faixa: atual, percentual: atual ? Number(atual.percentual) : 0, proxima };
}

export const centavos = (v: number) => Math.round(v * 100) / 100;
