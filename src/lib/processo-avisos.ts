import type { createClient } from "@/lib/supabase/server";
import { data } from "@/lib/format";
import { nomeEtapa, nomeSituacao } from "@/lib/processo";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AvisoProcesso = {
  chave: string;
  tipo: "dlp" | "dle" | "situacao" | "pasta";
  href: string;
  numero: number | null;
  cliente: string;
  motivo: string;
  vencido: boolean;
  quando: string;
  responsavelId: string | null;
};

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00`) - Date.parse(`${de}T12:00:00`)) / 864e5);
const prazoTexto = (d: string, hoje: string) => {
  const n = diasEntre(hoje, d);
  return n < 0 ? `venceu há ${-n} dia(s)` : n === 0 ? "vence hoje" : `vence em ${n} dia(s)`;
};

/**
 * Avisos do processo dos pedidos: DLP (assinar o executivo) e DLE (entrega) vencendo em até `dias`,
 * situações com prazo vencido e pastas devolvidas para correção.
 */
export async function avisosDoProcesso(supabase: Supabase, hoje: string, dias = 7): Promise<AvisoProcesso[]> {
  const limite = new Date(`${hoje}T12:00:00`);
  limite.setDate(limite.getDate() + dias);
  const ate = limite.toISOString().slice(0, 10);
  const etapasFinais = "(concluido,cancelamento)";
  const [dlp, dle, sit, pastas] = await Promise.all([
    supabase.from("pedidos").select("id, numero, etapa, data_limite_assinatura, situacao_responsavel_id, clientes(nome)")
      .not("data_limite_assinatura", "is", null).lte("data_limite_assinatura", ate).in("etapa", ["pre_venda", "venda", "medicao", "executivo"]),
    supabase.from("pedidos").select("id, numero, etapa, data_limite_entrega, situacao_responsavel_id, clientes(nome)")
      .not("data_limite_entrega", "is", null).lte("data_limite_entrega", ate).in("etapa", ["pre_venda", "venda", "medicao", "executivo", "fabricacao", "entrega"]),
    supabase.from("pedidos").select("id, numero, etapa, situacao, situacao_prazo, situacao_responsavel_id, clientes(nome)")
      .not("situacao_prazo", "is", null).lt("situacao_prazo", hoje).not("etapa", "in", etapasFinais),
    supabase.from("cliente_pasta_devolucoes").select("id, cliente_id, motivo, responsavel_id, criado_em, clientes(nome)").is("corrigida_em", null),
  ]);
  const nome = (c: unknown) => (c as { nome: string } | null)?.nome ?? "Cliente";
  const avisos: AvisoProcesso[] = [
    ...(dlp.data ?? []).map((p) => ({
      chave: `dlp-${p.id}`, tipo: "dlp" as const, href: `/pedidos/${p.id}`, numero: p.numero, cliente: nome(p.clientes),
      motivo: `DLP (assinar o executivo) ${prazoTexto(p.data_limite_assinatura!, hoje)}`, vencido: p.data_limite_assinatura! < hoje,
      quando: p.data_limite_assinatura!, responsavelId: p.situacao_responsavel_id,
    })),
    ...(dle.data ?? []).map((p) => ({
      chave: `dle-${p.id}`, tipo: "dle" as const, href: `/pedidos/${p.id}`, numero: p.numero, cliente: nome(p.clientes),
      motivo: `DLE (data limite de entrega) ${prazoTexto(p.data_limite_entrega!, hoje)}`, vencido: p.data_limite_entrega! < hoje,
      quando: p.data_limite_entrega!, responsavelId: p.situacao_responsavel_id,
    })),
    ...(sit.data ?? []).map((p) => ({
      chave: `sit-${p.id}`, tipo: "situacao" as const, href: `/pedidos/${p.id}`, numero: p.numero, cliente: nome(p.clientes),
      motivo: `${nomeEtapa(p.etapa)}${nomeSituacao(p.situacao) ? ` · ${nomeSituacao(p.situacao)}` : ""}: prazo ${prazoTexto(p.situacao_prazo!, hoje)}`,
      vencido: true, quando: p.situacao_prazo!, responsavelId: p.situacao_responsavel_id,
    })),
    ...(pastas.data ?? []).map((d) => ({
      chave: `pasta-${d.id}`, tipo: "pasta" as const, href: `/clientes/${d.cliente_id}`, numero: null, cliente: nome(d.clientes),
      motivo: `Pasta devolvida para correção em ${data(d.criado_em)}: ${d.motivo}`, vencido: true,
      quando: String(d.criado_em).slice(0, 10), responsavelId: d.responsavel_id,
    })),
  ];
  return avisos.sort((a, b) => a.quando.localeCompare(b.quando));
}
