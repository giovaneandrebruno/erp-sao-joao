"use server";

import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/perfil";
import { podeAbrir } from "@/lib/acesso";
import { ROTULOS, ROTULOS2, brl } from "@/lib/format";

const rotulo = (mapa: Record<string, string>, k: unknown) => mapa[String(k)] ?? String(k).replace(/_/g, " ");

export type Registro = { tipo: string; titulo: string; sub?: string; extra?: string; href: string };

/** Busca rápida (Ctrl+K): procura o termo nos principais cadastros. */
export async function buscarRegistros(termo: string): Promise<Registro[]> {
  const t = termo.trim().replace(/[,()%*\\]/g, " ").slice(0, 60);
  if (t.length < 2) return [];
  const perfil = await perfilAtual();
  if (!perfil || perfil.papel === "montador") return [];
  const supabase = await createClient();
  const numero = /^#?\d+$/.test(t) ? Number(t.replace("#", "")) : null;
  const like = `%${t}%`;

  const [clientes, orcamentos, pedidos, negociacoes, produtos, fornecedores] = await Promise.all([
    supabase.from("clientes").select("id, nome, telefone, cidade").or(`nome.ilike.${like},telefone.ilike.${like},cpf_cnpj.ilike.${like}`).order("nome").limit(5),
    numero != null
      ? supabase.from("orcamentos_resumo").select("id, numero, cliente_nome, total, status").eq("numero", numero).limit(5)
      : supabase.from("orcamentos_resumo").select("id, numero, cliente_nome, total, status").ilike("cliente_nome", like).order("numero", { ascending: false }).limit(4),
    numero != null
      ? supabase.from("pedidos_resumo").select("id, numero, cliente_nome, total, status").eq("numero", numero).limit(5)
      : supabase.from("pedidos_resumo").select("id, numero, cliente_nome, total, status").ilike("cliente_nome", like).order("numero", { ascending: false }).limit(4),
    supabase.from("negociacoes").select("id, titulo, etapa, clientes(nome)").ilike("titulo", like).limit(4),
    supabase.from("produtos").select("id, nome, codigo, estoque_atual, unidade_medida").or(`nome.ilike.${like},codigo.ilike.${like}`).order("nome").limit(4),
    supabase.from("fornecedores").select("id, nome, telefone").ilike("nome", like).order("nome").limit(3),
  ]);

  const r: Registro[] = [];
  for (const c of clientes.data ?? []) r.push({ tipo: "Cliente", titulo: c.nome, sub: [c.telefone, c.cidade].filter(Boolean).join(" · ") || undefined, href: `/clientes/${c.id}` });
  for (const p of pedidos.data ?? []) r.push({ tipo: "Pedido", titulo: `Pedido #${p.numero} · ${p.cliente_nome}`, sub: brl(p.total), extra: rotulo(ROTULOS.statusPedido, p.status), href: `/pedidos/${p.id}` });
  for (const o of orcamentos.data ?? []) r.push({ tipo: "Orçamento", titulo: `Orçamento #${o.numero} · ${o.cliente_nome}`, sub: brl(o.total), extra: rotulo(ROTULOS.statusOrcamento, o.status), href: `/orcamentos/${o.id}` });
  for (const n of negociacoes.data ?? []) {
    const cli = (n.clientes as unknown as { nome: string } | null)?.nome;
    r.push({ tipo: "Negociação", titulo: n.titulo, sub: cli ?? undefined, extra: rotulo(ROTULOS2.etapaNegociacao, n.etapa), href: `/crm/${n.id}` });
  }
  for (const p of produtos.data ?? []) r.push({ tipo: "Produto", titulo: p.nome, sub: [p.codigo, `${Number(p.estoque_atual)} ${p.unidade_medida}`].filter(Boolean).join(" · "), href: `/estoque/${p.id}` });
  for (const f of fornecedores.data ?? []) r.push({ tipo: "Fornecedor", titulo: f.nome, sub: f.telefone ?? undefined, href: "/fornecedores" });
  return r.filter((x) => podeAbrir(perfil.papel, x.href));
}
