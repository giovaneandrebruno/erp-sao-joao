import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Selo, Tabela, Titulo } from "@/components/ui";
import { ROTULOS2, data, hojeISO } from "@/lib/format";

export default async function PrazosPage() {
  const supabase = await createClient();
  const hoje = hojeISO();
  const limite = new Date();
  limite.setDate(limite.getDate() + 21);
  const { data: marcos } = await supabase
    .from("pedido_marcos")
    .select("id, tipo, previsto, pedido_id, pedidos!inner(numero, status, clientes(nome)), responsavel:responsavel_id(nome)")
    .is("realizado", null)
    .not("previsto", "is", null)
    .lte("previsto", limite.toISOString().slice(0, 10))
    .not("pedidos.status", "in", "(entregue,cancelado)")
    .order("previsto");

  const atrasados = (marcos ?? []).filter((m) => m.previsto! < hoje);
  const proximos = (marcos ?? []).filter((m) => m.previsto! >= hoje);

  const linhas = (lista: typeof atrasados, atraso: boolean) =>
    lista.map((m) => {
      const ped = m.pedidos as unknown as { numero: number; clientes: { nome: string } | null };
      const resp = m.responsavel as unknown as { nome: string } | null;
      const dias = Math.round((new Date(`${m.previsto}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 864e5);
      return (
        <tr key={m.id}>
          <td className="px-4 py-3">{data(m.previsto)}</td>
          <td className="px-4 py-3">{atraso ? <Selo cor="red">{-dias} dia(s) de atraso</Selo> : dias === 0 ? <Selo cor="amber">hoje</Selo> : <span className="text-stone-500">em {dias} dia(s)</span>}</td>
          <td className="px-4 py-3 font-medium">{ROTULOS2.marco[m.tipo as keyof typeof ROTULOS2.marco]}</td>
          <td className="px-4 py-3"><Link href={`/pedidos/${m.pedido_id}`} className="text-madeira-700 hover:underline">#{ped.numero} · {ped.clientes?.nome}</Link></td>
          <td className="px-4 py-3">{resp?.nome ?? "—"}</td>
        </tr>
      );
    });

  return (
    <>
      <Titulo>Prazos</Titulo>
      <p className="mb-6 text-sm text-stone-500">Marcos de todos os pedidos em andamento: atrasados e os próximos 21 dias. Para dar baixa, abra o pedido.</p>
      <h2 className="mb-3 text-lg font-semibold text-red-700">Atrasados ({atrasados.length})</h2>
      <div className="mb-8">
        <Tabela cabecalho={["Previsto", "Situação", "Marco", "Pedido", "Responsável"]} vazio={!atrasados.length}>{linhas(atrasados, true)}</Tabela>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Próximos 21 dias ({proximos.length})</h2>
      <Tabela cabecalho={["Previsto", "Situação", "Marco", "Pedido", "Responsável"]} vazio={!proximos.length}>{linhas(proximos, false)}</Tabela>
    </>
  );
}
