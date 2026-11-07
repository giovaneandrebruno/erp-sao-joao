import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Cartao, Selo, Tabela, Titulo } from "@/components/ui";
import { ROTULOS, brl, data } from "@/lib/format";
import { FormCliente } from "../form";

export default async function ClientePage({ params }: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: cliente }, { data: orcamentos }, { data: pedidos }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase.from("orcamentos_resumo").select("id, numero, status, total, criado_em").eq("cliente_id", id).order("numero", { ascending: false }),
    supabase.from("pedidos_resumo").select("id, numero, status, total, data_entrega_prevista").eq("cliente_id", id).order("numero", { ascending: false }),
  ]);
  if (!cliente) notFound();

  return (
    <>
      <Titulo acao={<div className="flex gap-2"><Link href={`/crm/nova?cliente=${id}`} className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:border-violeta/40 hover:text-violeta">Nova negociação</Link><BotaoLink href={`/orcamentos/novo?cliente=${id}`}>Novo orçamento</BotaoLink></div>}>{cliente.nome}</Titulo>
      <Cartao className="mb-8"><FormCliente cliente={cliente} /></Cartao>

      <h2 className="mb-3 text-lg font-semibold">Orçamentos</h2>
      <div className="mb-8">
        <Tabela cabecalho={["Nº", "Data", "Status", "Total"]} vazio={!orcamentos?.length}>
          {orcamentos?.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3"><Link href={`/orcamentos/${o.id}`} className="text-madeira-800 hover:underline">#{o.numero}</Link></td>
              <td className="px-4 py-3">{data(o.criado_em)}</td>
              <td className="px-4 py-3"><Selo>{ROTULOS.statusOrcamento[o.status as keyof typeof ROTULOS.statusOrcamento]}</Selo></td>
              <td className="px-4 py-3">{brl(o.total)}</td>
            </tr>
          ))}
        </Tabela>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Pedidos</h2>
      <Tabela cabecalho={["Nº", "Entrega prevista", "Status", "Total"]} vazio={!pedidos?.length}>
        {pedidos?.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3"><Link href={`/pedidos/${p.id}`} className="text-madeira-800 hover:underline">#{p.numero}</Link></td>
            <td className="px-4 py-3">{data(p.data_entrega_prevista)}</td>
            <td className="px-4 py-3"><Selo>{ROTULOS.statusPedido[p.status as keyof typeof ROTULOS.statusPedido]}</Selo></td>
            <td className="px-4 py-3">{brl(p.total)}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
