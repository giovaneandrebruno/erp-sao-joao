import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Indicador, Selo, Tabela, Titulo } from "@/components/ui";
import { brl, data, hojeISO } from "@/lib/format";
import { COR_COMPRA, STATUS_COMPRA, qtd, type StatusCompra } from "@/lib/estoque";

type Compra = {
  id: string; numero: number; status: StatusCompra; previsao_entrega: string | null;
  fornecedor: { nome: string; telefone: string | null } | null; pedido: { id: string; numero: number } | null;
  itens: { descricao: string; quantidade: number; recebido: number; unidade: string; preco_unitario: number }[];
};
type Receb = { id: string; recebido_em: string; nota_fiscal: string | null; conferido_por: string | null; itens: { quantidade: number; descricao: string }[]; compra: { id: string; numero: number; fornecedor: { nome: string } | null } | null };

/** Recebimento: o que está para chegar (por data) e o histórico do que já chegou. */
export default async function RecebimentoPage() {
  const supabase = await createClient();
  const [{ data: pendentes }, { data: historico }] = await Promise.all([
    supabase
      .from("compras")
      .select("id, numero, status, previsao_entrega, fornecedor:fornecedor_id(nome, telefone), pedido:pedido_id(id, numero), itens:compra_itens(descricao, quantidade, recebido, unidade, preco_unitario)")
      .in("status", ["enviado", "parcial"])
      .order("previsao_entrega", { ascending: true, nullsFirst: false }),
    supabase.from("recebimentos").select("id, recebido_em, nota_fiscal, conferido_por, itens, compra:compra_id(id, numero, fornecedor:fornecedor_id(nome))").order("criado_em", { ascending: false }).limit(50),
  ]);
  const lista = (pendentes ?? []) as unknown as Compra[];
  const hoje = hojeISO();
  const semana = hojeISO(7);
  const atrasadas = lista.filter((c) => c.previsao_entrega && c.previsao_entrega < hoje);
  const hojeChega = lista.filter((c) => c.previsao_entrega === hoje);
  const proximas = lista.filter((c) => c.previsao_entrega && c.previsao_entrega > hoje && c.previsao_entrega <= semana);

  return (
    <>
      <Titulo sub="O que está para chegar dos fornecedores. Ao chegar, abra o pedido de compra, confira as quantidades e confirme: o material entra no estoque.">
        Recebimento de material
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Aguardando entrega" valor={lista.length} />
        <Indicador rotulo="Atrasadas" valor={atrasadas.length} cor={atrasadas.length ? "vermelho" : undefined} sub="Passou da previsão" />
        <Indicador rotulo="Chegam hoje" valor={hojeChega.length} />
        <Indicador rotulo="Próximos 7 dias" valor={proximas.length} />
      </div>
      <Tabela cabecalho={["Previsão", "Pedido de compra", "Fornecedor", "Falta chegar", "Valor", "Para", "Situação"]} vazio={!lista.length}>
        {lista.map((c) => {
          const faltam = c.itens.filter((i) => Number(i.recebido) < Number(i.quantidade));
          const valor = faltam.reduce((s, i) => s + (Number(i.quantidade) - Number(i.recebido)) * Number(i.preco_unitario), 0);
          const atraso = c.previsao_entrega && c.previsao_entrega < hoje;
          return (
            <tr key={c.id}>
              <td className="px-4 py-3">{data(c.previsao_entrega)} {atraso && <Selo cor="red">atrasado</Selo>}{c.previsao_entrega === hoje && <Selo cor="amber">hoje</Selo>}</td>
              <td className="px-4 py-3"><Link href={`/compras/pedidos/${c.id}`} className="font-medium text-madeira-800 hover:underline">#{c.numero} · receber</Link></td>
              <td className="px-4 py-3 font-medium">{c.fornecedor?.nome ?? "—"}</td>
              <td className="px-4 py-3 text-stone-600">{faltam.slice(0, 3).map((i) => `${qtd(Number(i.quantidade) - Number(i.recebido), i.unidade)} ${i.descricao}`).join(" · ")}{faltam.length > 3 ? ` e mais ${faltam.length - 3}` : ""}</td>
              <td className="px-4 py-3">{brl(valor)}</td>
              <td className="px-4 py-3">{c.pedido ? <Link href={`/pedidos/${c.pedido.id}`} className="text-madeira-800 hover:underline">Pedido #{c.pedido.numero}</Link> : "Estoque"}</td>
              <td className="px-4 py-3"><Selo cor={COR_COMPRA[c.status]}>{STATUS_COMPRA[c.status]}</Selo></td>
            </tr>
          );
        })}
      </Tabela>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Últimos recebimentos</h2>
      <Tabela cabecalho={["Data", "Pedido de compra", "Fornecedor", "Nota fiscal", "O que chegou", "Conferido por"]} vazio={!historico?.length}>
        {((historico ?? []) as unknown as Receb[]).map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3">{data(r.recebido_em)}</td>
            <td className="px-4 py-3">{r.compra ? <Link href={`/compras/pedidos/${r.compra.id}`} className="text-madeira-800 hover:underline">#{r.compra.numero}</Link> : "—"}</td>
            <td className="px-4 py-3">{r.compra?.fornecedor?.nome ?? "—"}</td>
            <td className="px-4 py-3">{r.nota_fiscal ?? "—"}</td>
            <td className="px-4 py-3 text-stone-600">{r.itens.map((x) => `${qtd(x.quantidade)} ${x.descricao}`).join(" · ")}</td>
            <td className="px-4 py-3">{r.conferido_por ?? "—"}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
