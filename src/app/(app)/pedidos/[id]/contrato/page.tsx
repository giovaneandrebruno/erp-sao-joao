import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROTULOS2, brl, data } from "@/lib/format";
import { BotaoImprimir } from "./botao";

export default async function ContratoPage({ params }: PageProps<"/pedidos/[id]/contrato">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: itens }, { data: parcelas }, { data: cfg }, { data: marcos }] = await Promise.all([
    supabase.from("pedidos_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("ordem"),
    supabase.from("lancamentos").select("descricao, valor, vencimento").eq("pedido_id", id).eq("tipo", "receber").order("vencimento"),
    supabase.from("configuracoes").select("*").single(),
    supabase.from("pedido_marcos").select("tipo, previsto").eq("pedido_id", id).in("tipo", ["entrega", "montagem"]),
  ]);
  if (!p) notFound();
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", p.cliente_id).single();
  const numero = `${p.numero}/${p.criado_em.slice(0, 4)}`;
  const entrega = marcos?.find((m) => m.tipo === "entrega")?.previsto ?? p.data_entrega_prevista;
  const montagem = marcos?.find((m) => m.tipo === "montagem")?.previsto;
  const ambientes = Array.from(new Set((itens ?? []).map((i) => i.ambiente ?? "Geral")));

  return (
    <div className="papel mx-auto max-w-3xl rounded-2xl bg-superficie p-10 text-sm leading-relaxed print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><BotaoImprimir /></div>
      <div className="mb-6 border-b pb-4 text-center">
        <h1 className="text-xl font-semibold">Contrato de compra e venda de móveis planejados nº {numero}</h1>
      </div>

      <p className="mb-3"><strong>CONTRATADA:</strong> {cfg?.razao_social || cfg?.nome_fantasia}{cfg?.cnpj ? `, CNPJ ${cfg.cnpj}` : ""}{cfg?.endereco ? `, ${cfg.endereco}` : ""}{cfg?.cidade ? `, ${cfg.cidade}/${cfg.uf ?? ""}` : ""}.</p>
      <p className="mb-6"><strong>CONTRATANTE:</strong> {cliente?.nome}{cliente?.cpf_cnpj ? `, CPF/CNPJ ${cliente.cpf_cnpj}` : ""}{cliente?.endereco ? `, ${cliente.endereco}` : ""}{cliente?.cidade ? `, ${cliente.cidade}/${cliente.uf ?? ""}` : ""}{cliente?.telefone ? `, telefone ${cliente.telefone}` : ""}.</p>

      <h2 className="mb-2 font-semibold">Objeto</h2>
      <p className="mb-2">Fabricação, entrega e montagem dos móveis planejados abaixo, conforme projeto aprovado pelo CONTRATANTE.</p>
      <table className="mb-6 w-full">
        <thead className="border-b text-left text-stone-500">
          <tr><th className="py-2">Ambiente</th><th>Descrição</th><th className="text-right">Qtd</th><th className="text-right">Valor</th></tr>
        </thead>
        <tbody>
          {ambientes.flatMap((amb) =>
            (itens ?? []).filter((i) => (i.ambiente ?? "Geral") === amb).map((i) => (
              <tr key={i.id} className="border-b border-stone-100">
                <td className="py-1.5">{amb}</td>
                <td>{i.descricao}</td>
                <td className="text-right">{Number(i.quantidade)}</td>
                <td className="text-right">{brl(Number(i.quantidade) * Number(i.preco_unitario))}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>

      <h2 className="mb-2 font-semibold">Preço e pagamento</h2>
      <p className="mb-2">
        Valor total de <strong>{brl(p.total)}</strong>{Number(p.desconto) > 0 ? ` (já com desconto de ${brl(p.desconto)})` : ""}, pago por{" "}
        {ROTULOS2.formaPagamento[p.forma_pagamento as keyof typeof ROTULOS2.formaPagamento]?.toLowerCase()}
        {p.parcelas > 1 ? ` em ${p.parcelas} parcelas` : ""}.
      </p>
      {parcelas?.length ? (
        <ul className="mb-6 list-inside list-disc">
          {parcelas.map((l, i) => <li key={i}>{data(l.vencimento)}: {brl(l.valor)}</li>)}
        </ul>
      ) : <div className="mb-6" />}

      <h2 className="mb-2 font-semibold">Prazos</h2>
      <p className="mb-6">
        Entrega prevista para {data(entrega)}{montagem ? ` e montagem prevista para ${data(montagem)}` : ""}.
      </p>

      <h2 className="mb-2 font-semibold">Condições gerais</h2>
      <div className="mb-10 whitespace-pre-line">{cfg?.clausulas_contrato}</div>

      <p className="mb-16">{cfg?.cidade ?? ""}, {data(new Date().toISOString())}.</p>
      <div className="grid grid-cols-2 gap-12 text-center">
        <div className="border-t pt-2">{cfg?.nome_fantasia}<br /><span className="text-stone-500">CONTRATADA</span></div>
        <div className="border-t pt-2">{cliente?.nome}<br /><span className="text-stone-500">CONTRATANTE</span></div>
      </div>
    </div>
  );
}
