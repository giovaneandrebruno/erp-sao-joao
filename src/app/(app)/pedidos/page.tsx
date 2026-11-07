import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Selo, Tabela, Titulo } from "@/components/ui";
import { COR_PEDIDO, ROTULOS, brl, data } from "@/lib/format";

export default async function PedidosPage({ searchParams }: PageProps<"/pedidos">) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let consulta = supabase
    .from("pedidos_resumo")
    .select("id, numero, cliente_nome, unidade, status, total, data_entrega_prevista")
    .order("numero", { ascending: false })
    .limit(200);
  if (typeof status === "string" && status in COR_PEDIDO) consulta = consulta.eq("status", status);
  const { data: pedidos } = await consulta;

  return (
    <>
      <Titulo>Pedidos</Titulo>
      <p className="mb-4 text-sm text-stone-500">Pedidos nascem quando um orçamento é aprovado.</p>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/pedidos" className={!status ? "font-semibold text-amber-800" : "text-stone-500"}>Todos</Link>
        {Object.entries(ROTULOS.statusPedido).map(([k, r]) => (
          <Link key={k} href={`/pedidos?status=${k}`} className={status === k ? "font-semibold text-amber-800" : "text-stone-500"}>{r}</Link>
        ))}
      </div>
      <Tabela cabecalho={["Nº", "Cliente", "Unidade", "Entrega prevista", "Status", "Total"]} vazio={!pedidos?.length}>
        {pedidos?.map((p) => (
          <tr key={p.id} className="hover:bg-stone-50">
            <td className="px-4 py-3"><Link href={`/pedidos/${p.id}`} className="font-medium text-amber-800 hover:underline">#{p.numero}</Link></td>
            <td className="px-4 py-3">{p.cliente_nome}</td>
            <td className="px-4 py-3">{ROTULOS.unidade[p.unidade as keyof typeof ROTULOS.unidade]}</td>
            <td className="px-4 py-3">{data(p.data_entrega_prevista)}</td>
            <td className="px-4 py-3"><Selo cor={COR_PEDIDO[p.status as keyof typeof COR_PEDIDO]}>{ROTULOS.statusPedido[p.status as keyof typeof COR_PEDIDO]}</Selo></td>
            <td className="px-4 py-3">{brl(p.total)}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
