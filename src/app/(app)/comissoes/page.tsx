import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Selo, Tabela, Titulo } from "@/components/ui";
import { ROTULOS2, brl, data } from "@/lib/format";

export default async function ComissoesPage({ searchParams }: PageProps<"/comissoes">) {
  await connection();
  const sp = await searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : new Date().toISOString().slice(0, 7);
  const [ano, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const fim = new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 10);

  const supabase = await createClient();
  const [{ data: pedidos }, { data: parceiros }, { data: pagos }] = await Promise.all([
    supabase
      .from("pedidos_resumo")
      .select("id, numero, cliente_nome, criado_em, total, status, vendedor_id, arquiteto_id, valor_comissao_vendedor, valor_comissao_arquiteto, comissoes_lancadas")
      .gte("criado_em", inicio)
      .lt("criado_em", fim)
      .neq("status", "cancelado")
      .order("numero"),
    supabase.from("parceiros").select("id, nome, tipo").in("tipo", ["vendedor", "arquiteto"]).order("nome"),
    supabase.from("lancamentos").select("pedido_id, descricao, pago_em").eq("categoria", "Comissão"),
  ]);

  const linhas = (parceiros ?? []).map((pp) => {
    const meus = (pedidos ?? []).filter((p) => (pp.tipo === "vendedor" ? p.vendedor_id : p.arquiteto_id) === pp.id);
    const vendas = meus.reduce((s, p) => s + Number(p.total), 0);
    const comissao = meus.reduce((s, p) => s + Number(pp.tipo === "vendedor" ? p.valor_comissao_vendedor : p.valor_comissao_arquiteto), 0);
    return { ...pp, meus, vendas, comissao };
  }).filter((l) => l.meus.length);

  const mesAnt = new Date(Date.UTC(ano, m - 2, 1)).toISOString().slice(0, 7);
  const mesSeg = new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 7);

  return (
    <>
      <Titulo>Comissões</Titulo>
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href={`/comissoes?mes=${mesAnt}`} className="px-2 text-madeira-700">←</Link>
        <strong>{mes.split("-").reverse().join("/")}</strong>
        <Link href={`/comissoes?mes=${mesSeg}`} className="px-2 text-madeira-700">→</Link>
        <span className="text-stone-500">· pedidos fechados no mês</span>
      </div>

      {!linhas.length && <Cartao><p className="text-sm text-stone-400">Nenhuma comissão neste mês.</p></Cartao>}
      <div className="flex flex-col gap-6">
        {linhas.map((l) => (
          <div key={l.id}>
            <div className="mb-2 flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold">{l.nome}</h2>
              <Selo cor={l.tipo === "vendedor" ? "blue" : "amber"}>{ROTULOS2.tipoParceiro[l.tipo as keyof typeof ROTULOS2.tipoParceiro]}</Selo>
              <span className="text-sm text-stone-600">vendas {brl(l.vendas)} · comissão <strong>{brl(l.comissao)}</strong></span>
            </div>
            <Tabela cabecalho={["Pedido", "Cliente", "Data", "Venda", "Comissão", "Situação"]}>
              {l.meus.map((p) => {
                const lanc = pagos?.find((x) => x.pedido_id === p.id && x.descricao.includes(l.nome));
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3"><Link href={`/pedidos/${p.id}`} className="text-madeira-700 hover:underline">#{p.numero}</Link></td>
                    <td className="px-4 py-3">{p.cliente_nome}</td>
                    <td className="px-4 py-3">{data(p.criado_em)}</td>
                    <td className="px-4 py-3">{brl(p.total)}</td>
                    <td className="px-4 py-3 font-medium">{brl(l.tipo === "vendedor" ? p.valor_comissao_vendedor : p.valor_comissao_arquiteto)}</td>
                    <td className="px-4 py-3">{lanc?.pago_em ? <Selo cor="green">paga {data(lanc.pago_em)}</Selo> : lanc ? <Selo cor="blue">a pagar</Selo> : <Selo>não lançada</Selo>}</td>
                  </tr>
                );
              })}
            </Tabela>
          </div>
        ))}
      </div>
    </>
  );
}
