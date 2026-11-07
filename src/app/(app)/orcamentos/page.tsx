import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Selo, Tabela, Titulo } from "@/components/ui";
import { ROTULOS, brl, data } from "@/lib/format";

const COR = { rascunho: "stone", enviado: "blue", aprovado: "green", recusado: "red" } as const;

export default async function OrcamentosPage({ searchParams }: PageProps<"/orcamentos">) {
  const { status } = await searchParams;
  const supabase = await createClient();
  let consulta = supabase
    .from("orcamentos_resumo")
    .select("id, numero, cliente_nome, unidade, status, total, criado_em, validade")
    .order("numero", { ascending: false })
    .limit(200);
  if (typeof status === "string" && status in COR) consulta = consulta.eq("status", status);
  const { data: orcamentos } = await consulta;

  return (
    <>
      <Titulo acao={<BotaoLink href="/orcamentos/novo">Novo orçamento</BotaoLink>}>Orçamentos</Titulo>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/orcamentos" className={!status ? "font-semibold text-madeira-800" : "text-stone-500"}>Todos</Link>
        {Object.entries(ROTULOS.statusOrcamento).map(([k, r]) => (
          <Link key={k} href={`/orcamentos?status=${k}`} className={status === k ? "font-semibold text-madeira-800" : "text-stone-500"}>{r}</Link>
        ))}
      </div>
      <Tabela cabecalho={["Nº", "Cliente", "Unidade", "Data", "Validade", "Status", "Total"]} vazio={!orcamentos?.length}>
        {orcamentos?.map((o) => (
          <tr key={o.id} className="hover:bg-stone-50">
            <td className="px-4 py-3"><Link href={`/orcamentos/${o.id}`} className="font-medium text-madeira-800 hover:underline">#{o.numero}</Link></td>
            <td className="px-4 py-3">{o.cliente_nome}</td>
            <td className="px-4 py-3">{ROTULOS.unidade[o.unidade as keyof typeof ROTULOS.unidade]}</td>
            <td className="px-4 py-3">{data(o.criado_em)}</td>
            <td className="px-4 py-3">{data(o.validade)}</td>
            <td className="px-4 py-3"><Selo cor={COR[o.status as keyof typeof COR]}>{ROTULOS.statusOrcamento[o.status as keyof typeof COR]}</Selo></td>
            <td className="px-4 py-3">{brl(o.total)}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
