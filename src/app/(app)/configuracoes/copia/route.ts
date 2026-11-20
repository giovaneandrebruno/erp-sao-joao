import { createClient } from "@/lib/supabase/server";
import { gravarPlanilha, type AbaGravar } from "@/lib/planilha-gravar";
import { exigirAdmin } from "@/lib/perfil";
import { hojeISO } from "@/lib/format";
import { abaDe, nomeDoAssunto } from "@/lib/copia";

/** Assuntos que entram na planilha baixada na hora (as abas seguem esta ordem). */
const TABELAS = [
  "clientes", "fornecedores", "parceiros", "negociacoes", "negociacao_notas", "orcamentos", "orcamento_itens",
  "pedidos", "pedido_itens", "pedido_marcos", "ordens_producao", "producao_historico", "produtos",
  "movimentos_estoque", "pedido_materiais", "retalhos", "inventarios", "inventario_itens", "requisicoes_compra",
  "cotacoes", "cotacao_itens", "cotacao_fornecedores", "cotacao_precos", "compras", "compra_itens", "recebimentos",
  "lancamentos", "chamados", "configuracoes", "melhorias",
];

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
  for (const tabela of TABELAS) {
    const nome = nomeDoAssunto(tabela);
    const linhas: Record<string, unknown>[] = [];
    for (let de = 0; ; de += LOTE) {
      const { data, error } = await supabase.from(tabela).select("*").range(de, de + LOTE - 1);
      if (error) return new Response(`Não foi possível ler ${nome}: ${error.message}`, { status: 500 });
      linhas.push(...(data as Record<string, unknown>[]));
      if (!data || data.length < LOTE) break;
    }
    abas.push(abaDe(nome, linhas));
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
