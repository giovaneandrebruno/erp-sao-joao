import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { brl, dataHora } from "@/lib/format";
import { CATEGORIAS, CATEGORIA_CURTA, COR_INVENTARIO, STATUS_INVENTARIO, qtd, type Categoria, type StatusInventario } from "@/lib/estoque";
import { cancelarInventario, concluirInventario, salvarContagem } from "../actions";

type Item = { id: string; saldo_sistema: number; contado: number | null; produto: { id: string; nome: string; codigo: string | null; unidade_medida: string; categoria: Categoria; local: string | null; custo: number } | null };

/** Folha de contagem: digite o que foi contado; ao concluir, o saldo de cada item é ajustado. */
export default async function InventarioDetalhe({ params }: PageProps<"/estoque/inventario/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: inv }, { data: itens }] = await Promise.all([
    supabase.from("inventarios").select("*").eq("id", id).maybeSingle(),
    supabase.from("inventario_itens").select("id, saldo_sistema, contado, produto:produto_id(id, nome, codigo, unidade_medida, categoria, local, custo)").eq("inventario_id", id),
  ]);
  if (!inv) notFound();
  const status = inv.status as StatusInventario;
  const aberto = status === "aberto";
  const lista = ((itens ?? []) as unknown as Item[])
    .filter((i) => i.produto)
    .sort((a, b) => `${a.produto!.local ?? "~"} ${a.produto!.nome}`.localeCompare(`${b.produto!.local ?? "~"} ${b.produto!.nome}`, "pt-BR"));

  const contados = lista.filter((i) => i.contado !== null);
  const dif = (i: Item) => (i.contado === null ? 0 : Number(i.contado) - Number(i.saldo_sistema));
  const valorDif = contados.reduce((s, i) => s + dif(i) * Number(i.produto!.custo), 0);
  const comDif = contados.filter((i) => dif(i) !== 0).length;

  return (
    <>
      <Titulo
        sub={[`Inventário #${inv.numero}`, inv.categoria ? CATEGORIAS[inv.categoria as Categoria] : "Todo o estoque", `aberto em ${dataHora(inv.criado_em)}`, inv.concluido_em && `concluído em ${dataHora(inv.concluido_em)}`].filter(Boolean).join(" · ")}
        acao={
          <div className="flex flex-wrap gap-2">
            <Link href="/estoque/inventario" className="text-sm text-stone-500 hover:underline">Voltar</Link>
            {aberto && (
              <form action={cancelarInventario.bind(null, id)}>
                <Botao type="submit" variante="secundario">Cancelar contagem</Botao>
              </form>
            )}
          </div>
        }
      >
        {inv.descricao}
        <Selo cor={COR_INVENTARIO[status]}>{STATUS_INVENTARIO[status]}</Selo>
      </Titulo>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador rotulo="Itens contados" valor={`${contados.length} de ${lista.length}`} />
        <Indicador rotulo="Itens com diferença" valor={comDif} cor={comDif ? "vermelho" : undefined} />
        <Indicador rotulo="Diferença em valor" valor={brl(valorDif)} cor={valorDif < 0 ? "vermelho" : valorDif > 0 ? "verde" : undefined} sub="Sobra (+) ou falta (−) pelo custo" />
        <Indicador rotulo="Ordem da folha" valor={<span className="font-sans text-base">Por local e nome</span>} sub="Para contar andando pelo depósito" />
      </div>

      <form action={salvarContagem.bind(null, id)}>
        <Tabela cabecalho={["Local", "Material", "Categoria", "Saldo no sistema", "Contado", "Diferença"]} vazio={!lista.length}>
          {lista.map((i) => {
            const d = dif(i);
            return (
              <tr key={i.id}>
                <td className="px-4 py-3">{i.produto!.local ?? "—"}</td>
                <td className="px-4 py-3"><Link href={`/estoque/${i.produto!.id}`} className="font-medium text-madeira-800 hover:underline">{i.produto!.nome}</Link>{i.produto!.codigo && <span className="ml-2 text-xs text-stone-400">{i.produto!.codigo}</span>}</td>
                <td className="px-4 py-3">{CATEGORIA_CURTA[i.produto!.categoria]}</td>
                <td className="px-4 py-3">{qtd(i.saldo_sistema, i.produto!.unidade_medida)}</td>
                <td className="px-4 py-2">
                  {aberto
                    ? <input name={`c:${i.id}`} inputMode="decimal" defaultValue={i.contado === null ? "" : String(i.contado).replace(".", ",")} className={`${inputCls} w-28`} />
                    : i.contado === null ? "não contado" : qtd(i.contado, i.produto!.unidade_medida)}
                </td>
                <td className={`px-4 py-3 font-medium ${d < 0 ? "text-rosa" : d > 0 ? "text-neon" : ""}`}>{i.contado === null ? "—" : d === 0 ? "ok" : `${d > 0 ? "+" : ""}${qtd(d)}`}</td>
              </tr>
            );
          })}
        </Tabela>
        {aberto && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <span className="text-xs text-stone-500">Deixe em branco o que ainda não contou. Só os itens contados têm o saldo ajustado.</span>
            <Botao type="submit" variante="secundario">Salvar contagem</Botao>
            <Botao type="submit" formAction={concluirInventario.bind(null, id)}>Concluir e ajustar o saldo</Botao>
          </div>
        )}
      </form>
    </>
  );
}
