import { Campo, inputCls } from "@/components/ui";

type Orc = {
  unidade?: string | null;
  validade?: string | null;
  prazo_entrega_dias?: number | null;
  desconto?: number | string | null;
  condicoes_pagamento?: string | null;
  observacoes?: string | null;
};

export function CamposOrcamento({ o = {} }: { o?: Orc }) {
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
      <Campo rotulo="Desconto (R$)" className="md:col-span-2">
        <input name="desconto" inputMode="decimal" defaultValue={o.desconto ? String(o.desconto) : ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Condições de pagamento" className="md:col-span-4">
        <input name="condicoes_pagamento" placeholder="Ex.: 50% de entrada e 50% na entrega" defaultValue={o.condicoes_pagamento ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Observações" className="md:col-span-6">
        <textarea name="observacoes" rows={2} defaultValue={o.observacoes ?? ""} className={inputCls} />
      </Campo>
    </>
  );
}
