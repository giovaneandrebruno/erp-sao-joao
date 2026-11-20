import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { brl, data } from "@/lib/format";
import { CATEGORIA_CURTA, ORIGEM_MOVIMENTO, STATUS_COMPRA, COR_COMPRA, TIPO_MOVIMENTO, qtd, type Categoria, type Origem, type StatusCompra } from "@/lib/estoque";
import { excluirProduto, registrarMovimento } from "../actions";
import { BotaoExcluir } from "@/components/acoes";
import { FormProduto } from "../form";
import { JanelaBotao } from "@/components/janela";

const ROTULO_TIPO = { materia_prima: "Matéria-prima", produto: "Produto para venda", servico: "Serviço" } as const;

export default async function ProdutoPage({ params }: PageProps<"/estoque/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: produto }, { data: saldo }, { data: fornecedores }, { data: movimentos }, { data: reservas }, { data: comprasAbertas }] = await Promise.all([
    supabase.from("produtos").select("*").eq("id", id).maybeSingle(),
    supabase.from("produtos_saldo").select("reservado, livre, a_caminho").eq("id", id).maybeSingle(),
    supabase.from("fornecedores").select("id, nome").order("nome"),
    supabase.from("movimentos_estoque").select("*").eq("produto_id", id).order("criado_em", { ascending: false }).limit(100),
    supabase.from("pedido_materiais").select("id, quantidade, pedido:pedido_id(id, numero, status, cliente:cliente_id(nome))").eq("produto_id", id).eq("baixado", false),
    supabase.from("compra_itens").select("id, quantidade, recebido, pedido:pedido_id(numero, cliente:cliente_id(nome)), compra:compra_id(id, numero, status, previsao_entrega, fornecedor:fornecedor_id(nome))").eq("produto_id", id),
  ]);
  if (!produto) notFound();

  type Reserva = { id: string; quantidade: number; pedido: { id: string; numero: number; status: string; cliente: { nome: string } | null } | null };
  const reservasAbertas = ((reservas ?? []) as unknown as Reserva[]).filter((r) => r.pedido && !["cancelado", "entregue"].includes(r.pedido.status));
  type ItemCompra = { id: string; quantidade: number; recebido: number; pedido: { numero: number; cliente: { nome: string } | null } | null; compra: { id: string; numero: number; status: StatusCompra; previsao_entrega: string | null; fornecedor: { nome: string } | null } | null };
  const aCaminho = ((comprasAbertas ?? []) as unknown as ItemCompra[]).filter((c) => c.compra && ["rascunho", "enviado", "parcial"].includes(c.compra.status));
  const un = produto.unidade_medida;

  const movimentar = (
    <JanelaBotao rotulo="Movimentar estoque" titulo="Movimentar estoque" descricao={`Saldo atual: ${qtd(produto.estoque_atual, un)}. Material de compra entra pelo Recebimento, em Compras.`} icone="estoque" largura="xl">
      <form action={registrarMovimento.bind(null, id)} className="grid gap-3 md:grid-cols-12">
        <Campo rotulo="Tipo" className="md:col-span-3">
          <select name="movimento" className={inputCls}>
            {Object.entries(TIPO_MOVIMENTO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Motivo" className="md:col-span-3">
          <select name="origem" className={inputCls}>
            <option value="manual">Lançamento manual</option>
            <option value="perda">Perda ou avaria</option>
            <option value="devolucao">Devolução</option>
          </select>
        </Campo>
        <Campo rotulo="Quantidade" className="md:col-span-2">
          <input name="quantidade" inputMode="decimal" required className={inputCls} />
        </Campo>
        <Campo rotulo="Custo unit. (R$)" className="md:col-span-2">
          <input name="custo_unitario" inputMode="decimal" className={inputCls} />
        </Campo>
        <Campo rotulo="Referência" className="md:col-span-10">
          <input name="referencia" placeholder="NF 123, pedido #10, chapa riscada..." className={inputCls} />
        </Campo>
        <div className="flex items-end md:col-span-2"><Botao type="submit">Registrar</Botao></div>
      </form>
    </JanelaBotao>
  );

  const fornecedor = fornecedores?.find((f) => f.id === produto.fornecedor_id)?.nome;
  const chapa = produto.categoria === "chapa" && produto.chapa_largura_mm && produto.chapa_altura_mm
    ? `${produto.chapa_largura_mm} × ${produto.chapa_altura_mm} mm${produto.espessura_mm ? ` · ${String(produto.espessura_mm).replace(".", ",")} mm` : ""}`
    : null;

  return (
    <>
      <Titulo
        sub={[produto.codigo, ROTULO_TIPO[produto.tipo as keyof typeof ROTULO_TIPO], CATEGORIA_CURTA[produto.categoria as Categoria], produto.local && `Local: ${produto.local}`, chapa].filter(Boolean).join(" · ")}
        acao={
          <div className="flex flex-wrap gap-2">
            <JanelaBotao rotulo="Editar produto" titulo="Editar produto" descricao={produto.nome} variante="secundario" icone={null} largura="xl">
              <FormProduto produto={produto} fornecedores={fornecedores ?? []} />
            </JanelaBotao>
            {produto.tipo !== "servico" && movimentar}
            <BotaoExcluir acao={excluirProduto.bind(null, id)} rotulo="Excluir" titulo="Excluir este produto?" detalhe={<strong>{produto.nome}</strong>} aviso="Produto excluído" depois="/estoque" />
          </div>
        }
      >
        {produto.nome}
        {!produto.ativo && <Selo>inativo</Selo>}
      </Titulo>
      {produto.tipo !== "servico" ? (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <Indicador rotulo="Em estoque" valor={qtd(produto.estoque_atual, un)} sub={`mínimo ${qtd(produto.estoque_minimo)}`} />
          <Indicador rotulo="Reservado" valor={qtd(saldo?.reservado)} sub="Para pedidos em aberto" />
          <Indicador rotulo="Livre" valor={qtd(saldo?.livre, un)} cor={Number(saldo?.livre ?? 0) <= Number(produto.estoque_minimo) ? "vermelho" : undefined} sub="Estoque menos reservado" />
          <Indicador rotulo="A caminho" valor={qtd(saldo?.a_caminho)} sub="Comprado, ainda não chegou" />
          <Indicador rotulo="Custo médio" valor={brl(produto.custo)} sub={fornecedor ? `Fornecedor: ${fornecedor}` : `Venda ${brl(produto.preco_venda)}`} />
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Indicador rotulo="Custo" valor={brl(produto.custo)} />
          <Indicador rotulo="Preço de venda" valor={brl(produto.preco_venda)} />
        </div>
      )}

      {produto.tipo !== "servico" && (
        <>
          {(reservasAbertas.length > 0 || aCaminho.length > 0) && (
            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 text-lg font-semibold">Reservado para pedidos</h2>
                <Tabela cabecalho={["Pedido", "Cliente", "Quantidade"]} vazio={!reservasAbertas.length}>
                  {reservasAbertas.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3"><Link href={`/pedidos/${r.pedido!.id}`} className="font-medium text-madeira-800 hover:underline">#{r.pedido!.numero}</Link></td>
                      <td className="px-4 py-3">{r.pedido!.cliente?.nome ?? "—"}</td>
                      <td className="px-4 py-3">{qtd(r.quantidade, un)}</td>
                    </tr>
                  ))}
                </Tabela>
              </div>
              <div>
                <h2 className="mb-3 text-lg font-semibold">Compras em andamento</h2>
                <Tabela cabecalho={["Compra", "Fornecedor", "Para", "Falta chegar", "Previsão", "Situação"]} vazio={!aCaminho.length}>
                  {aCaminho.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-3"><Link href={`/compras/pedidos/${c.compra!.id}`} className="font-medium text-madeira-800 hover:underline">#{c.compra!.numero}</Link></td>
                      <td className="px-4 py-3">{c.compra!.fornecedor?.nome ?? "—"}</td>
                      <td className="px-4 py-3">{c.pedido ? `${c.pedido.cliente?.nome ?? "Cliente"} · #${c.pedido.numero}` : "Estoque"}</td>
                      <td className="px-4 py-3">{qtd(Math.max(0, Number(c.quantidade) - Number(c.recebido)), un)}</td>
                      <td className="px-4 py-3">{data(c.compra!.previsao_entrega)}</td>
                      <td className="px-4 py-3"><Selo cor={COR_COMPRA[c.compra!.status]}>{STATUS_COMPRA[c.compra!.status]}</Selo></td>
                    </tr>
                  ))}
                </Tabela>
              </div>
            </div>
          )}

          <h2 className="mb-3 text-lg font-semibold">Movimentações</h2>
          <Tabela cabecalho={["Data", "Tipo", "Motivo", "Quantidade", "Custo unit.", "Referência"]} vazio={!movimentos?.length}>
            {movimentos?.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">{data(m.criado_em)}</td>
                <td className="px-4 py-3">{TIPO_MOVIMENTO[m.tipo as keyof typeof TIPO_MOVIMENTO]}</td>
                <td className="px-4 py-3">{ORIGEM_MOVIMENTO[(m.origem ?? "manual") as Origem]}</td>
                <td className="px-4 py-3">{qtd(m.quantidade)}</td>
                <td className="px-4 py-3">{m.custo_unitario ? brl(m.custo_unitario) : "—"}</td>
                <td className="px-4 py-3">{m.referencia ?? "—"}</td>
              </tr>
            ))}
          </Tabela>
        </>
      )}
    </>
  );
}
