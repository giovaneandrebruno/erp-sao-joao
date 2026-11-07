import { createClient } from "@/lib/supabase/server";

export const TIPOS_CAMPO = ["medicao", "entrega", "montagem", "vistoria"] as const;

export type Servico = {
  chave: string;
  tipo: "marco" | "chamado";
  id: string;
  titulo: string;
  data: string | null;
  cliente: string;
  endereco: string | null;
  responsavel: string | null;
  status?: string;
};

type Cli = { nome: string; endereco: string | null; cidade: string | null; uf: string | null } | null;

function enderecoDe(c: Cli) {
  return c ? [c.endereco, c.cidade, c.uf].filter(Boolean).join(", ") || null : null;
}

/** Serviços de campo em aberto: marcos (medição, entrega, montagem, vistoria) e chamados de assistência. */
export async function servicosEmAberto(parceiroId: string | null) {
  const supabase = await createClient();
  let qm = supabase
    .from("pedido_marcos")
    .select("id, tipo, previsto, responsavel_id, responsavel:responsavel_id(nome), pedidos!inner(numero, status, clientes(nome, endereco, cidade, uf))")
    .is("realizado", null)
    .in("tipo", TIPOS_CAMPO as unknown as string[])
    .not("pedidos.status", "eq", "cancelado")
    .not("responsavel_id", "is", null);
  let qc = supabase
    .from("chamados")
    .select("id, numero, descricao, status, data_agendada, responsavel_id, responsavel:responsavel_id(nome), clientes(nome, endereco, cidade, uf)")
    .neq("status", "resolvido")
    .not("responsavel_id", "is", null);
  if (parceiroId) {
    qm = qm.eq("responsavel_id", parceiroId);
    qc = qc.eq("responsavel_id", parceiroId);
  }
  const [{ data: marcos }, { data: chamados }] = await Promise.all([qm, qc]);

  const { ROTULOS2 } = await import("@/lib/format");
  const lista: Servico[] = [
    ...(marcos ?? []).map((m) => {
      const p = m.pedidos as unknown as { numero: number; clientes: Cli };
      return {
        chave: `marco-${m.id}`,
        tipo: "marco" as const,
        id: m.id,
        titulo: `${ROTULOS2.marco[m.tipo as keyof typeof ROTULOS2.marco]} · pedido #${p.numero}`,
        data: m.previsto,
        cliente: p.clientes?.nome ?? "—",
        endereco: enderecoDe(p.clientes),
        responsavel: (m.responsavel as unknown as { nome: string } | null)?.nome ?? null,
      };
    }),
    ...(chamados ?? []).map((c) => ({
      chave: `chamado-${c.id}`,
      tipo: "chamado" as const,
      id: c.id,
      titulo: `Assistência #${c.numero}`,
      data: c.data_agendada,
      cliente: (c.clientes as unknown as Cli)?.nome ?? "—",
      endereco: enderecoDe(c.clientes as unknown as Cli),
      responsavel: (c.responsavel as unknown as { nome: string } | null)?.nome ?? null,
      status: c.status,
    })),
  ];
  return lista.sort((a, b) => (a.data ?? "9999").localeCompare(b.data ?? "9999"));
}
