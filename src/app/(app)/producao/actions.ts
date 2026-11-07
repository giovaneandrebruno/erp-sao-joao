"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ETAPAS } from "@/lib/format";

export async function moverEtapa(id: string, direcao: 1 | -1) {
  const supabase = await createClient();
  const { data: op, error: e1 } = await supabase.from("ordens_producao").select("etapa, pedido_id").eq("id", id).single();
  if (e1) throw new Error(e1.message);
  const atual = ETAPAS.indexOf(op.etapa);
  const nova = ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, atual + direcao))];
  const { error } = await supabase.from("ordens_producao").update({ etapa: nova }).eq("id", id);
  if (error) throw new Error(error.message);

  // Quando todas as OPs do pedido ficam prontas, o pedido passa para "pronto".
  if (op.pedido_id && (nova === "pronto" || nova === "instalacao" || nova === "concluido")) {
    const { data: ops } = await supabase.from("ordens_producao").select("etapa").eq("pedido_id", op.pedido_id);
    const posPronto = ETAPAS.indexOf("pronto");
    if (ops?.every((o) => ETAPAS.indexOf(o.etapa) >= posPronto)) {
      await supabase.from("pedidos").update({ status: "pronto" }).eq("id", op.pedido_id).eq("status", "em_producao");
    }
  }
  revalidatePath("/producao");
  if (op.pedido_id) revalidatePath(`/pedidos/${op.pedido_id}`);
}
