import { Campo, inputCls } from "@/components/ui";
import { ROTULOS2 } from "@/lib/format";

type Orc = {
  unidade?: string | null;
  validade?: string | null;
  prazo_entrega_dias?: number | null;
  desconto?: number | string | null;
  condicoes_pagamento?: string | null;
  observacoes?: string | null;
  vendedor_id?: string | null;
  arquiteto_id?: string | null;
  comissao_vendedor_pct?: number | null;
  comissao_arquiteto_pct?: number | null;
  forma_pagamento?: string | null;
  parcelas?: number | null;
  taxa_pagamento_pct?: number | null;
  imposto_pct?: number | null;
};
type Pessoa = { id: string; nome: string; tipo: string };

export function CamposOrcamento({ o = {}, parceiros = [], novo = false }: { o?: Orc; parceiros?: Pessoa[]; novo?: boolean }) {
  const num = (v: number | string | null | undefined) => (v === null || v === undefined || (novo && Number(v) === 0) ? "" : String(v));
  return (
    <>
      <Campo rotulo="Unidade" className="md:col-span-2">
        <select name="unidade" defaultValue={o.unidade ?? "marcenaria"} className={inputCls}>
          <option value="marcenaria">Marcenaria</option>
          <option value="loja">Loja</option>
        </select>
      </Campo>
      <Campo rotulo="Válido até" className="md:col-span-2">
        <input name="validade" type="date" defaultValue={o.validade ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Prazo de entrega (dias)" className="md:col-span-2">
        <input name="prazo_entrega_dias" type="number" min={0} defaultValue={o.prazo_entrega_dias ?? ""} className={inputCls} />
      </Campo>

      <Campo rotulo="Vendedor" className="md:col-span-2">
        <select name="vendedor_id" defaultValue={o.vendedor_id ?? ""} className={inputCls}>
          <option value="">—</option>
          {parceiros.filter((p) => p.tipo === "vendedor").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Comissão vendedor (%)" className="md:col-span-1">
        <input name="comissao_vendedor_pct" inputMode="decimal" defaultValue={num(o.comissao_vendedor_pct)} className={inputCls} />
      </Campo>
      <Campo rotulo="Arquiteto (RT)" className="md:col-span-2">
        <select name="arquiteto_id" defaultValue={o.arquiteto_id ?? ""} className={inputCls}>
          <option value="">—</option>
          {parceiros.filter((p) => p.tipo === "arquiteto").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="RT (%)" className="md:col-span-1">
        <input name="comissao_arquiteto_pct" inputMode="decimal" defaultValue={num(o.comissao_arquiteto_pct)} className={inputCls} />
      </Campo>

      <Campo rotulo="Forma de pagamento" className="md:col-span-2">
        <select name="forma_pagamento" defaultValue={o.forma_pagamento ?? "pix"} className={inputCls}>
          {Object.entries(ROTULOS2.formaPagamento).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Parcelas" className="md:col-span-1">
        <input name="parcelas" type="number" min={1} defaultValue={o.parcelas ?? 1} className={inputCls} />
      </Campo>
      <Campo rotulo="Taxa da forma (%)" className="md:col-span-1">
        <input name="taxa_pagamento_pct" inputMode="decimal" placeholder="automática" defaultValue={novo ? "" : num(o.taxa_pagamento_pct)} className={inputCls} />
      </Campo>
      <Campo rotulo="Imposto (%)" className="md:col-span-1">
        <input name="imposto_pct" inputMode="decimal" placeholder="padrão" defaultValue={novo ? "" : num(o.imposto_pct)} className={inputCls} />
      </Campo>
      <Campo rotulo="Desconto (R$)" className="md:col-span-1">
        <input name="desconto" inputMode="decimal" defaultValue={o.desconto ? String(o.desconto) : ""} className={inputCls} />
      </Campo>

      <Campo rotulo="Condições de pagamento (texto para o cliente)" className="md:col-span-6">
        <input name="condicoes_pagamento" placeholder="Ex.: 30% de entrada e saldo em 6x no cartão" defaultValue={o.condicoes_pagamento ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Observações" className="md:col-span-6">
        <textarea name="observacoes" rows={2} defaultValue={o.observacoes ?? ""} className={inputCls} />
      </Campo>
    </>
  );
}
