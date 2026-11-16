import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Indicador, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { brl, data } from "@/lib/format";
import { registrarMovimento } from "../actions";
import { FormProduto } from "../form";
import { JanelaBotao } from "@/components/janela";

const ROTULO_TIPO = { materia_prima: "Matéria-prima", produto: "Produto para venda", servico: "Serviço" } as const;
const ROTULO_MOV = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste (novo saldo)" } as const;

export default async function ProdutoPage({ params }: PageProps<"/estoque/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: produto }, { data: fornecedores }, { data: movimentos }] = await Promise.all([
    supabase.from("produtos").select("*").eq("id", id).maybeSingle(),
    supabase.from("fornecedores").select("id, nome").order("nome"),
    supabase.from("movimentos_estoque").select("*").eq("produto_id", id).order("criado_em", { ascending: false }).limit(100),
  ]);
  if (!produto) notFound();

  const movimentar = (
    <JanelaBotao rotulo="Movimentar estoque" titulo="Movimentar estoque" descricao={`Saldo atual: ${Number(produto.estoque_atual)} ${produto.unidade_medida}`} icone="estoque" largura="xl">
      <form action={registrarMovimento.bind(null, id)} className="grid gap-3 md:grid-cols-12">
        <Campo rotulo="Tipo" className="md:col-span-3">
          <select name="movimento" className={inputCls}>
            {Object.entries(ROTULO_MOV).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Quantidade" className="md:col-span-2">
          <input name="quantidade" inputMode="decimal" required className={inputCls} />
        </Campo>
        <Campo rotulo="Custo unit. (R$)" className="md:col-span-2">
          <input name="custo_unitario" inputMode="decimal" className={inputCls} />
        </Campo>
        <Campo rotulo="Referência" className="md:col-span-3">
          <input name="referencia" placeholder="NF 123, pedido #10..." className={inputCls} />
        </Campo>
        <div className="flex items-end md:col-span-2"><Botao type="submit">Registrar</Botao></div>
      </form>
    </JanelaBotao>
  );

  return (
    <>
      <Titulo
        sub={[produto.codigo, ROTULO_TIPO[produto.tipo as keyof typeof ROTULO_TIPO]].filter(Boolean).join(" · ")}
        acao={
          <div className="flex flex-wrap gap-2">
            <JanelaBotao rotulo="Editar produto" titulo="Editar produto" descricao={produto.nome} variante="secundario" icone={null}>
              <FormProduto produto={produto} fornecedores={fornecedores ?? []} />
            </JanelaBotao>
            {produto.tipo !== "servico" && movimentar}
          </div>
        }
      >
        {produto.nome}
        {!produto.ativo && <Selo>inativo</Selo>}
      </Titulo>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {produto.tipo !== "servico" && <Indicador rotulo="Em estoque" valor={`${Number(produto.estoque_atual)} ${produto.unidade_medida}`} sub={`mínimo ${Number(produto.estoque_minimo)}`} cor={Number(produto.estoque_atual) <= Number(produto.estoque_minimo) ? "vermelho" : undefined} />}
        <Indicador rotulo="Custo" valor={brl(produto.custo)} />
        <Indicador rotulo="Preço de venda" valor={brl(produto.preco_venda)} />
        <Indicador rotulo="Fornecedor" valor={<span className="font-sans text-base">{fornecedores?.find((f) => f.id === produto.fornecedor_id)?.nome ?? "—"}</span>} />
      </div>

      {produto.tipo !== "servico" && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Movimentações</h2>
          <Tabela cabecalho={["Data", "Tipo", "Quantidade", "Custo unit.", "Referência"]} vazio={!movimentos?.length}>
            {movimentos?.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3">{data(m.criado_em)}</td>
                <td className="px-4 py-3">{ROTULO_MOV[m.tipo as keyof typeof ROTULO_MOV]}</td>
                <td className="px-4 py-3">{Number(m.quantidade)}</td>
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
