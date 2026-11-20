"use client";

import { inputCls } from "@/components/ui";
import { avisar } from "@/components/acoes";

/** Escolha do cliente (pedido) de um item da compra: grava ao trocar. */
export function ClienteDoItem({ acao, valor, pedidos }: { acao: (form: FormData) => Promise<void>; valor: string; pedidos: { id: string; rotulo: string }[] }) {
  return (
    <form action={async (f) => { await acao(f); avisar("Cliente do item salvo"); }}>
      <select
        name="pedido_id"
        defaultValue={valor}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Para qual cliente"
        className={`${inputCls} w-52 py-1.5`}
      >
        <option value="">Estoque (sem cliente)</option>
        {pedidos.map((p) => <option key={p.id} value={p.id}>{p.rotulo}</option>)}
      </select>
    </form>
  );
}
