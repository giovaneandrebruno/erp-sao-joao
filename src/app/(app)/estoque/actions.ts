"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";

const inteiro = (n: number | null) => (n === null || n <= 0 ? null : Math.round(n));

export async function salvarProduto(id: string | null, form: FormData) {
  const supabase = await createClient();
  const registro = {
    codigo: texto(form, "codigo"),
    nome: texto(form, "nome") ?? "",
    tipo: (texto(form, "tipo") ?? "materia_prima") as "materia_prima" | "produto" | "servico",
    unidade_medida: texto(form, "unidade_medida") ?? "un",
    custo: numero(form, "custo") ?? 0,
    preco_venda: numero(form, "preco_venda") ?? 0,
    estoque_minimo: numero(form, "estoque_minimo") ?? 0,
    fornecedor_id: texto(form, "fornecedor_id"),
    categoria: texto(form, "categoria") ?? "outro",
    local: texto(form, "local"),
    espessura_mm: numero(form, "espessura_mm"),
    chapa_largura_mm: inteiro(numero(form, "chapa_largura_mm")),
    chapa_altura_mm: inteiro(numero(form, "chapa_altura_mm")),
    prazo_reposicao_dias: inteiro(numero(form, "prazo_reposicao_dias")),
    ativo: form.get("ativo") !== null || !id,
  };
  const { data, error } = id
    ? await supabase.from("produtos").update(registro).eq("id", id).select("id").single()
    : await supabase.from("produtos").insert(registro).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/estoque");
  redirect(`/estoque/${data.id}`);
}

export async function registrarMovimento(produtoId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("movimentos_estoque").insert({
    produto_id: produtoId,
    tipo: (texto(form, "movimento") ?? "entrada") as "entrada" | "saida" | "ajuste",
    quantidade: numero(form, "quantidade") ?? 0,
    custo_unitario: numero(form, "custo_unitario"),
    referencia: texto(form, "referencia"),
    origem: (["perda", "devolucao"].includes(texto(form, "origem") ?? "") ? texto(form, "origem") : "manual") as "manual" | "perda" | "devolucao",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/estoque/${produtoId}`);
  revalidatePath("/estoque");
  revalidatePath("/estoque/movimentos");
}

/**
 * Exclui o produto só se ele nunca foi usado (orçamentos, pedidos ou movimentações de estoque).
 * Se já foi usado, o caminho é desmarcar "Ativo" no cadastro.
 */
export async function excluirProduto(id: string): Promise<string | null> {
  const supabase = await createClient();
  const tabelas = ["orcamento_itens", "pedido_itens", "movimentos_estoque"] as const;
  const usos = await Promise.all(
    tabelas.map(async (t) => (await supabase.from(t).select("id", { count: "exact", head: true }).eq("produto_id", id)).count ?? 0),
  );
  if (usos.some((n) => n > 0)) {
    return "Este produto já aparece em orçamentos, pedidos ou movimentações de estoque. Para não perder o histórico, abra \"Editar produto\" e desmarque \"Ativo\".";
  }
  const { error } = await supabase.from("produtos").delete().eq("id", id);
  if (error) return `Não foi possível excluir: ${error.message}`;
  revalidatePath("/estoque");
  return null;
}
