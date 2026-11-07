import { Botao, Campo, inputCls } from "@/components/ui";
import { salvarProduto } from "./actions";

type Produto = { id: string; codigo: string | null; nome: string; tipo: string; unidade_medida: string; custo: number; preco_venda: number; estoque_minimo: number; fornecedor_id: string | null; ativo: boolean };

export function FormProduto({ produto, fornecedores }: { produto?: Produto; fornecedores: { id: string; nome: string }[] }) {
  return (
    <form action={salvarProduto.bind(null, produto?.id ?? null)} className="grid gap-4 md:grid-cols-6">
      <Campo rotulo="Código" className="md:col-span-1">
        <input name="codigo" defaultValue={produto?.codigo ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Nome *" className="md:col-span-3">
        <input name="nome" required defaultValue={produto?.nome ?? ""} placeholder="MDF branco 18mm" className={inputCls} />
      </Campo>
      <Campo rotulo="Tipo" className="md:col-span-2">
        <select name="tipo" defaultValue={produto?.tipo ?? "materia_prima"} className={inputCls}>
          <option value="materia_prima">Matéria-prima (chapas, ferragens...)</option>
          <option value="produto">Produto para venda</option>
          <option value="servico">Serviço (montagem, frete...)</option>
        </select>
      </Campo>
      <Campo rotulo="Unidade" className="md:col-span-1">
        <input name="unidade_medida" defaultValue={produto?.unidade_medida ?? "un"} placeholder="un, chapa, m, kg" className={inputCls} />
      </Campo>
      <Campo rotulo="Custo (R$)" className="md:col-span-1">
        <input name="custo" inputMode="decimal" defaultValue={produto ? String(produto.custo) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Preço de venda (R$)" className="md:col-span-1">
        <input name="preco_venda" inputMode="decimal" defaultValue={produto ? String(produto.preco_venda) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Estoque mínimo" className="md:col-span-1">
        <input name="estoque_minimo" inputMode="decimal" defaultValue={produto ? String(produto.estoque_minimo) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Fornecedor" className="md:col-span-2">
        <select name="fornecedor_id" defaultValue={produto?.fornecedor_id ?? ""} className={inputCls}>
          <option value="">—</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </Campo>
      {produto && (
        <label className="flex items-center gap-2 text-sm md:col-span-6">
          <input type="checkbox" name="ativo" defaultChecked={produto.ativo} /> Ativo
        </label>
      )}
      <div className="md:col-span-6"><Botao type="submit">Salvar</Botao></div>
    </form>
  );
}
