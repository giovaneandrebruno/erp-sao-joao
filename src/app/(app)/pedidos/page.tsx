import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Selo, Tabela, Titulo, VerMais, quantidadeDaLista } from "@/components/ui";
import { COR_PEDIDO, ROTULOS, brl, data, hojeISO } from "@/lib/format";
import { ETAPAS, ORDEM_ETAPAS, ehEtapa, nomeEtapa, nomeSituacao } from "@/lib/processo";

export default async function PedidosPage({ searchParams }: PageProps<"/pedidos">) {
  const sp = await searchParams;
  const { status, etapa } = sp;
  const qtd = quantidadeDaLista(sp.qtd);
  const supabase = await createClient();
  let consulta = supabase
    .from("pedidos_resumo")
    .select("id, numero, cliente_nome, unidade, status, total, data_entrega_prevista", { count: "exact" })
    .order("numero", { ascending: false })
    .limit(qtd);
  if (typeof status === "string" && status in COR_PEDIDO) consulta = consulta.eq("status", status);
  if (ehEtapa(etapa)) {
    const { data: daEtapa } = await supabase.from("pedidos").select("id").eq("etapa", etapa);
    consulta = consulta.in("id", (daEtapa ?? []).map((x) => x.id));
  }
  const { data: pedidos, count } = await consulta;
  const ids = (pedidos ?? []).map((x) => x.id);
  const { data: processos } = ids.length
    ? await supabase.from("pedidos").select("id, etapa, situacao, situacao_prazo, data_limite_entrega").in("id", ids)
    : { data: [] };
  const processoDe = new Map((processos ?? []).map((x) => [x.id, x]));
  const hoje = hojeISO();

  return (
    <>
      <Titulo>Pedidos</Titulo>
      <p className="mb-4 text-sm text-stone-500">Pedidos nascem quando um orçamento é aprovado.</p>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/pedidos" className={!status ? "font-semibold text-madeira-800" : "text-stone-500"}>Todos</Link>
        {Object.entries(ROTULOS.statusPedido).map(([k, r]) => (
          <Link key={k} href={`/pedidos?status=${k}`} className={status === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="text-stone-400">Etapa:</span>
        {ORDEM_ETAPAS.map((k) => (
          <Link key={k} href={`/pedidos?etapa=${k}`} className={etapa === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{ETAPAS[k].nome}</Link>
        ))}
      </div>
      <Tabela cabecalho={["Nº", "Cliente", "Unidade", "Entrega prevista", "Etapa", "Status", "Total"]} vazio={!pedidos?.length}>
        {pedidos?.map((p) => (
          <tr key={p.id} className="hover:bg-stone-50">
            <td className="px-4 py-3"><Link href={`/pedidos/${p.id}`} className="font-medium text-madeira-800 hover:underline">#{p.numero}</Link></td>
            <td className="px-4 py-3">{p.cliente_nome}</td>
            <td className="px-4 py-3">{ROTULOS.unidade[p.unidade as keyof typeof ROTULOS.unidade]}</td>
            <td className="px-4 py-3">{data(p.data_entrega_prevista)}</td>
            <td className="px-4 py-3">
              {(() => {
                const x = processoDe.get(p.id);
                if (!x) return "—";
                const vencido = x.situacao_prazo && x.situacao_prazo < hoje && x.etapa !== "concluido" && x.etapa !== "cancelamento";
                return (
                  <>
                    <span className="font-medium">{nomeEtapa(x.etapa)}</span>
                    {nomeSituacao(x.situacao) && <span className={`block text-xs ${vencido ? "text-rosa" : "text-stone-500"}`}>{nomeSituacao(x.situacao)}{vencido ? " · prazo vencido" : ""}</span>}
                  </>
                );
              })()}
            </td>
            <td className="px-4 py-3"><Selo cor={COR_PEDIDO[p.status as keyof typeof COR_PEDIDO]}>{ROTULOS.statusPedido[p.status as keyof typeof COR_PEDIDO]}</Selo></td>
            <td className="px-4 py-3">{brl(p.total)}</td>
          </tr>
        ))}
      </Tabela>
      <VerMais mostrando={pedidos?.length ?? 0} total={count} rotulo="pedidos" parametros={sp} />
    </>
  );
}
