import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { data } from "@/lib/format";
import { COR_COTACAO, STATUS_COTACAO, type StatusCotacao } from "@/lib/estoque";
import { criarCotacao } from "../actions";

/** Cotações: o mesmo pedido de preço para vários fornecedores, lado a lado. */
export default async function CotacoesPage() {
  const supabase = await createClient();
  const { data: cotacoes } = await supabase
    .from("cotacoes")
    .select("id, numero, titulo, status, responder_ate, criado_em, itens:cotacao_itens(id), fornecedores:cotacao_fornecedores(id), compras(id)")
    .order("criado_em", { ascending: false })
    .limit(200);
  type Cot = { id: string; numero: number; titulo: string; status: StatusCotacao; responder_ate: string | null; criado_em: string; itens: { id: string }[]; fornecedores: { id: string }[]; compras: { id: string }[] };
  const lista = (cotacoes ?? []) as unknown as Cot[];

  const nova = (
    <JanelaBotao rotulo="Nova cotação" titulo="Nova cotação" descricao="Depois você inclui os itens e os fornecedores." aviso={null}>
      <form action={criarCotacao} className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Título *" className="md:col-span-2"><input name="titulo" required placeholder="Chapas do mês, ferragens pedido #12..." className={inputCls} /></Campo>
        <Campo rotulo="Responder até"><input type="date" name="responder_ate" className={inputCls} /></Campo>
        <Campo rotulo="Observações" className="md:col-span-2"><textarea name="observacoes" rows={2} className={inputCls} /></Campo>
        <div className="md:col-span-2"><Botao type="submit">Criar cotação</Botao></div>
      </form>
    </JanelaBotao>
  );

  return (
    <>
      <Titulo sub="Peça preço do mesmo material para vários fornecedores e compare preço, frete e prazo. Ao fechar, o sistema gera os pedidos de compra." acao={nova}>
        Cotações
      </Titulo>
      <Tabela cabecalho={["Nº", "Cotação", "Itens", "Fornecedores", "Responder até", "Criada em", "Situação"]} vazio={!lista.length}>
        {lista.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3">#{c.numero}</td>
            <td className="px-4 py-3"><Link href={`/compras/cotacoes/${c.id}`} className="font-medium text-madeira-800 hover:underline">{c.titulo}</Link></td>
            <td className="px-4 py-3">{c.itens.length}</td>
            <td className="px-4 py-3">{c.fornecedores.length}</td>
            <td className="px-4 py-3">{data(c.responder_ate)}</td>
            <td className="px-4 py-3">{data(c.criado_em)}</td>
            <td className="px-4 py-3"><Selo cor={COR_COTACAO[c.status]}>{STATUS_COTACAO[c.status]}</Selo>{c.compras.length > 0 && <span className="ml-2 text-xs text-stone-500">{c.compras.length} pedido(s)</span>}</td>
          </tr>
        ))}
      </Tabela>
    </>
  );
}
