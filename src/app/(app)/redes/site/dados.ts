import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localizar } from "@/lib/navegacao";

export type DadosSite = {
  acessosPorDia: Record<string, number>;
  pessoasPorDia: Record<string, number>;
  porTela: { nome: string; valor: number }[];
  porPessoa: { nome: string; valor: number; detalhe: string }[];
  pessoas: number;
  total: number;
  totalAntes: number;
  propostas: { id: string; numero: number | null; cliente: string; aberturas: number; ultima: string | null; primeira: string | null }[];
};

const diaSP = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Nome da tela a partir do endereço (pelo menu do sistema). */
export function nomeDaTela(caminho: string) {
  const [base, busca = ""] = caminho.split("?");
  const l = localizar(base, busca);
  if (!l) return base === "/conta" ? "Minha senha" : base;
  const folha = l.folha && l.folha.rotulo !== l.aba.rotulo ? ` / ${l.folha.rotulo}` : "";
  const detalhe = l.folha ? (base !== l.folha.href.split("?")[0] ? " (ficha)" : "") : base !== l.aba.href ? " (ficha)" : "";
  return `${l.aba.rotulo}${folha}${detalhe}`;
}

/** Uso do sistema pela equipe e propostas abertas pelos clientes, nos últimos `dias` dias. */
export async function carregarSite(dias: number): Promise<DadosSite> {
  const supabase = await createClient();
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const antes = new Date(Date.now() - 2 * dias * 86400000).toISOString();
  const acessos: { user_id: string; nome: string | null; caminho: string; em: string }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data } = await supabase.from("acessos_sistema").select("user_id, nome, caminho, em").gte("em", desde).order("em").range(de, de + 999);
    acessos.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const [{ count: totalAntes }, { data: propostas }] = await Promise.all([
    supabase.from("acessos_sistema").select("id", { count: "exact", head: true }).gte("em", antes).lt("em", desde),
    supabase.from("orcamentos").select("id, numero, aberturas, visualizado_em, ultima_abertura_em, clientes(nome)").gte("ultima_abertura_em", desde).order("ultima_abertura_em", { ascending: false }).limit(30),
  ]);

  const acessosPorDia: Record<string, number> = {};
  const gente: Record<string, Set<string>> = {};
  const telas: Record<string, number> = {};
  const pessoas: Record<string, { nome: string; n: number; dias: Set<string> }> = {};
  for (const a of acessos) {
    const d = diaSP(a.em);
    acessosPorDia[d] = (acessosPorDia[d] ?? 0) + 1;
    (gente[d] ??= new Set()).add(a.user_id);
    const t = nomeDaTela(a.caminho);
    telas[t] = (telas[t] ?? 0) + 1;
    const p = (pessoas[a.user_id] ??= { nome: a.nome || "Sem nome", n: 0, dias: new Set() });
    p.n++;
    p.dias.add(d);
  }
  return {
    acessosPorDia,
    pessoasPorDia: Object.fromEntries(Object.entries(gente).map(([d, s]) => [d, s.size])),
    porTela: Object.entries(telas).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor),
    porPessoa: Object.values(pessoas).map((p) => ({ nome: p.nome, valor: p.n, detalhe: `${p.dias.size} ${p.dias.size === 1 ? "dia" : "dias"} com uso` })).sort((a, b) => b.valor - a.valor),
    pessoas: Object.keys(pessoas).length,
    total: acessos.length,
    totalAntes: totalAntes ?? 0,
    propostas: (propostas ?? []).map((o) => ({
      id: o.id,
      numero: o.numero,
      cliente: (o.clientes as unknown as { nome: string } | null)?.nome ?? "—",
      aberturas: o.aberturas ?? 0,
      ultima: o.ultima_abertura_em,
      primeira: o.visualizado_em,
    })),
  };
}
