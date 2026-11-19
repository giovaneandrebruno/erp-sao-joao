import { createClient } from "@/lib/supabase/server";
import { gravarPlanilha, type AbaGravar } from "@/lib/planilha-gravar";
import { exigirAdmin } from "@/lib/perfil";
import { hojeISO } from "@/lib/format";

/** Cada assunto do sistema vira uma aba da cópia de segurança. */
const ASSUNTOS = [
  ["clientes", "Clientes"],
  ["fornecedores", "Fornecedores"],
  ["parceiros", "Equipe e parceiros"],
  ["negociacoes", "Funil de vendas"],
  ["negociacao_notas", "Funil - anotações"],
  ["orcamentos", "Orçamentos"],
  ["orcamento_itens", "Orçamentos - itens"],
  ["pedidos", "Pedidos"],
  ["pedido_itens", "Pedidos - itens"],
  ["pedido_marcos", "Pedidos - prazos"],
  ["ordens_producao", "Produção"],
  ["producao_historico", "Produção - histórico"],
  ["produtos", "Estoque - produtos"],
  ["movimentos_estoque", "Estoque - movimentos"],
  ["lancamentos", "Financeiro"],
  ["chamados", "Assistência técnica"],
  ["configuracoes", "Configurações"],
] as const;

const LOTE = 1000;

/** Baixa tudo o que está no sistema numa planilha .xlsx (só o administrador). */
export async function GET() {
  let perfil;
  try {
    perfil = await exigirAdmin();
  } catch {
    return new Response("Só o administrador pode baixar a cópia de segurança.", { status: 403 });
  }
  const supabase = await createClient();

  const abas: AbaGravar[] = [];
  for (const [tabela, nome] of ASSUNTOS) {
    const linhas: Record<string, unknown>[] = [];
    for (let de = 0; ; de += LOTE) {
      const { data, error } = await supabase.from(tabela).select("*").range(de, de + LOTE - 1);
      if (error) return new Response(`Não foi possível ler ${nome}: ${error.message}`, { status: 500 });
      linhas.push(...(data as Record<string, unknown>[]));
      if (!data || data.length < LOTE) break;
    }
    const colunas = linhas.length ? Object.keys(linhas[0]) : ["(sem registros)"];
    abas.push({ nome, linhas: [colunas, ...linhas.map((l) => colunas.map((c) => l[c]))] });
  }

  const arquivo = gravarPlanilha(abas);
  await supabase.from("configuracoes").update({ ultima_copia_em: new Date().toISOString(), ultima_copia_por: perfil.nome ?? perfil.email }).eq("id", true);

  return new Response(arquivo as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="copia-sao-joao-erp-${hojeISO()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
