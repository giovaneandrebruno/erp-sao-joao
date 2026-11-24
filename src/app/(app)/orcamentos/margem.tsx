import { Cartao } from "@/components/ui";
import { brl, pct } from "@/lib/format";
import { aplicarPerfilMargem, type PerfilMargem } from "./actions";

const PERFIS: { chave: PerfilMargem; rotulo: string }[] = [
  { chave: "baixo", rotulo: "Baixo" },
  { chave: "medio", rotulo: "Médio" },
  { chave: "alto", rotulo: "Alto" },
];

/**
 * Calculadora de margem: parte do custo dos itens e mostra o preço e a margem para cada perfil de cliente.
 * "Usar" refaz o preço de venda de cada item (custo × markup do perfil).
 */
export function CalculadoraMargem({
  orcamentoId, custo, venda, perfil, markups, editavel,
}: {
  orcamentoId: string; custo: number; venda: number; perfil: PerfilMargem | null;
  markups: Record<PerfilMargem, number>; editavel: boolean;
}) {
  const atual = custo > 0 ? venda / custo : 0;
  return (
    <Cartao>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-semibold">Calculadora de margem</h3>
        {atual > 0 && <span className="text-xs text-stone-500">hoje: {atual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}× o custo</span>}
      </div>
      <p className="mb-3 text-xs text-stone-500">Parte do custo dos itens ({brl(custo)}) e aplica o markup do perfil do cliente. Os markups ficam em Configurações.</p>
      {custo <= 0 ? (
        <p className="text-sm text-stone-400">Informe o custo dos itens para calcular.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {PERFIS.map(({ chave, rotulo }) => {
            const m = markups[chave];
            const preco = custo * m;
            const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
            const escolhido = perfil === chave;
            return (
              <div key={chave} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="font-medium">Perfil {rotulo.toLowerCase()} {escolhido && <span className="ml-1 rounded-full bg-neon/10 px-2 py-0.5 text-xs text-neon ring-1 ring-inset ring-neon/25">em uso</span>}</div>
                  <div className="text-xs text-stone-500">{m.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}× o custo · margem bruta {pct(margem)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{brl(preco)}</span>
                  {editavel && (
                    <form action={aplicarPerfilMargem.bind(null, orcamentoId, chave)}>
                      <button type="submit" className="inline-flex h-8 items-center rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition hover:border-madeira-300 hover:text-madeira-700">Usar</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-xs text-stone-500">Usar refaz o preço de venda de cada item a partir do custo. Os itens sem custo não mudam. O desconto, as comissões e os impostos entram na previsão de lucro acima.</p>
    </Cartao>
  );
}
