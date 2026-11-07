import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { ROTULOS, brl, data } from "@/lib/format";
import { criarOrdem, gerarParcelas, mudarStatusPedido } from "../actions";

export default async function PedidoPage({ params }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: itens }, { data: ordens }, { data: parcelas }] = await Promise.all([
    supabase.from("pedidos_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("ordem"),
    supabase.from("ordens_producao").select("*").eq("pedido_id", id).order("numero"),
    supabase.from("lancamentos").select("*").eq("pedido_id", id).eq("tipo", "receber").order("vencimento"),
  ]);
  if (!p) notFound();
  const recebido = parcelas?.filter((l) => l.pago_em).reduce((s, l) => s + Number(l.valor), 0) ?? 0;
  const lancado = parcelas?.reduce((s, l) => s + Number(l.valor), 0) ?? 0;

  return (
    <>
      <Titulo>Pedido #{p.numero}</Titulo>
      <p className="mb-6 text-sm text-stone-600">
        Cliente: <Link href={`/clientes/${p.cliente_id}`} className="font-medium text-amber-800 hover:underline">{p.cliente_nome}</Link>
        {p.orcamento_id && <> · <Link href={`/orcamentos/${p.orcamento_id}`} className="text-amber-800 hover:underline">ver orçamento</Link></>}
        {" · "}{ROTULOS.unidade[p.unidade as keyof typeof ROTULOS.unidade]}
      </p>

      <Cartao className="mb-8">
        <form action={mudarStatusPedido.bind(null, id)} className="flex flex-wrap items-end gap-4">
          <Campo rotulo="Status">
            <select name="status" defaultValue={p.status} className={inputCls}>
              {Object.entries(ROTULOS.statusPedido).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Entrega prevista">
            <input type="date" name="data_entrega_prevista" defaultValue={p.data_entrega_prevista ?? ""} className={inputCls} />
          </Campo>
          <Botao type="submit">Salvar</Botao>
        </form>
      </Cartao>

      <h2 className="mb-3 text-lg font-semibold">Itens</h2>
      <Tabela cabecalho={["Ambiente", "Descrição", "Qtd", "Valor unit.", "Total"]} vazio={!itens?.length}>
        {itens?.map((i) => (
          <tr key={i.id}>
            <td className="px-4 py-3">{i.ambiente ?? "—"}</td>
            <td className="px-4 py-3">{i.descricao}</td>
            <td className="px-4 py-3">{Number(i.quantidade)}</td>
            <td className="px-4 py-3">{brl(i.preco_unitario)}</td>
            <td className="px-4 py-3">{brl(Number(i.quantidade) * Number(i.preco_unitario))}</td>
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 mb-8 text-right text-lg font-semibold">Total: {brl(p.total)}</p>

      <h2 className="mb-3 text-lg font-semibold">Produção</h2>
      <div className="mb-4">
        <Tabela cabecalho={["OP", "Descrição", "Etapa", "Responsável", "Prazo"]} vazio={!ordens?.length}>
          {ordens?.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3">#{o.numero}</td>
              <td className="px-4 py-3">{o.descricao}</td>
              <td className="px-4 py-3"><Selo cor="amber">{ROTULOS.etapa[o.etapa as keyof typeof ROTULOS.etapa]}</Selo></td>
              <td className="px-4 py-3">{o.responsavel ?? "—"}</td>
              <td className="px-4 py-3">{data(o.prazo)}</td>
            </tr>
          ))}
        </Tabela>
      </div>
      <Cartao className="mb-8">
        <h3 className="mb-3 font-semibold">Nova ordem de produção</h3>
        <form action={criarOrdem.bind(null, id)} className="grid gap-3 md:grid-cols-12">
          <Campo rotulo="Descrição" className="md:col-span-5">
            <input name="descricao" placeholder="Cozinha completa" className={inputCls} />
          </Campo>
          <Campo rotulo="Responsável" className="md:col-span-3">
            <input name="responsavel" className={inputCls} />
          </Campo>
          <Campo rotulo="Prazo" className="md:col-span-2">
            <input type="date" name="prazo" defaultValue={p.data_entrega_prevista ?? ""} className={inputCls} />
          </Campo>
          <div className="flex items-end md:col-span-2"><Botao type="submit">Criar OP</Botao></div>
        </form>
      </Cartao>

      <h2 className="mb-3 text-lg font-semibold">Recebimentos</h2>
      <div className="mb-4">
        <Tabela cabecalho={["Descrição", "Vencimento", "Valor", "Situação"]} vazio={!parcelas?.length}>
          {parcelas?.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-3">{l.descricao}</td>
              <td className="px-4 py-3">{data(l.vencimento)}</td>
              <td className="px-4 py-3">{brl(l.valor)}</td>
              <td className="px-4 py-3">{l.pago_em ? <Selo cor="green">Recebido {data(l.pago_em)}</Selo> : <Selo>Em aberto</Selo>}</td>
            </tr>
          ))}
        </Tabela>
        <p className="mt-2 text-right text-sm text-stone-600">Lançado {brl(lancado)} · Recebido {brl(recebido)} · Falta lançar {brl(Number(p.total) - lancado)}</p>
      </div>
      {Number(p.total) - lancado > 0.009 && (
        <Cartao>
          <h3 className="mb-3 font-semibold">Gerar parcelas a receber</h3>
          <form action={gerarParcelas.bind(null, id)} className="grid gap-3 md:grid-cols-12">
            <Campo rotulo="Entrada (R$)" className="md:col-span-2">
              <input name="entrada" inputMode="decimal" className={inputCls} />
            </Campo>
            <Campo rotulo="Nº de parcelas" className="md:col-span-2">
              <input name="parcelas" type="number" min={0} defaultValue={1} className={inputCls} />
            </Campo>
            <Campo rotulo="1º vencimento" className="md:col-span-3">
              <input name="primeiro_vencimento" type="date" className={inputCls} />
            </Campo>
            <Campo rotulo="Forma de pagamento" className="md:col-span-3">
              <input name="forma_pagamento" placeholder="Pix, boleto, cartão..." className={inputCls} />
            </Campo>
            <div className="flex items-end md:col-span-2"><Botao type="submit">Gerar</Botao></div>
          </form>
          <p className="mt-2 text-xs text-stone-500">Divide o que falta lançar ({brl(Number(p.total) - lancado)}) em entrada + parcelas mensais.</p>
        </Cartao>
      )}
    </>
  );
}
