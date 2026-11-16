import { createClient } from "@/lib/supabase/server";
import { CAMPOS, statusPcp } from "@/lib/pcp";
import { data, hojeISO } from "@/lib/format";

/** Baixa a produção no mesmo formato de colunas da planilha (CSV que abre no Excel). */
export async function GET() {
  const supabase = await createClient();
  const { data: ordens, error } = await supabase
    .from("ordens_producao")
    .select("*")
    .order("ordem", { ascending: true, nullsFirst: false })
    .order("numero");
  if (error) return new Response(error.message, { status: 500 });

  const cab = [...CAMPOS.map((c) => c.rotulo.toUpperCase()), "ENTREGA LIMITE", "DESCRIÇÃO DO STATUS"];
  const cel = (v: unknown) => {
    const t = String(v ?? "");
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const linhas = (ordens ?? []).map((o: Record<string, unknown>) => [
    ...CAMPOS.map((c) => (c.chave === "data_venda" ? (o.data_venda ? data(String(o.data_venda)) : o.data_venda_obs) : o[c.chave])),
    o.entrega_limite ? data(String(o.entrega_limite)) : "",
    statusPcp(String(o.status_pcp)).nome,
  ].map(cel).join(";"));

  const csv = "﻿" + [cab.map(cel).join(";"), ...linhas].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="producao-${hojeISO()}.csv"`,
    },
  });
}
