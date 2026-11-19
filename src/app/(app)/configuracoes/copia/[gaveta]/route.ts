import { createClient } from "@/lib/supabase/server";
import { gravarPlanilha } from "@/lib/planilha-gravar";
import { exigirAdmin } from "@/lib/perfil";
import { abaDe, nomeDoAssunto } from "@/lib/copia";

/** Baixa, em .xlsx, uma das cópias automáticas guardadas no banco (só o administrador). */
export async function GET(_: Request, { params }: { params: Promise<{ gaveta: string }> }) {
  try {
    await exigirAdmin();
  } catch {
    return new Response("Só o administrador pode baixar a cópia de segurança.", { status: 403 });
  }
  const gaveta = Number((await params).gaveta);
  if (!Number.isInteger(gaveta) || gaveta < 0 || gaveta > 29) return new Response("Cópia não encontrada.", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("copia_dados", { p_gaveta: gaveta });
  if (error) return new Response(`Não foi possível ler a cópia: ${error.message}`, { status: 500 });
  const copia = data as { feita_em: string; dados: Record<string, Record<string, unknown>[]> } | null;
  if (!copia) return new Response("Cópia não encontrada.", { status: 404 });

  const abas = Object.entries(copia.dados)
    .sort(([a], [b]) => nomeDoAssunto(a).localeCompare(nomeDoAssunto(b), "pt-BR"))
    .map(([tabela, linhas]) => abaDe(nomeDoAssunto(tabela), linhas));
  const dia = new Date(copia.feita_em).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  return new Response(gravarPlanilha(abas) as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="copia-automatica-sao-joao-erp-${dia}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
