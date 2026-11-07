import { Cartao, LinhaValor } from "@/components/ui";
import { brl, pct } from "@/lib/format";

type R = {
  total: number;
  custo_total: number;
  valor_comissao_vendedor: number;
  valor_comissao_arquiteto: number;
  valor_taxa_pagamento: number;
  valor_imposto: number;
  lucro: number;
  custos_extras?: number;
};

/** Quadro de resultado: quanto sobra de cada venda depois de custos, comissões, taxas e impostos. */
export function Previsao({ r, margemMinima, titulo = "Previsão de lucro" }: { r: R; margemMinima: number; titulo?: string }) {
  const total = Number(r.total);
  const lucro = Number(r.lucro);
  const margem = total > 0 ? (lucro / total) * 100 : 0;
  const ok = margem >= margemMinima;
  return (
    <Cartao>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-semibold">{titulo}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
          margem {pct(margem)}
        </span>
      </div>
      <LinhaValor rotulo="Venda" valor={brl(total)} />
      <LinhaValor rotulo="Custo dos itens" valor={brl(r.custo_total)} negativo />
      {r.custos_extras !== undefined && Number(r.custos_extras) > 0 && <LinhaValor rotulo="Outros custos lançados" valor={brl(r.custos_extras)} negativo />}
      <LinhaValor rotulo="Comissão do vendedor" valor={brl(r.valor_comissao_vendedor)} negativo />
      <LinhaValor rotulo="RT do arquiteto" valor={brl(r.valor_comissao_arquiteto)} negativo />
      <LinhaValor rotulo="Taxa de pagamento" valor={brl(r.valor_taxa_pagamento)} negativo />
      <LinhaValor rotulo="Impostos" valor={brl(r.valor_imposto)} negativo />
      <LinhaValor rotulo="Lucro" valor={brl(lucro)} forte />
      {!ok && total > 0 && (
        <p className="mt-2 text-xs text-red-700">Abaixo da margem mínima de {pct(margemMinima)}. Reveja o preço, o desconto ou as comissões.</p>
      )}
      {Number(r.custo_total) === 0 && total > 0 && (
        <p className="mt-2 text-xs text-stone-500">Informe o custo dos itens para a previsão ficar correta.</p>
      )}
    </Cartao>
  );
}
