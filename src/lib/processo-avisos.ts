import type { createClient } from "@/lib/supabase/server";
import { data } from "@/lib/format";
import { nomeSituacao } from "@/lib/processo";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AvisoProcesso = {
  chave: string;
  tipo: "dlp" | "dle" | "atendimento" | "pasta";
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
 * Avisos do processo: DLP (assinar o executivo) e DLE (entrega) dos pedidos vencendo em até `dias`,
 * clientes novos com o prazo do atendimento vencido e pastas devolvidas para correção.
 */
export async function avisosDoProcesso(supabase: Supabase, hoje: string, dias = 7): Promise<AvisoProcesso[]> {
  const limite = new Date(`${hoje}T12:00:00`);
  limite.setDate(limite.getDate() + dias);
  const ate = limite.toISOString().slice(0, 10);
  const [dlpBruto, dle, sit, pastas] = await Promise.all([
    // DLP: enquanto o executivo assinado não está na pasta
    supabase.from("pedidos").select("id, numero, cliente_id, data_limite_assinatura, vendedor_id, clientes(nome)")
      .not("data_limite_assinatura", "is", null).lte("data_limite_assinatura", ate).in("status", ["aberto", "em_producao"]),
    // DLE: enquanto o pedido não está pronto, entregue ou cancelado
    supabase.from("pedidos").select("id, numero, data_limite_entrega, clientes(nome)")
      .not("data_limite_entrega", "is", null).lte("data_limite_entrega", ate).in("status", ["aberto", "em_producao"]),
    supabase.from("clientes").select("id, nome, atendimento_situacao, atendimento_prazo, atendimento_responsavel_id")
      .not("atendimento_prazo", "is", null).lt("atendimento_prazo", hoje).not("atendimento_situacao", "is", null).eq("situacao", "lead"),
    supabase.from("cliente_pasta_devolucoes").select("id, cliente_id, motivo, responsavel_id, criado_em, clientes(nome)").is("corrigida_em", null),
  ]);
  const idsClientes = [...new Set((dlpBruto.data ?? []).map((p) => p.cliente_id))];
  const { data: assinados } = idsClientes.length
    ? await supabase.from("cliente_documentos").select("cliente_id").eq("tipo", "executivo_assinado").in("cliente_id", idsClientes)
    : { data: [] };
  const comExecutivo = new Set((assinados ?? []).map((d) => d.cliente_id));
  const dlp = { data: (dlpBruto.data ?? []).filter((p) => !comExecutivo.has(p.cliente_id)) };
  const nome = (c: unknown) => (c as { nome: string } | null)?.nome ?? "Cliente";
  const avisos: AvisoProcesso[] = [
    ...(dlp.data ?? []).map((p) => ({
      chave: `dlp-${p.id}`, tipo: "dlp" as const, href: `/pedidos/${p.id}`, numero: p.numero, cliente: nome(p.clientes),
      motivo: `DLP (assinar o executivo) ${prazoTexto(p.data_limite_assinatura!, hoje)}`, vencido: p.data_limite_assinatura! < hoje,
      quando: p.data_limite_assinatura!, responsavelId: null,
    })),
    ...(dle.data ?? []).map((p) => ({
      chave: `dle-${p.id}`, tipo: "dle" as const, href: `/pedidos/${p.id}`, numero: p.numero, cliente: nome(p.clientes),
      motivo: `DLE (data limite de entrega) ${prazoTexto(p.data_limite_entrega!, hoje)}`, vencido: p.data_limite_entrega! < hoje,
      quando: p.data_limite_entrega!, responsavelId: null,
    })),
    ...(sit.data ?? []).map((c) => ({
      chave: `atend-${c.id}`, tipo: "atendimento" as const, href: `/clientes/${c.id}`, numero: null, cliente: c.nome,
      motivo: `Cliente novo · ${nomeSituacao(c.atendimento_situacao) ?? "atendimento"}: prazo ${prazoTexto(c.atendimento_prazo!, hoje)}`,
      vencido: true, quando: c.atendimento_prazo!, responsavelId: c.atendimento_responsavel_id,
    })),
    ...(pastas.data ?? []).map((d) => ({
      chave: `pasta-${d.id}`, tipo: "pasta" as const, href: `/clientes/${d.cliente_id}`, numero: null, cliente: nome(d.clientes),
      motivo: `Pasta devolvida para correção em ${data(d.criado_em)}: ${d.motivo}`, vencido: true,
      quando: String(d.criado_em).slice(0, 10), responsavelId: d.responsavel_id,
    })),
  ];
  return avisos.sort((a, b) => a.quando.localeCompare(b.quando));
}
