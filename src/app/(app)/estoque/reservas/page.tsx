import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Indicador, Selo, Tabela, Titulo } from "@/components/ui";
import { COR_PEDIDO, ROTULOS, brl, data } from "@/lib/format";
import { qtd } from "@/lib/estoque";

type Reserva = {
  id: string; quantidade: number; observacoes: string | null; produto_id: string;
  pedido: { id: string; numero: number; status: keyof typeof COR_PEDIDO; data_entrega_prevista: string | null; cliente: { nome: string } | null } | null;
  produto: { nome: string; unidade_medida: string; custo: number } | null;
};

/** Material separado para cada pedido em aberto (ainda não saiu do estoque). */
export default async function ReservasPage() {
  const supabase = await createClient();
  const [{ data: linhas }, { data: saldos }] = await Promise.all([
    supabase
      .from("pedido_materiais")
      .select("id, quantidade, observacoes, produto_id, pedido:pedido_id(id, numero, status, data_entrega_prevista, cliente:cliente_id(nome)), produto:produto_id(nome, unidade_medida, custo)")
      .eq("baixado", false)
      .order("criado_em"),
    supabase.from("produtos_saldo").select("id, estoque_atual, livre, a_caminho"),
  ]);
  const saldo = new Map((saldos ?? []).map((s) => [s.id, s]));
  const reservas = ((linhas ?? []) as unknown as Reserva[]).filter((r) => r.pedido && !["cancelado", "entregue"].includes(r.pedido.status));

  const pedidos = new Map<string, Reserva[]>();
  for (const r of reservas) pedidos.set(r.pedido!.id, [...(pedidos.get(r.pedido!.id) ?? []), r]);
  const grupos = [...pedidos.values()].sort((a, b) => (a[0].pedido!.data_entrega_prevista ?? "9999").localeCompare(b[0].pedido!.data_entrega_prevista ?? "9999"));

  const falta = (r: Reserva) => Number(saldo.get(r.produto_id)?.livre ?? 0) < 0;
  const valor = reservas.reduce((s, r) => s + Number(r.quantidade) * Number(r.produto?.custo ?? 0), 0);
  const comFalta = grupos.filter((g) => g.some(falta)).length;

  return (
    <>
      <Titulo
        sub="Chapas, fitas e ferragens já separadas para cada pedido. O material sai do estoque sozinho quando o pedido entra em produção."
        acao={<BotaoLink href="/estoque/calcular">Calcular material de um pedido</BotaoLink>}
      >
        Reservas por pedido
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Indicador rotulo="Pedidos com reserva" valor={grupos.length} />
        <Indicador rotulo="Valor reservado" valor={brl(valor)} sub="Pelo custo médio" />
        <Indicador rotulo="Pedidos com falta" valor={comFalta} cor={comFalta ? "vermelho" : undefined} sub={comFalta ? <Link href="/compras" className="underline">Ver o que comprar</Link> : "Estoque cobre tudo"} />
      </div>
      {!grupos.length && (
        <Tabela cabecalho={["Material", "Reservado", "Situação"]} vazio>{null}</Tabela>
      )}
      <div className="flex flex-col gap-8">
        {grupos.map((itens) => {
          const p = itens[0].pedido!;
          return (
            <section key={p.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-3 text-lg font-semibold">
                  <Link href={`/pedidos/${p.id}`} className="hover:underline">Pedido #{p.numero}</Link>
                  <span className="font-normal text-stone-500">{p.cliente?.nome}</span>
                  <Selo cor={COR_PEDIDO[p.status]}>{ROTULOS.statusPedido[p.status]}</Selo>
                </h2>
                <span className="text-sm text-stone-500">Entrega prevista: {data(p.data_entrega_prevista)}</span>
              </div>
              <Tabela cabecalho={["Material", "Reservado", "Em estoque", "Livre", "A caminho", "Situação", "Observação"]}>
                {itens.map((r) => {
                  const s = saldo.get(r.produto_id);
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3"><Link href={`/estoque/${r.produto_id}`} className="font-medium text-madeira-800 hover:underline">{r.produto?.nome ?? "Material"}</Link></td>
                      <td className="px-4 py-3 font-medium">{qtd(r.quantidade, r.produto?.unidade_medida)}</td>
                      <td className="px-4 py-3">{qtd(s?.estoque_atual)}</td>
                      <td className="px-4 py-3">{qtd(s?.livre)}</td>
                      <td className="px-4 py-3">{Number(s?.a_caminho) ? qtd(s?.a_caminho) : "—"}</td>
                      <td className="px-4 py-3">{falta(r) ? <Selo cor="red">falta material</Selo> : <Selo cor="green">garantido</Selo>}</td>
                      <td className="px-4 py-3 text-stone-500">{r.observacoes ?? "—"}</td>
                    </tr>
                  );
                })}
              </Tabela>
            </section>
          );
        })}
      </div>
    </>
  );
}
