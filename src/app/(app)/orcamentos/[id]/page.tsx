import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { ROTULOS, brl } from "@/lib/format";
import { adicionarItem, aprovar, atualizarOrcamento, mudarStatus, removerItem } from "../actions";
import { CamposOrcamento } from "../campos";
import { Previsao } from "../previsao";

export default async function OrcamentoPage({ params }: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: o }, { data: itens }, { data: produtos }, { data: pedido }, { data: parceiros }, { data: cfg }] = await Promise.all([
    supabase.from("orcamentos_resumo").select("*").eq("id", id).maybeSingle(),
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem").order("criado_em"),
    supabase.from("produtos").select("id, nome, preco_venda").eq("ativo", true).order("nome"),
    supabase.from("pedidos").select("id, numero").eq("orcamento_id", id).maybeSingle(),
    supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
    supabase.from("configuracoes").select("margem_minima, markup_padrao").single(),
  ]);
  if (!o) notFound();
  const editavel = o.status !== "aprovado";
  const ambientes = Array.from(new Set((itens ?? []).map((i) => i.ambiente).filter(Boolean))) as string[];

  return (
    <>
      <Titulo
        acao={
          <div className="flex flex-wrap gap-2">
            <Link href={`/orcamentos/${id}/imprimir`} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm">Imprimir / PDF</Link>
            {o.status === "rascunho" && (
              <form action={mudarStatus.bind(null, id, "enviado")}><Botao variante="secundario">Marcar como enviado</Botao></form>
            )}
            {editavel && o.status !== "recusado" && (
              <form action={mudarStatus.bind(null, id, "recusado")}><Botao variante="secundario">Recusado</Botao></form>
            )}
            {editavel && (itens?.length ?? 0) > 0 && (
              <form action={aprovar.bind(null, id)}><Botao>Aprovar e gerar pedido</Botao></form>
            )}
          </div>
        }
      >
        Orçamento #{o.numero} <Selo>{ROTULOS.statusOrcamento[o.status as keyof typeof ROTULOS.statusOrcamento]}</Selo>
      </Titulo>

      <p className="mb-6 text-sm text-stone-600">
        Cliente: <Link href={`/clientes/${o.cliente_id}`} className="font-medium text-madeira-700 hover:underline">{o.cliente_nome}</Link>
        {pedido && <> · Virou o <Link href={`/pedidos/${pedido.id}`} className="font-medium text-madeira-700 hover:underline">pedido #{pedido.numero}</Link></>}
      </p>

      <div className="mb-8 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Itens</h2>
          <Tabela cabecalho={["Ambiente", "Descrição", "Qtd", "Custo unit.", "Venda unit.", "Total", ""]} vazio={!itens?.length}>
            {itens?.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3">{i.ambiente ?? "—"}</td>
                <td className="px-4 py-3">{i.descricao}</td>
                <td className="px-4 py-3">{Number(i.quantidade)}</td>
                <td className="px-4 py-3 text-stone-500">{brl(i.custo_unitario)}</td>
                <td className="px-4 py-3">{brl(i.preco_unitario)}</td>
                <td className="px-4 py-3 font-medium">{brl(Number(i.quantidade) * Number(i.preco_unitario))}</td>
                <td className="px-4 py-3 text-right">
                  {editavel && (
                    <form action={removerItem.bind(null, id, i.id)}>
                      <button className="text-xs text-red-600 hover:underline">remover</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
          <div className="mt-3 text-right text-sm">
            <div>Subtotal: {brl(o.subtotal)}</div>
            {Number(o.desconto) > 0 && <div>Desconto: −{brl(o.desconto)}</div>}
            <div className="text-lg font-semibold">Total: {brl(o.total)}</div>
          </div>
        </div>
        <div>
          <Previsao r={o} margemMinima={Number(cfg?.margem_minima ?? 0)} />
          <p className="mt-2 text-xs text-stone-500">Só a equipe vê este quadro. Ele não sai no PDF do cliente.</p>
        </div>
      </div>

      {editavel && (
        <Cartao className="mb-8">
          <h3 className="mb-3 font-semibold">Adicionar item</h3>
          <form action={adicionarItem.bind(null, id)} className="grid gap-3 md:grid-cols-12">
            <Campo rotulo="Ambiente" className="md:col-span-2">
              <input name="ambiente" list="ambientes" placeholder="Cozinha" className={inputCls} />
              <datalist id="ambientes">
                {[...ambientes, "Cozinha", "Dormitório casal", "Dormitório solteiro", "Banheiro", "Sala", "Home office", "Área de serviço", "Closet"].map((a) => <option key={a} value={a} />)}
              </datalist>
            </Campo>
            <Campo rotulo="Produto do catálogo" className="md:col-span-3">
              <select name="produto_id" defaultValue="" className={inputCls}>
                <option value="">— item sob medida —</option>
                {produtos?.map((p) => <option key={p.id} value={p.id}>{p.nome} ({brl(p.preco_venda)})</option>)}
              </select>
            </Campo>
            <Campo rotulo="Descrição" className="md:col-span-3">
              <input name="descricao" placeholder="Armário aéreo em MDF branco" className={inputCls} />
            </Campo>
            <Campo rotulo="Qtd" className="md:col-span-1">
              <input name="quantidade" inputMode="decimal" defaultValue="1" className={inputCls} />
            </Campo>
            <Campo rotulo="Custo unit." className="md:col-span-1">
              <input name="custo_unitario" inputMode="decimal" className={inputCls} />
            </Campo>
            <Campo rotulo="Venda unit." className="md:col-span-1">
              <input name="preco_unitario" inputMode="decimal" className={inputCls} />
            </Campo>
            <div className="flex items-end md:col-span-1"><Botao type="submit">+</Botao></div>
          </form>
          <p className="mt-2 text-xs text-stone-500">
            Deixe o valor de venda em branco para calcular pelo markup ({Number(cfg?.markup_padrao ?? 1)}× o custo). Produtos do catálogo trazem custo e preço do cadastro.
          </p>
        </Cartao>
      )}

      <h2 className="mb-3 text-lg font-semibold">Dados do orçamento</h2>
      <Cartao>
        <form action={atualizarOrcamento.bind(null, id)} className="grid gap-4 md:grid-cols-6">
          <fieldset disabled={!editavel} className="contents">
            <CamposOrcamento o={o} parceiros={parceiros ?? []} />
            {editavel && <div className="md:col-span-6"><Botao type="submit">Salvar</Botao></div>}
          </fieldset>
        </form>
      </Cartao>
    </>
  );
}
