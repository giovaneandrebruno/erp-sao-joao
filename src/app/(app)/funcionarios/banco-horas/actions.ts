"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { texto } from "@/lib/format";
import { exigirAdmin } from "@/lib/perfil";
import { minutosDoTexto } from "@/lib/banco-horas";

/** Data de início do banco de horas e saldo que a pessoa já tinha antes (ex.: "-3h30"). */
export async function salvarBancoHoras(funcionarioId: string, form: FormData) {
  await exigirAdmin();
  const inicio = texto(form, "banco_horas_inicio");
  const saldo = minutosDoTexto(texto(form, "saldo_inicial"));
  if (saldo === null) throw new Error("Saldo inicial inválido. Escreva assim: 5h30 ou -2h15.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("funcionarios")
    .update({ banco_horas_inicio: inicio && /^\d{4}-\d{2}-\d{2}$/.test(inicio) ? inicio : null, banco_horas_saldo_inicial: saldo })
    .eq("id", funcionarioId);
  if (error) throw new Error(error.message);
  revalidatePath("/funcionarios/banco-horas");
}
