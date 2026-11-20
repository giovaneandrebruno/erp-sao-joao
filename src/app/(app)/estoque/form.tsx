import { Botao, Campo, inputCls } from "@/components/ui";
import { CATEGORIAS } from "@/lib/estoque";
import { salvarProduto } from "./actions";

type Produto = {
  id: string; codigo: string | null; nome: string; tipo: string; unidade_medida: string; custo: number; preco_venda: number;
  estoque_minimo: number; fornecedor_id: string | null; ativo: boolean;
  categoria?: string | null; local?: string | null; espessura_mm?: number | null; chapa_largura_mm?: number | null;
  chapa_altura_mm?: number | null; prazo_reposicao_dias?: number | null;
};

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

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
      <Campo rotulo="Categoria" className="md:col-span-2">
        <select name="categoria" defaultValue={produto?.categoria ?? "outro"} className={inputCls}>
          {Object.entries(CATEGORIAS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Unidade" className="md:col-span-1">
        <input name="unidade_medida" defaultValue={produto?.unidade_medida ?? "un"} placeholder="un, chapa, m, kg" className={inputCls} />
      </Campo>
      <Campo rotulo="Local no depósito" className="md:col-span-3">
        <input name="local" defaultValue={produto?.local ?? ""} placeholder="Prateleira A2, galpão, fundo..." className={inputCls} />
      </Campo>
      <Campo rotulo="Custo (R$)" className="md:col-span-1">
        <input name="custo" inputMode="decimal" defaultValue={produto ? num(produto.custo) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Preço de venda (R$)" className="md:col-span-1">
        <input name="preco_venda" inputMode="decimal" defaultValue={produto ? num(produto.preco_venda) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Estoque mínimo" className="md:col-span-1">
        <input name="estoque_minimo" inputMode="decimal" defaultValue={produto ? num(produto.estoque_minimo) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Prazo de reposição (dias)" className="md:col-span-1">
        <input name="prazo_reposicao_dias" inputMode="numeric" defaultValue={num(produto?.prazo_reposicao_dias)} className={inputCls} />
      </Campo>
      <Campo rotulo="Fornecedor principal" className="md:col-span-2">
        <select name="fornecedor_id" defaultValue={produto?.fornecedor_id ?? ""} className={inputCls}>
          <option value="">—</option>
          {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </Campo>
      <fieldset className="grid gap-4 rounded-xl border border-stone-200 p-4 md:col-span-6 md:grid-cols-3">
        <legend className="px-1 text-xs font-medium text-stone-600">Só para chapas (usado no cálculo de material)</legend>
        <Campo rotulo="Largura da chapa (mm)">
          <input name="chapa_largura_mm" inputMode="numeric" defaultValue={num(produto?.chapa_largura_mm)} placeholder="2750" className={inputCls} />
        </Campo>
        <Campo rotulo="Altura da chapa (mm)">
          <input name="chapa_altura_mm" inputMode="numeric" defaultValue={num(produto?.chapa_altura_mm)} placeholder="1850" className={inputCls} />
        </Campo>
        <Campo rotulo="Espessura (mm)">
          <input name="espessura_mm" inputMode="decimal" defaultValue={num(produto?.espessura_mm)} placeholder="18" className={inputCls} />
        </Campo>
      </fieldset>
      {produto && (
        <label className="flex items-center gap-2 text-sm md:col-span-6">
          <input type="checkbox" name="ativo" defaultChecked={produto.ativo} /> Ativo
        </label>
      )}
      <div className="md:col-span-6"><Botao type="submit">Salvar</Botao></div>
    </form>
  );
}
