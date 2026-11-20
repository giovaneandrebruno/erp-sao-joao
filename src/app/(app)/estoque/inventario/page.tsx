import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { dataHora } from "@/lib/format";
import { CATEGORIAS, COR_INVENTARIO, STATUS_INVENTARIO, type Categoria, type StatusInventario } from "@/lib/estoque";
import { abrirInventario } from "./actions";

/** Inventários: contagem física do estoque, por categoria ou geral, que corrige o saldo do sistema. */
export default async function InventarioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventarios")
    .select("id, numero, descricao, categoria, status, criado_em, concluido_em, itens:inventario_itens(contado, saldo_sistema)")
    .order("criado_em", { ascending: false })
    .limit(100);
  type Inv = { id: string; numero: number; descricao: string; categoria: Categoria | null; status: StatusInventario; criado_em: string; concluido_em: string | null; itens: { contado: number | null; saldo_sistema: number }[] };
  const lista = (data ?? []) as Inv[];

  const novo = (
    <JanelaBotao rotulo="Novo inventário" titulo="Novo inventário" descricao="O sistema guarda o saldo de agora e você digita o que contou no depósito." aviso={null}>
      <form action={abrirInventario} className="grid gap-4 md:grid-cols-2">
        <Campo rotulo="Nome da contagem" className="md:col-span-2">
          <input name="descricao" placeholder="Contagem de fim de mês, chapas do galpão..." className={inputCls} />
        </Campo>
        <Campo rotulo="O que contar" className="md:col-span-2">
          <select name="categoria" className={inputCls}>
            <option value="">Todo o estoque</option>
            {Object.entries(CATEGORIAS).map(([k, r]) => <option key={k} value={k}>Só {r.toLowerCase()}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observações" className="md:col-span-2"><textarea name="observacoes" rows={2} className={inputCls} /></Campo>
        <div className="md:col-span-2"><Botao type="submit">Abrir contagem</Botao></div>
      </form>
    </JanelaBotao>
  );

  return (
    <>
      <Titulo sub="Conte o que tem no depósito e o sistema corrige o saldo. Faça uma vez por mês, ou por categoria (só chapas, só ferragens) quando quiser." acao={novo}>
        Inventário
      </Titulo>
      <Tabela cabecalho={["Nº", "Contagem", "O que contar", "Itens contados", "Diferenças", "Aberto em", "Situação"]} vazio={!lista.length}>
        {lista.map((i) => {
          const contados = i.itens.filter((x) => x.contado !== null);
          const diferencas = contados.filter((x) => Number(x.contado) !== Number(x.saldo_sistema)).length;
          return (
            <tr key={i.id}>
              <td className="px-4 py-3">#{i.numero}</td>
              <td className="px-4 py-3"><Link href={`/estoque/inventario/${i.id}`} className="font-medium text-madeira-800 hover:underline">{i.descricao}</Link></td>
              <td className="px-4 py-3">{i.categoria ? CATEGORIAS[i.categoria] : "Todo o estoque"}</td>
              <td className="px-4 py-3">{contados.length} de {i.itens.length}</td>
              <td className="px-4 py-3">{diferencas || "—"}</td>
              <td className="px-4 py-3">{dataHora(i.criado_em)}</td>
              <td className="px-4 py-3"><Selo cor={COR_INVENTARIO[i.status]}>{STATUS_INVENTARIO[i.status]}</Selo></td>
            </tr>
          );
        })}
      </Tabela>
    </>
  );
}
