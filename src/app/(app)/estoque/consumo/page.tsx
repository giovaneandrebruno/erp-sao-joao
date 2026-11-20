import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { COR_PEDIDO, ROTULOS, brl } from "@/lib/format";
import { qtd } from "@/lib/estoque";

type Ped = { id: string; numero: number; status: keyof typeof COR_PEDIDO; cliente: { nome: string } | null };
type Mov = { tipo: string; quantidade: number; custo_unitario: number | null; produto_id: string; pedido_id: string; produto: { nome: string; unidade_medida: string; custo: number } | null; pedido: Ped | null };
type ItemCompra = { quantidade: number; recebido: number; preco_unitario: number; unidade: string; descricao: string; produto_id: string | null; pedido_id: string; pedido: Ped | null; compra: { id: string; numero: number; status: string } | null };
type Linha = { chave: string; nome: string; un: string; produtoId: string | null; comprado: number; recebido: number; valorComprado: number; usado: number; valorUsado: number; compras: Map<string, number> };

/**
 * Consumo por cliente: o material que saiu do estoque para cada pedido (baixa da produção e materiais)
 * e o que foi comprado marcado para aquele cliente. A marcação da compra não trava o material.
 */
export default async function ConsumoPage({ searchParams }: PageProps<"/estoque/consumo">) {
  const sp = await searchParams;
  const filtroPedido = typeof sp.pedido === "string" ? sp.pedido : "";
  const ver = sp.ver === "andamento" ? "andamento" : sp.ver === "finalizados" ? "finalizados" : "todos";
  const supabase = await createClient();
  let movs = supabase
    .from("movimentos_estoque")
    .select("tipo, quantidade, custo_unitario, produto_id, pedido_id, produto:produto_id(nome, unidade_medida, custo), pedido:pedido_id(id, numero, status, cliente:cliente_id(nome))")
    .not("pedido_id", "is", null)
    .is("compra_id", null)
    .in("tipo", ["saida", "entrada"])
    .limit(5000);
  let itens = supabase
    .from("compra_itens")
    .select("quantidade, recebido, preco_unitario, unidade, descricao, produto_id, pedido_id, pedido:pedido_id(id, numero, status, cliente:cliente_id(nome)), compra:compra_id(id, numero, status)")
    .not("pedido_id", "is", null)
    .limit(5000);
  if (filtroPedido) { movs = movs.eq("pedido_id", filtroPedido); itens = itens.eq("pedido_id", filtroPedido); }
  const [{ data: m }, { data: c }, { data: pedidosLista }] = await Promise.all([
    movs,
    itens,
    supabase.from("pedidos").select("id, numero, cliente:cliente_id(nome)").order("numero", { ascending: false }).limit(500),
  ]);

  const porPedido = new Map<string, { pedido: Ped; linhas: Map<string, Linha> }>();
  const linhaDe = (p: Ped, chave: string, nome: string, un: string, produtoId: string | null) => {
    if (!porPedido.has(p.id)) porPedido.set(p.id, { pedido: p, linhas: new Map() });
    const g = porPedido.get(p.id)!;
    if (!g.linhas.has(chave)) g.linhas.set(chave, { chave, nome, un, produtoId, comprado: 0, recebido: 0, valorComprado: 0, usado: 0, valorUsado: 0, compras: new Map() });
    return g.linhas.get(chave)!;
  };
  for (const x of (m ?? []) as unknown as Mov[]) {
    if (!x.pedido || !x.produto) continue;
    const l = linhaDe(x.pedido, x.produto_id, x.produto.nome, x.produto.unidade_medida, x.produto_id);
    const sinal = x.tipo === "saida" ? 1 : -1; // entrada com pedido = devolução de pedido cancelado
    l.usado += sinal * Number(x.quantidade);
    l.valorUsado += sinal * Number(x.quantidade) * Number(x.custo_unitario ?? x.produto.custo ?? 0);
  }
  for (const x of (c ?? []) as unknown as ItemCompra[]) {
    if (!x.pedido || x.compra?.status === "cancelado") continue;
    const l = linhaDe(x.pedido, x.produto_id ?? `d:${x.descricao}`, x.descricao, x.unidade, x.produto_id);
    l.comprado += Number(x.quantidade);
    l.recebido += Number(x.recebido);
    l.valorComprado += Number(x.quantidade) * Number(x.preco_unitario);
    if (x.compra) l.compras.set(x.compra.id, x.compra.numero);
  }

  const finalizado = (s: string) => ["pronto", "entregue"].includes(s);
  const grupos = [...porPedido.values()]
    .filter((g) => (ver === "finalizados" ? finalizado(g.pedido.status) : ver === "andamento" ? !finalizado(g.pedido.status) && g.pedido.status !== "cancelado" : true))
    .sort((a, b) => b.pedido.numero - a.pedido.numero);
  const totalUsado = grupos.reduce((s, g) => s + [...g.linhas.values()].reduce((t, l) => t + l.valorUsado, 0), 0);
  const totalComprado = grupos.reduce((s, g) => s + [...g.linhas.values()].reduce((t, l) => t + l.valorComprado, 0), 0);

  const link = (v: string) => `/estoque/consumo?${new URLSearchParams({ ...(v !== "todos" ? { ver: v } : {}), ...(filtroPedido ? { pedido: filtroPedido } : {}) })}`;

  return (
    <>
      <Titulo sub="Quanto material cada cliente usou (o que saiu do estoque para o pedido) e o que foi comprado marcado para ele. A marcação na compra é só um registro: o material pode ser usado em outro pedido sem problema.">
        Consumo por cliente
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Indicador rotulo="Pedidos na lista" valor={grupos.length} />
        <Indicador rotulo="Material usado" valor={brl(totalUsado)} sub="Pelo custo de saída do estoque" />
        <Indicador rotulo="Comprado para clientes" valor={brl(totalComprado)} sub="Itens de compra marcados" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {([["todos", "Todos"], ["andamento", "Em andamento"], ["finalizados", "Finalizados (pronto ou entregue)"]] as const).map(([k, r]) => (
          <Link key={k} href={link(k)} className={ver === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
        ))}
        <form className="ml-auto flex gap-2">
          {ver !== "todos" && <input type="hidden" name="ver" value={ver} />}
          <select name="pedido" defaultValue={filtroPedido} className={inputCls}>
            <option value="">Todos os clientes</option>
            {(pedidosLista as unknown as { id: string; numero: number; cliente: { nome: string } | null }[] | null)?.map((p) => <option key={p.id} value={p.id}>{p.cliente?.nome} · pedido #{p.numero}</option>)}
          </select>
          <button className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Filtrar</button>
        </form>
      </div>

      {!grupos.length && <Tabela cabecalho={["Material", "Comprado para o cliente", "Usado no pedido", "Custo do usado"]} vazio>{null}</Tabela>}
      <div className="flex flex-col gap-8">
        {grupos.map(({ pedido: p, linhas }) => {
          const lista = [...linhas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          const custo = lista.reduce((s, l) => s + l.valorUsado, 0);
          return (
            <section key={p.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 text-lg font-semibold">
                  {p.cliente?.nome ?? "Cliente"}
                  <Link href={`/pedidos/${p.id}`} className="text-base font-normal text-madeira-800 hover:underline">Pedido #{p.numero}</Link>
                  <Selo cor={COR_PEDIDO[p.status]}>{ROTULOS.statusPedido[p.status]}</Selo>
                </h2>
                <span className="text-sm text-stone-600">Material usado: <b className="font-mono">{brl(custo)}</b></span>
              </div>
              <Tabela cabecalho={["Material", "Comprado para o cliente", "Chegou", "Usado no pedido", "Custo do usado", "Compras"]}>
                {lista.map((l) => (
                  <tr key={l.chave}>
                    <td className="px-4 py-3 font-medium">{l.produtoId ? <Link href={`/estoque/${l.produtoId}`} className="text-madeira-800 hover:underline">{l.nome}</Link> : l.nome}</td>
                    <td className="px-4 py-3">{l.comprado ? qtd(l.comprado, l.un) : "—"}</td>
                    <td className="px-4 py-3">{l.comprado ? qtd(l.recebido) : "—"}</td>
                    <td className="px-4 py-3 font-semibold">{l.usado ? qtd(l.usado, l.un) : "—"}</td>
                    <td className="px-4 py-3">{l.usado ? brl(l.valorUsado) : "—"}</td>
                    <td className="px-4 py-3">
                      {[...l.compras.entries()].map(([id, n]) => <Link key={id} href={`/compras/pedidos/${id}`} className="mr-2 text-madeira-800 hover:underline">#{n}</Link>)}
                      {!l.compras.size && "—"}
                    </td>
                  </tr>
                ))}
              </Tabela>
            </section>
          );
        })}
      </div>
    </>
  );
}
