import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Indicador, Tabela, Titulo, VerMais, inputCls, quantidadeDaLista } from "@/components/ui";
import { brl, dataHora, hojeISO } from "@/lib/format";
import { ORIGEM_MOVIMENTO, TIPO_MOVIMENTO, qtd, type Origem } from "@/lib/estoque";

type Mov = {
  id: string; criado_em: string; tipo: keyof typeof TIPO_MOVIMENTO; origem: Origem | null; quantidade: number; custo_unitario: number | null;
  referencia: string | null; pedido_id: string | null; compra_id: string | null;
  produto: { id: string; nome: string; unidade_medida: string; custo: number } | null;
  pedido: { numero: number } | null; compra: { numero: number } | null;
};

/** Todas as entradas, saídas e ajustes do estoque, com filtro por período, tipo e motivo. */
export default async function MovimentosPage({ searchParams }: PageProps<"/estoque/movimentos">) {
  const sp = await searchParams;
  const de = typeof sp.de === "string" && sp.de ? sp.de : hojeISO(-30);
  const ate = typeof sp.ate === "string" && sp.ate ? sp.ate : hojeISO();
  const tipo = typeof sp.tipo === "string" && sp.tipo in TIPO_MOVIMENTO ? sp.tipo : "";
  const origem = typeof sp.origem === "string" && sp.origem in ORIGEM_MOVIMENTO ? sp.origem : "";
  const limite = quantidadeDaLista(sp.qtd);
  const supabase = await createClient();

  let consulta = supabase
    .from("movimentos_estoque")
    .select("id, criado_em, tipo, origem, quantidade, custo_unitario, referencia, pedido_id, compra_id, produto:produto_id(id, nome, unidade_medida, custo), pedido:pedido_id(numero), compra:compra_id(numero)", { count: "exact" })
    .gte("criado_em", `${de}T00:00:00-03:00`)
    .lte("criado_em", `${ate}T23:59:59-03:00`)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (tipo) consulta = consulta.eq("tipo", tipo as keyof typeof TIPO_MOVIMENTO);
  if (origem) consulta = consulta.eq("origem", origem);
  const { data, count } = await consulta;
  const lista = (data ?? []) as unknown as Mov[];

  const valor = (m: Mov) => Number(m.quantidade) * Number(m.custo_unitario ?? m.produto?.custo ?? 0);
  const entradas = lista.filter((m) => m.tipo === "entrada").reduce((s, m) => s + valor(m), 0);
  const saidas = lista.filter((m) => m.tipo === "saida").reduce((s, m) => s + valor(m), 0);
  const perdas = lista.filter((m) => m.origem === "perda").reduce((s, m) => s + valor(m), 0);

  return (
    <>
      <Titulo sub="Tudo o que entrou, saiu ou foi ajustado no estoque. Compras entram pelo Recebimento; pedidos tiram material sozinhos quando entram em produção.">
        Movimentações do estoque
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Movimentações" valor={count ?? lista.length} sub="No período" />
        <Indicador rotulo="Entradas" valor={brl(entradas)} cor="verde" sub="Valor pelo custo" />
        <Indicador rotulo="Saídas" valor={brl(saidas)} sub="Material usado" />
        <Indicador rotulo="Perdas e avarias" valor={brl(perdas)} cor={perdas ? "vermelho" : undefined} sub="Chapa quebrada, peça errada..." />
      </div>
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col gap-1 text-xs text-stone-500">De<input type="date" name="de" defaultValue={de} className={inputCls} /></label>
        <label className="flex flex-col gap-1 text-xs text-stone-500">Até<input type="date" name="ate" defaultValue={ate} className={inputCls} /></label>
        <select name="tipo" defaultValue={tipo} className={inputCls}>
          <option value="">Entradas, saídas e ajustes</option>
          {Object.entries(TIPO_MOVIMENTO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
        <select name="origem" defaultValue={origem} className={inputCls}>
          <option value="">Todos os motivos</option>
          {Object.entries(ORIGEM_MOVIMENTO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
        <button className="rounded-lg border border-stone-200 bg-white px-3 py-2 font-medium text-stone-700 hover:bg-stone-50">Filtrar</button>
      </form>
      <Tabela cabecalho={["Data", "Material", "Tipo", "Motivo", "Quantidade", "Custo unit.", "Valor", "Referência"]} vazio={!lista.length}>
        {lista.map((m) => (
          <tr key={m.id}>
            <td className="whitespace-nowrap px-4 py-3">{dataHora(m.criado_em)}</td>
            <td className="px-4 py-3">{m.produto ? <Link href={`/estoque/${m.produto.id}`} className="font-medium text-madeira-800 hover:underline">{m.produto.nome}</Link> : "—"}</td>
            <td className="px-4 py-3">{TIPO_MOVIMENTO[m.tipo]}</td>
            <td className="px-4 py-3">{ORIGEM_MOVIMENTO[m.origem === "manual" && m.pedido_id ? "pedido" : m.origem ?? "manual"]}</td>
            <td className={`px-4 py-3 font-medium ${m.tipo === "entrada" ? "text-neon" : m.tipo === "saida" ? "text-rosa" : ""}`}>
              {m.tipo === "entrada" ? "+" : m.tipo === "saida" ? "−" : "="}{qtd(m.quantidade, m.produto?.unidade_medida)}
            </td>
            <td className="px-4 py-3">{m.custo_unitario ? brl(m.custo_unitario) : "—"}</td>
            <td className="px-4 py-3">{m.tipo === "ajuste" ? "—" : brl(valor(m))}</td>
            <td className="px-4 py-3">
              {m.compra_id && m.compra ? <Link href={`/compras/pedidos/${m.compra_id}`} className="text-madeira-800 hover:underline">Compra #{m.compra.numero}</Link>
                : m.pedido_id && m.pedido ? <Link href={`/pedidos/${m.pedido_id}`} className="text-madeira-800 hover:underline">Pedido #{m.pedido.numero}</Link>
                : m.referencia ?? "—"}
            </td>
          </tr>
        ))}
      </Tabela>
      <VerMais mostrando={lista.length} total={count} rotulo="movimentações" parametros={sp} />
    </>
  );
}
