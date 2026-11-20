import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { brl, data, hojeISO } from "@/lib/format";
import { COR_COMPRA, STATUS_COMPRA, totalDaCompra, type StatusCompra } from "@/lib/estoque";
import { criarCompra } from "../actions";

type Compra = {
  id: string; numero: number; status: StatusCompra; emitido_em: string; previsao_entrega: string | null; frete: number; desconto: number;
  fornecedor: { nome: string } | null; pedido: { id: string; numero: number } | null;
  itens: { quantidade: number; recebido: number; preco_unitario: number }[];
};

/** Pedidos de compra: o que foi pedido a cada fornecedor, quanto custa e quando chega. */
export default async function PedidosCompraPage({ searchParams }: PageProps<"/compras/pedidos">) {
  const sp = await searchParams;
  const ver = typeof sp.ver === "string" && sp.ver in STATUS_COMPRA ? (sp.ver as StatusCompra) : sp.ver === "todos" ? "todos" : "andamento";
  const supabase = await createClient();
  let consulta = supabase
    .from("compras")
    .select("id, numero, status, emitido_em, previsao_entrega, frete, desconto, fornecedor:fornecedor_id(nome), pedido:pedido_id(id, numero), itens:compra_itens(quantidade, recebido, preco_unitario)")
    .order("numero", { ascending: false })
    .limit(300);
  if (ver === "andamento") consulta = consulta.in("status", ["rascunho", "enviado", "parcial"]);
  else if (ver !== "todos") consulta = consulta.eq("status", ver);
  const [{ data: compras }, { data: fornecedores }, { data: pedidos }, { data: todas }] = await Promise.all([
    consulta,
    supabase.from("fornecedores").select("id, nome").order("nome"),
    supabase.from("pedidos").select("id, numero, cliente:cliente_id(nome)").in("status", ["aberto", "em_producao", "pronto"]).order("numero", { ascending: false }).limit(300),
    supabase.from("compras").select("status, previsao_entrega, emitido_em, frete, desconto, itens:compra_itens(quantidade, recebido, preco_unitario)").in("status", ["enviado", "parcial", "recebido"]),
  ]);
  const lista = (compras ?? []) as unknown as Compra[];
  const hoje = hojeISO();
  const abertas = ((todas ?? []) as unknown as Compra[]).filter((c) => c.status !== "recebido");
  const atrasadas = abertas.filter((c) => c.previsao_entrega && c.previsao_entrega < hoje).length;
  const aReceber = abertas.reduce((s, c) => s + c.itens.reduce((t, i) => t + Math.max(0, Number(i.quantidade) - Number(i.recebido)) * Number(i.preco_unitario), 0), 0);
  const mes = hoje.slice(0, 7);
  const doMes = ((todas ?? []) as unknown as Compra[]).filter((c) => c.emitido_em?.startsWith(mes)).reduce((s, c) => s + totalDaCompra(c), 0);

  const novo = (
    <JanelaBotao rotulo="Novo pedido de compra" titulo="Novo pedido de compra" descricao="Depois você inclui os itens." abrirAoCarregar={sp.novo === "1"} aviso={null}>
      <form action={criarCompra} className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Fornecedor *" className="md:col-span-2">
          <select name="fornecedor_id" required className={inputCls}>
            <option value="">Escolha</option>
            {fornecedores?.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Previsão de entrega"><input type="date" name="previsao_entrega" className={inputCls} /></Campo>
        <Campo rotulo="Condição de pagamento"><input name="condicao_pagamento" placeholder="28 dias, à vista, 30/60..." className={inputCls} /></Campo>
        <Campo rotulo="Para o pedido (opcional)" className="md:col-span-2">
          <select name="pedido_id" className={inputCls}>
            <option value="">— Estoque geral —</option>
            {(pedidos as unknown as { id: string; numero: number; cliente: { nome: string } | null }[] | null)?.map((p) => <option key={p.id} value={p.id}>#{p.numero} · {p.cliente?.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observações" className="md:col-span-2"><textarea name="observacoes" rows={2} className={inputCls} /></Campo>
        <div className="md:col-span-2"><Botao type="submit">Criar pedido de compra</Botao></div>
      </form>
    </JanelaBotao>
  );

  const filtros: [string, string][] = [["andamento", "Em andamento"], ["rascunho", "Rascunho"], ["enviado", "Enviados"], ["parcial", "Recebidos em parte"], ["recebido", "Recebidos"], ["cancelado", "Cancelados"], ["todos", "Todos"]];

  return (
    <>
      <Titulo sub="Cada compra feita com um fornecedor: itens, valores, previsão de entrega e o que já chegou." acao={novo}>
        Pedidos de compra
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Em andamento" valor={abertas.length} sub="Enviados e ainda não recebidos" />
        <Indicador rotulo="Atrasados" valor={atrasadas} cor={atrasadas ? "vermelho" : undefined} sub="Passou da previsão de entrega" />
        <Indicador rotulo="Material a caminho" valor={brl(aReceber)} sub="Falta chegar" />
        <Indicador rotulo="Comprado no mês" valor={brl(doMes)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        {filtros.map(([k, r]) => (
          <Link key={k} href={k === "andamento" ? "/compras/pedidos" : `/compras/pedidos?ver=${k}`} className={ver === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
        ))}
      </div>
      <Tabela cabecalho={["Nº", "Fornecedor", "Emitido", "Previsão", "Para", "Recebido", "Total", "Situação"]} vazio={!lista.length}>
        {lista.map((c) => {
          const pedido = c.itens.reduce((s, i) => s + Number(i.quantidade), 0);
          const recebido = c.itens.reduce((s, i) => s + Math.min(Number(i.recebido), Number(i.quantidade)), 0);
          const atrasado = ["enviado", "parcial"].includes(c.status) && c.previsao_entrega && c.previsao_entrega < hoje;
          return (
            <tr key={c.id}>
              <td className="px-4 py-3"><Link href={`/compras/pedidos/${c.id}`} className="font-medium text-madeira-800 hover:underline">#{c.numero}</Link></td>
              <td className="px-4 py-3 font-medium">{c.fornecedor?.nome ?? "—"}</td>
              <td className="px-4 py-3">{data(c.emitido_em)}</td>
              <td className="px-4 py-3">{data(c.previsao_entrega)} {atrasado && <Selo cor="red">atrasado</Selo>}</td>
              <td className="px-4 py-3">{c.pedido ? <Link href={`/pedidos/${c.pedido.id}`} className="text-madeira-800 hover:underline">Pedido #{c.pedido.numero}</Link> : "Estoque"}</td>
              <td className="px-4 py-3">{pedido ? `${Math.round((recebido / pedido) * 100)}%` : "—"}</td>
              <td className="px-4 py-3">{brl(totalDaCompra(c))}</td>
              <td className="px-4 py-3"><Selo cor={COR_COMPRA[c.status]}>{STATUS_COMPRA[c.status]}</Selo></td>
            </tr>
          );
        })}
      </Tabela>
    </>
  );
}
