import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brl, data } from "@/lib/format";
import { BotaoImprimir } from "./botao";

export default async function ImprimirOrcamento({ params }: PageProps<"/orcamentos/[id]/imprimir">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: o }, { data: itens }] = await Promise.all([
    supabase.from("orcamentos_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem").order("criado_em"),
  ]);
  if (!o) notFound();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", o.cliente_id).single();
  const empresa = o.unidade === "loja" ? "São João Móveis" : "Marcenaria São João";

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-sm print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><BotaoImprimir /></div>
      <div className="mb-8 flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">{empresa}</h1>
          <p className="text-stone-500">Orçamento nº {o.numero}</p>
        </div>
        <div className="text-right text-stone-600">
          <div>Emitido em {data(o.criado_em)}</div>
          {o.validade && <div>Válido até {data(o.validade)}</div>}
        </div>
      </div>
      <div className="mb-6">
        <div className="font-semibold">{cliente?.nome}</div>
        {cliente?.telefone && <div>{cliente.telefone}</div>}
        {cliente?.endereco && <div>{cliente.endereco}{cliente.cidade ? ` — ${cliente.cidade}/${cliente.uf ?? ""}` : ""}</div>}
      </div>
      <table className="mb-4 w-full">
        <thead className="border-b text-left text-stone-500">
          <tr><th className="py-2">Ambiente</th><th>Descrição</th><th className="text-right">Qtd</th><th className="text-right">Unit.</th><th className="text-right">Total</th></tr>
        </thead>
        <tbody>
          {itens?.map((i) => (
            <tr key={i.id} className="border-b border-stone-100">
              <td className="py-2">{i.ambiente ?? ""}</td>
              <td>{i.descricao}</td>
              <td className="text-right">{Number(i.quantidade)}</td>
              <td className="text-right">{brl(i.preco_unitario)}</td>
              <td className="text-right">{brl(Number(i.quantidade) * Number(i.preco_unitario))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mb-8 text-right">
        {Number(o.desconto) > 0 && <div>Subtotal {brl(o.subtotal)} · Desconto −{brl(o.desconto)}</div>}
        <div className="text-lg font-semibold">Total {brl(o.total)}</div>
      </div>
      {o.prazo_entrega_dias && <p>Prazo de entrega: {o.prazo_entrega_dias} dias após a aprovação.</p>}
      {o.condicoes_pagamento && <p>Pagamento: {o.condicoes_pagamento}</p>}
      {o.observacoes && <p className="mt-4 whitespace-pre-line">{o.observacoes}</p>}
    </div>
  );
}
