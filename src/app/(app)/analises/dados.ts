/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { somarMeses } from "@/lib/analise";
import type { Brutos } from "./calculo";

type Cliente = Awaited<ReturnType<typeof createClient>>;
type Unidade = "marcenaria" | "loja" | null;

/** Busca todas as linhas, de 1000 em 1000 (limite por consulta do banco). */
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let de = 0; de < 50_000; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const nomeCliente = (c: unknown) => (Array.isArray(c) ? c[0]?.nome : (c as { nome?: string } | null)?.nome) ?? "";

/** Carrega 24 meses (até o mês escolhido) e tudo o que ainda está em aberto. */
export async function carregar(mes: string, unidade: Unidade): Promise<Brutos> {
  const supabase: Cliente = await createClient();
  const inicio = `${somarMeses(mes, -23)}-01`;
  const fim = `${somarMeses(mes, 4)}-01`;
  const un = (q: any, coluna = "unidade") => (unidade ? q.eq(coluna, unidade) : q);

  const [pedidos, itens, negociacoes, lancamentos, marcos, ordens, chamados, orcamentos, vendedores, config] = await Promise.all([
    todas<any>((de, ate) => un(supabase.from("pedidos_resumo").select("id, numero, criado_em, total, lucro, unidade, vendedor_id, status, cliente_nome").gte("criado_em", inicio).lt("criado_em", fim)).order("criado_em").range(de, ate)),
    todas<any>((de, ate) =>
      un(
        supabase.from("pedido_itens").select("ambiente, quantidade, preco_unitario, pedidos!inner(criado_em, status, unidade)").gte("pedidos.criado_em", inicio).neq("pedidos.status", "cancelado"),
        "pedidos.unidade",
      ).range(de, ate),
    ),
    todas<any>((de, ate) => un(supabase.from("negociacoes").select("id, titulo, etapa, origem, valor_estimado, motivo_perda, unidade, criado_em, atualizado_em, proxima_acao_data, clientes(nome)").or(`criado_em.gte.${inicio},etapa.not.in.(ganho,perdido)`)).order("criado_em").range(de, ate)),
    todas<any>((de, ate) => un(supabase.from("lancamentos").select("tipo, valor, categoria, vencimento, pago_em, pedido_id").or(`vencimento.gte.${inicio},pago_em.gte.${inicio},pago_em.is.null`)).order("vencimento").range(de, ate)),
    todas<any>((de, ate) =>
      un(supabase.from("pedido_marcos").select("tipo, previsto, realizado, pedido_id, pedidos!inner(numero, status, unidade, clientes(nome))").or(`previsto.gte.${inicio},realizado.is.null`).neq("pedidos.status", "cancelado"), "pedidos.unidade").range(de, ate),
    ),
    todas<any>((de, ate) => un(supabase.from("ordens_producao").select("etapa, prazo, pedidos!inner(unidade)").neq("etapa", "concluido"), "pedidos.unidade").range(de, ate)),
    todas<any>((de, ate) => supabase.from("chamados").select("criado_em, status").or(`criado_em.gte.${inicio},status.neq.resolvido`).range(de, ate)),
    todas<any>((de, ate) => un(supabase.from("orcamentos_resumo").select("id, numero, total, criado_em, visualizado_em, cliente_nome").eq("status", "enviado")).range(de, ate)),
    supabase.from("parceiros").select("id, nome").eq("tipo", "vendedor"),
    supabase.from("configuracoes").select("margem_minima").maybeSingle(),
  ]);

    return {
    pedidos: pedidos.map((p: any) => ({ ...p, total: Number(p.total), lucro: Number(p.lucro) })),
    itens: itens.map((i: any) => {
      const p = Array.isArray(i.pedidos) ? i.pedidos[0] : i.pedidos;
      return { ambiente: i.ambiente, total: Number(i.quantidade) * Number(i.preco_unitario), criado_em: p?.criado_em ?? "" };
    }),
    negociacoes: negociacoes.map((n: any) => ({ ...n, valor_estimado: n.valor_estimado === null ? null : Number(n.valor_estimado), cliente_nome: nomeCliente(n.clientes) })),
    lancamentos: lancamentos.map((l: any) => ({ ...l, valor: Number(l.valor) })),
    marcos: marcos.map((m: any) => {
      const p = Array.isArray(m.pedidos) ? m.pedidos[0] : m.pedidos;
      return { tipo: m.tipo, previsto: m.previsto, realizado: m.realizado, pedido_id: m.pedido_id, numero: p?.numero ?? 0, cliente_nome: nomeCliente(p?.clientes) };
    }),
    ordens: ordens.map((o: any) => ({ etapa: o.etapa, prazo: o.prazo })),
    chamados: chamados as any,
    orcamentos: orcamentos.map((o: any) => ({ ...o, total: Number(o.total) })),
    vendedores: (vendedores.data ?? []) as any,
    margemMinima: Number(config.data?.margem_minima ?? 20),
  };
}
