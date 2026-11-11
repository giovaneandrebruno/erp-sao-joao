import Link from "next/link";
import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Selo, Tabela, Titulo } from "@/components/ui";
import { ROTULOS, brl } from "@/lib/format";

export default async function EstoquePage({ searchParams }: PageProps<"/estoque">) {
  const { baixo } = await searchParams;
  const supabase = await createClient();
  const { data: produtos } = await supabase
    .from("produtos")
    .select("id, codigo, nome, tipo, unidade_medida, custo, preco_venda, estoque_atual, estoque_minimo, ativo")
    .order("nome");
  const lista = (produtos ?? []).filter((p) => !baixo || (p.tipo !== "servico" && Number(p.estoque_atual) <= Number(p.estoque_minimo)));

  return (
    <>
      <Titulo acao={<FerramentasImportacao area="estoque" extra={<BotaoLink href="/estoque/novo">Novo produto</BotaoLink>} />}>Estoque e produtos</Titulo>
      <div className="mb-4 flex gap-3 text-sm">
        <Link href="/estoque" className={!baixo ? "font-semibold text-madeira-800" : "text-stone-500"}>Todos</Link>
        <Link href="/estoque?baixo=1" className={baixo ? "font-semibold text-madeira-800" : "text-stone-500"}>Abaixo do mínimo</Link>
      </div>
      <Tabela cabecalho={["Código", "Nome", "Tipo", "Estoque", "Mínimo", "Custo", "Venda"]} vazio={!lista.length}>
        {lista.map((p) => {
          const alerta = p.tipo !== "servico" && Number(p.estoque_atual) <= Number(p.estoque_minimo);
          return (
            <tr key={p.id} className={`hover:bg-stone-50 ${p.ativo ? "" : "opacity-50"}`}>
              <td className="px-4 py-3">{p.codigo ?? "—"}</td>
              <td className="px-4 py-3"><Link href={`/estoque/${p.id}`} className="font-medium text-madeira-800 hover:underline">{p.nome}</Link></td>
              <td className="px-4 py-3">{ROTULOS.tipoProduto[p.tipo as keyof typeof ROTULOS.tipoProduto]}</td>
              <td className="px-4 py-3">
                {p.tipo === "servico" ? "—" : <>{Number(p.estoque_atual)} {p.unidade_medida} {alerta && <Selo cor="red">repor</Selo>}</>}
              </td>
              <td className="px-4 py-3">{p.tipo === "servico" ? "—" : Number(p.estoque_minimo)}</td>
              <td className="px-4 py-3">{brl(p.custo)}</td>
              <td className="px-4 py-3">{brl(p.preco_venda)}</td>
            </tr>
          );
        })}
      </Tabela>
    </>
  );
}
