"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numero, texto } from "@/lib/format";
import type { StatusCompra } from "@/lib/estoque";

type Supa = Awaited<ReturnType<typeof createClient>>;
type ItemNovo = { produto_id: string | null; descricao: string; quantidade: number; unidade: string; preco_unitario?: number; pedido_id?: string | null };

function atualizar(...extras: string[]) {
  for (const p of ["/compras", "/compras/requisicoes", "/compras/cotacoes", "/compras/pedidos", "/compras/recebimento", "/estoque", ...extras]) revalidatePath(p);
}

const valorBR = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\./g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Itens marcados num formulário: campos "q:<produto_id>" com a quantidade (só os marcados em "m:<produto_id>"). */
async function itensDaLista(supabase: Supa, form: FormData): Promise<ItemNovo[]> {
  const pedidos: { id: string; quantidade: number }[] = [];
  for (const [k] of form.entries()) {
    if (!k.startsWith("m:")) continue;
    const id = k.slice(2);
    const q = valorBR(form.get(`q:${id}`));
    if (q && q > 0) pedidos.push({ id, quantidade: q });
  }
  if (!pedidos.length) return [];
  const { data } = await supabase.from("produtos").select("id, nome, unidade_medida, custo").in("id", pedidos.map((p) => p.id));
  return pedidos.flatMap((p) => {
    const prod = data?.find((x) => x.id === p.id);
    return prod ? [{ produto_id: prod.id, descricao: prod.nome, quantidade: p.quantidade, unidade: prod.unidade_medida, preco_unitario: Number(prod.custo) }] : [];
  });
}

async function novaCompra(supabase: Supa, fornecedorId: string, itens: ItemNovo[], extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.from("compras").insert({ fornecedor_id: fornecedorId, ...extra }).select("id").single();
  if (error) throw new Error(error.message);
  if (itens.length) {
    const { error: e2 } = await supabase.from("compra_itens").insert(itens.map((i, ordem) => ({ ...i, compra_id: data.id, ordem, preco_unitario: i.preco_unitario ?? 0, pedido_id: i.pedido_id ?? (extra.pedido_id as string | undefined) ?? null })));
    if (e2) throw new Error(e2.message);
  }
  return data.id as string;
}

async function novaCotacao(supabase: Supa, titulo: string, itens: ItemNovo[], fornecedores: string[] = []) {
  const { data, error } = await supabase.from("cotacoes").insert({ titulo }).select("id").single();
  if (error) throw new Error(error.message);
  if (itens.length) {
    const { error: e2 } = await supabase.from("cotacao_itens").insert(itens.map((i, ordem) => ({ cotacao_id: data.id, produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade, pedido_id: i.pedido_id ?? null, ordem })));
    if (e2) throw new Error(e2.message);
  }
  const unicos = [...new Set(fornecedores.filter(Boolean))];
  if (unicos.length) {
    const { error: e3 } = await supabase.from("cotacao_fornecedores").insert(unicos.map((f) => ({ cotacao_id: data.id, fornecedor_id: f })));
    if (e3) throw new Error(e3.message);
  }
  return data.id as string;
}

// ───────────────────────── O que comprar ─────────────────────────

/** Gera um pedido de compra (rascunho) com os itens marcados de um fornecedor. */
export async function compraDaLista(fornecedorId: string, form: FormData) {
  const supabase = await createClient();
  const itens = await itensDaLista(supabase, form);
  if (!itens.length) throw new Error("Marque pelo menos um item.");
  const id = await novaCompra(supabase, fornecedorId, itens);
  atualizar();
  redirect(`/compras/pedidos/${id}`);
}

/** Abre uma cotação com os itens marcados, já convidando o fornecedor principal de cada um. */
export async function cotacaoDaLista(form: FormData) {
  const supabase = await createClient();
  const itens = await itensDaLista(supabase, form);
  if (!itens.length) throw new Error("Marque pelo menos um item.");
  const { data: prods } = await supabase.from("produtos").select("fornecedor_id").in("id", itens.map((i) => i.produto_id!));
  const id = await novaCotacao(supabase, texto(form, "titulo") ?? "Reposição de estoque", itens, (prods ?? []).map((p) => p.fornecedor_id as string));
  atualizar();
  redirect(`/compras/cotacoes/${id}`);
}

// ───────────────────────── Requisições ─────────────────────────

export async function salvarRequisicao(form: FormData) {
  const supabase = await createClient();
  const produtoId = texto(form, "produto_id");
  let descricao = texto(form, "descricao");
  let unidade = texto(form, "unidade") ?? "un";
  if (produtoId) {
    const { data: p } = await supabase.from("produtos").select("nome, unidade_medida").eq("id", produtoId).maybeSingle();
    descricao = descricao ?? p?.nome ?? null;
    unidade = texto(form, "unidade") ?? p?.unidade_medida ?? "un";
  }
  const quantidade = numero(form, "quantidade") ?? 0;
  if (!descricao || quantidade <= 0) throw new Error("Informe o material e a quantidade.");
  const { error } = await supabase.from("requisicoes_compra").insert({
    produto_id: produtoId,
    descricao,
    quantidade,
    unidade,
    pedido_id: texto(form, "pedido_id"),
    necessario_em: texto(form, "necessario_em"),
    urgente: form.get("urgente") !== null,
    solicitante: texto(form, "solicitante"),
    observacoes: texto(form, "observacoes"),
  });
  if (error) throw new Error(error.message);
  atualizar();
}

export async function cancelarRequisicao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("requisicoes_compra").update({ status: "cancelada" }).eq("id", id).in("status", ["aberta", "em_cotacao"]);
  if (error) throw new Error(error.message);
  atualizar();
}

async function requisicoesMarcadas(supabase: Supa, form: FormData) {
  const ids = [...form.keys()].filter((k) => k.startsWith("r:")).map((k) => k.slice(2));
  if (!ids.length) throw new Error("Marque pelo menos uma requisição.");
  const { data, error } = await supabase.from("requisicoes_compra").select("id, produto_id, descricao, quantidade, unidade, pedido_id, produto:produto_id(custo, fornecedor_id)").in("id", ids).eq("status", "aberta");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("As requisições marcadas já estão em cotação ou compradas.");
  return data as unknown as { id: string; produto_id: string | null; descricao: string; quantidade: number; unidade: string; pedido_id: string | null; produto: { custo: number; fornecedor_id: string | null } | null }[];
}

/** Junta as requisições marcadas numa cotação. */
export async function cotacaoDasRequisicoes(form: FormData) {
  const supabase = await createClient();
  const reqs = await requisicoesMarcadas(supabase, form);
  const id = await novaCotacao(
    supabase,
    texto(form, "titulo") ?? `Requisições ${reqs.map((r) => r.descricao).slice(0, 2).join(", ")}${reqs.length > 2 ? "..." : ""}`,
    reqs.map((r) => ({ produto_id: r.produto_id, descricao: r.descricao, quantidade: Number(r.quantidade), unidade: r.unidade, pedido_id: r.pedido_id })),
    reqs.map((r) => r.produto?.fornecedor_id ?? ""),
  );
  await supabase.from("requisicoes_compra").update({ status: "em_cotacao", cotacao_id: id }).in("id", reqs.map((r) => r.id));
  atualizar();
  redirect(`/compras/cotacoes/${id}`);
}

/** Transforma as requisições marcadas num pedido de compra para o fornecedor escolhido. */
export async function compraDasRequisicoes(form: FormData) {
  const fornecedor = texto(form, "fornecedor_id");
  if (!fornecedor) throw new Error("Escolha o fornecedor.");
  const supabase = await createClient();
  const reqs = await requisicoesMarcadas(supabase, form);
  const pedidos = [...new Set(reqs.map((r) => r.pedido_id).filter(Boolean))];
  const id = await novaCompra(
    supabase,
    fornecedor,
    reqs.map((r) => ({ produto_id: r.produto_id, descricao: r.descricao, quantidade: Number(r.quantidade), unidade: r.unidade, preco_unitario: Number(r.produto?.custo ?? 0), pedido_id: r.pedido_id })),
    pedidos.length === 1 ? { pedido_id: pedidos[0] } : {},
  );
  await supabase.from("requisicoes_compra").update({ status: "comprada", compra_id: id }).in("id", reqs.map((r) => r.id));
  atualizar();
  redirect(`/compras/pedidos/${id}`);
}

// ───────────────────────── Cotações ─────────────────────────

export async function criarCotacao(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cotacoes")
    .insert({ titulo: texto(form, "titulo") ?? "Cotação", responder_ate: texto(form, "responder_ate"), observacoes: texto(form, "observacoes") })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  atualizar();
  redirect(`/compras/cotacoes/${data.id}`);
}

export async function adicionarItemCotacao(cotacaoId: string, form: FormData) {
  const supabase = await createClient();
  const produtoId = texto(form, "produto_id");
  let descricao = texto(form, "descricao");
  let unidade = texto(form, "unidade");
  if (produtoId) {
    const { data: p } = await supabase.from("produtos").select("nome, unidade_medida").eq("id", produtoId).maybeSingle();
    descricao = descricao ?? p?.nome ?? null;
    unidade = unidade ?? p?.unidade_medida ?? null;
  }
  const quantidade = numero(form, "quantidade") ?? 0;
  if (!descricao || quantidade <= 0) throw new Error("Informe o material e a quantidade.");
  const { error } = await supabase.from("cotacao_itens").insert({ cotacao_id: cotacaoId, produto_id: produtoId, descricao, quantidade, unidade: unidade ?? "un", pedido_id: texto(form, "pedido_id"), ordem: 999 });
  if (error) throw new Error(error.message);
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

export async function removerItemCotacao(cotacaoId: string, itemId: string): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("cotacao_itens").delete().eq("id", itemId).eq("cotacao_id", cotacaoId);
  if (error) return `Não foi possível tirar: ${error.message}`;
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  return null;
}

export async function adicionarFornecedorCotacao(cotacaoId: string, form: FormData) {
  const fornecedor = texto(form, "fornecedor_id");
  if (!fornecedor) throw new Error("Escolha o fornecedor.");
  const supabase = await createClient();
  const { error } = await supabase.from("cotacao_fornecedores").upsert({ cotacao_id: cotacaoId, fornecedor_id: fornecedor }, { onConflict: "cotacao_id,fornecedor_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

export async function removerFornecedorCotacao(cotacaoId: string, fornecedorId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: itens } = await supabase.from("cotacao_itens").select("id").eq("cotacao_id", cotacaoId);
  if (itens?.length) await supabase.from("cotacao_precos").delete().eq("fornecedor_id", fornecedorId).in("cotacao_item_id", itens.map((i) => i.id));
  const { error } = await supabase.from("cotacao_fornecedores").delete().eq("cotacao_id", cotacaoId).eq("fornecedor_id", fornecedorId);
  if (error) return `Não foi possível tirar: ${error.message}`;
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
  return null;
}

/**
 * Grava as respostas dos fornecedores: preço de cada item ("p:<item>:<fornecedor>")
 * e prazo, frete e condição de pagamento de cada fornecedor ("prazo:<fornecedor>"...).
 */
export async function salvarRespostas(cotacaoId: string, form: FormData) {
  const supabase = await createClient();
  const [{ data: itens }, { data: forns }] = await Promise.all([
    supabase.from("cotacao_itens").select("id").eq("cotacao_id", cotacaoId),
    supabase.from("cotacao_fornecedores").select("id, fornecedor_id").eq("cotacao_id", cotacaoId),
  ]);
  const idsItens = new Set((itens ?? []).map((i) => i.id));
  const gravar: { cotacao_item_id: string; fornecedor_id: string; preco_unitario: number }[] = [];
  const apagar: { item: string; fornecedor: string }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("p:")) continue;
    const [, item, fornecedor] = k.split(":");
    if (!idsItens.has(item) || !forns?.some((f) => f.fornecedor_id === fornecedor)) continue;
    const preco = valorBR(v);
    if (preco === null) apagar.push({ item, fornecedor });
    else if (preco >= 0) gravar.push({ cotacao_item_id: item, fornecedor_id: fornecedor, preco_unitario: preco });
  }
  if (gravar.length) {
    const { error } = await supabase.from("cotacao_precos").upsert(gravar, { onConflict: "cotacao_item_id,fornecedor_id" });
    if (error) throw new Error(error.message);
  }
  for (const a of apagar) await supabase.from("cotacao_precos").delete().eq("cotacao_item_id", a.item).eq("fornecedor_id", a.fornecedor);
  for (const f of forns ?? []) {
    const prazo = valorBR(form.get(`prazo:${f.fornecedor_id}`));
    await supabase.from("cotacao_fornecedores").update({
      prazo_entrega_dias: prazo === null ? null : Math.max(0, Math.round(prazo)),
      frete: Math.max(0, valorBR(form.get(`frete:${f.fornecedor_id}`)) ?? 0),
      condicao_pagamento: String(form.get(`cond:${f.fornecedor_id}`) ?? "").trim() || null,
    }).eq("id", f.id);
  }
  revalidatePath(`/compras/cotacoes/${cotacaoId}`);
}

/**
 * Fecha a cotação gerando os pedidos de compra.
 * "melhor": cada item vai para o fornecedor com o menor preço (pode gerar mais de um pedido).
 * Um id de fornecedor: tudo com ele.
 */
export async function fecharCotacao(cotacaoId: string, escolha: string, form?: FormData) {
  if (form) await salvarRespostas(cotacaoId, form);
  const supabase = await createClient();
  const [{ data: cot }, { data: itens }, { data: forns }] = await Promise.all([
    supabase.from("cotacoes").select("id, numero, status").eq("id", cotacaoId).single(),
    supabase.from("cotacao_itens").select("id, produto_id, descricao, quantidade, unidade, pedido_id, precos:cotacao_precos(fornecedor_id, preco_unitario)").eq("cotacao_id", cotacaoId).order("ordem"),
    supabase.from("cotacao_fornecedores").select("fornecedor_id, prazo_entrega_dias, condicao_pagamento, frete").eq("cotacao_id", cotacaoId),
  ]);
  if (!cot || cot.status !== "aberta") throw new Error("Esta cotação não está aberta.");
  type It = { id: string; produto_id: string | null; descricao: string; quantidade: number; unidade: string; pedido_id: string | null; precos: { fornecedor_id: string; preco_unitario: number }[] };
  const porFornecedor = new Map<string, ItemNovo[]>();
  for (const i of (itens ?? []) as It[]) {
    const preco = escolha === "melhor"
      ? [...i.precos].sort((a, b) => Number(a.preco_unitario) - Number(b.preco_unitario))[0]
      : i.precos.find((p) => p.fornecedor_id === escolha) ?? { fornecedor_id: escolha, preco_unitario: 0 };
    if (!preco) continue;
    porFornecedor.set(preco.fornecedor_id, [...(porFornecedor.get(preco.fornecedor_id) ?? []), { produto_id: i.produto_id, descricao: i.descricao, quantidade: Number(i.quantidade), unidade: i.unidade, preco_unitario: Number(preco.preco_unitario), pedido_id: i.pedido_id }]);
  }
  if (!porFornecedor.size) throw new Error("Preencha os preços dos fornecedores antes de fechar.");
  const criadas: string[] = [];
  for (const [fornecedor, lista] of porFornecedor) {
    const f = forns?.find((x) => x.fornecedor_id === fornecedor);
    const previsao = f?.prazo_entrega_dias != null ? new Date(Date.now() + f.prazo_entrega_dias * 864e5).toISOString().slice(0, 10) : null;
    criadas.push(await novaCompra(supabase, fornecedor, lista, {
      cotacao_id: cotacaoId,
      condicao_pagamento: f?.condicao_pagamento ?? null,
      frete: Number(f?.frete ?? 0),
      previsao_entrega: previsao,
      observacoes: `Gerado da cotação #${cot.numero}`,
    }));
  }
  await supabase.from("cotacoes").update({ status: "fechada" }).eq("id", cotacaoId);
  await supabase.from("requisicoes_compra").update({ status: "comprada", compra_id: criadas[0] }).eq("cotacao_id", cotacaoId).eq("status", "em_cotacao");
  atualizar(`/compras/cotacoes/${cotacaoId}`);
  redirect(criadas.length === 1 ? `/compras/pedidos/${criadas[0]}` : "/compras/pedidos");
}

export async function cancelarCotacao(cotacaoId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("cotacoes").update({ status: "cancelada" }).eq("id", cotacaoId).eq("status", "aberta");
  if (error) throw new Error(error.message);
  await supabase.from("requisicoes_compra").update({ status: "aberta", cotacao_id: null }).eq("cotacao_id", cotacaoId).eq("status", "em_cotacao");
  atualizar(`/compras/cotacoes/${cotacaoId}`);
}

// ───────────────────────── Pedidos de compra ─────────────────────────

export async function criarCompra(form: FormData) {
  const fornecedor = texto(form, "fornecedor_id");
  if (!fornecedor) throw new Error("Escolha o fornecedor.");
  const supabase = await createClient();
  const id = await novaCompra(supabase, fornecedor, [], {
    previsao_entrega: texto(form, "previsao_entrega"),
    condicao_pagamento: texto(form, "condicao_pagamento"),
    pedido_id: texto(form, "pedido_id"),
    observacoes: texto(form, "observacoes"),
  });
  atualizar();
  redirect(`/compras/pedidos/${id}`);
}

export async function salvarCompra(compraId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("compras").update({
    previsao_entrega: texto(form, "previsao_entrega"),
    condicao_pagamento: texto(form, "condicao_pagamento"),
    frete: Math.max(0, numero(form, "frete") ?? 0),
    desconto: Math.max(0, numero(form, "desconto") ?? 0),
    pedido_id: texto(form, "pedido_id"),
    observacoes: texto(form, "observacoes"),
  }).eq("id", compraId);
  if (error) throw new Error(error.message);
  atualizar(`/compras/pedidos/${compraId}`);
}

export async function adicionarItemCompra(compraId: string, form: FormData) {
  const supabase = await createClient();
  const produtoId = texto(form, "produto_id");
  let descricao = texto(form, "descricao");
  let unidade = texto(form, "unidade");
  let preco = numero(form, "preco_unitario");
  if (produtoId) {
    const { data: p } = await supabase.from("produtos").select("nome, unidade_medida, custo").eq("id", produtoId).maybeSingle();
    descricao = descricao ?? p?.nome ?? null;
    unidade = unidade ?? p?.unidade_medida ?? null;
    preco = preco ?? Number(p?.custo ?? 0);
  }
  const quantidade = numero(form, "quantidade") ?? 0;
  if (!descricao || quantidade <= 0) throw new Error("Informe o material e a quantidade.");
  const { error } = await supabase.from("compra_itens").insert({ compra_id: compraId, produto_id: produtoId, descricao, quantidade, unidade: unidade ?? "un", preco_unitario: Math.max(0, preco ?? 0), pedido_id: texto(form, "pedido_id"), ordem: 999 });
  if (error) throw new Error(error.message);
  atualizar(`/compras/pedidos/${compraId}`);
}

/** Tira o item só se nada dele foi recebido ainda. */
export async function removerItemCompra(compraId: string, itemId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("compra_itens").delete().eq("id", itemId).eq("compra_id", compraId).eq("recebido", 0).select("id");
  if (error) return `Não foi possível tirar: ${error.message}`;
  if (!data?.length) return "Parte deste item já foi recebida e entrou no estoque. Ele fica no pedido para não perder o histórico.";
  atualizar(`/compras/pedidos/${compraId}`);
  return null;
}

export async function mudarStatusCompra(compraId: string, status: StatusCompra) {
  if (!["rascunho", "enviado", "cancelado"].includes(status)) throw new Error("Situação inválida.");
  const supabase = await createClient();
  const permitido = status === "cancelado" ? ["rascunho", "enviado", "parcial"] : status === "enviado" ? ["rascunho"] : ["enviado"];
  const { error } = await supabase.from("compras").update({ status, ...(status === "enviado" ? { emitido_em: new Date().toISOString().slice(0, 10) } : {}) }).eq("id", compraId).in("status", permitido);
  if (error) throw new Error(error.message);
  atualizar(`/compras/pedidos/${compraId}`);
}

/** Recebe o material: confere as quantidades, dá entrada no estoque e (opcional) lança a conta a pagar. */
export async function receberCompra(compraId: string, form: FormData) {
  const itens: { item: string; quantidade: number }[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("r:")) continue;
    const q = valorBR(v);
    if (q && q > 0) itens.push({ item: k.slice(2), quantidade: q });
  }
  if (!itens.length) throw new Error("Informe a quantidade recebida de pelo menos um item.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("receber_compra", {
    p_compra: compraId,
    p_itens: itens,
    p_data: texto(form, "recebido_em") ?? new Date().toISOString().slice(0, 10),
    p_nota: texto(form, "nota_fiscal"),
    p_conferido: texto(form, "conferido_por"),
    p_obs: texto(form, "observacoes"),
    p_vencimento: form.get("lancar") !== null ? texto(form, "vencimento") : null,
  });
  if (error) throw new Error(error.message);
  atualizar(`/compras/pedidos/${compraId}`, "/estoque/movimentos", "/estoque/consumo", "/financeiro");
}

/** Marca (ou desmarca) para qual pedido/cliente o item foi comprado. Só registro: não reserva o material. */
export async function marcarClienteDoItem(compraId: string, itemId: string, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("compra_itens").update({ pedido_id: texto(form, "pedido_id") }).eq("id", itemId).eq("compra_id", compraId);
  if (error) throw new Error(error.message);
  atualizar(`/compras/pedidos/${compraId}`, "/estoque/consumo");
}
