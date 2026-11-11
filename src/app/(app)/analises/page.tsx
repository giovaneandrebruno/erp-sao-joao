import Link from "next/link";
import { Titulo } from "@/components/ui";
import { ROTULOS, hojeISO } from "@/lib/format";
import { rotuloMes, somarMeses } from "@/lib/analise";
import { calcular } from "./calculo";
import { carregar } from "./dados";
import { Financeiro, FunilAba, Producao, VisaoGeral, Vendas } from "./abas";

const ABAS = [
  { chave: "visao", rotulo: "Visão geral" },
  { chave: "vendas", rotulo: "Vendas" },
  { chave: "funil", rotulo: "Funil" },
  { chave: "producao", rotulo: "Produção e prazos" },
  { chave: "financeiro", rotulo: "Financeiro" },
] as const;
type Aba = (typeof ABAS)[number]["chave"];

export default async function AnalisesPage({ searchParams }: PageProps<"/analises">) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) && sp.mes <= mesAtual ? sp.mes : mesAtual;
  const unidade = sp.unidade === "marcenaria" || sp.unidade === "loja" ? sp.unidade : null;
  const janela = sp.meses === "6" ? 6 : sp.meses === "24" ? 24 : 12;
  const aba: Aba = ABAS.some((a) => a.chave === sp.aba) ? (sp.aba as Aba) : "visao";

  const a = calcular(await carregar(mes, unidade), { hoje, mes, janela });

  const qs = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const atual: Record<string, string | null> = { aba: aba === "visao" ? null : aba, mes: mes === mesAtual ? null : mes, unidade, meses: janela === 12 ? null : String(janela), ...mudar };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/analises?${s}` : "/analises";
  };
  const pilula = (ativo: boolean) => `rounded-full px-3 py-1.5 transition ${ativo ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-white"}`;
  const proximo = somarMeses(mes, 1);

  return (
    <>
      <Titulo sub={a.emAndamento ? `Mês em andamento: comparações usam os mesmos dias do mês anterior` : `Mês fechado de ${rotuloMes(mes)}`}>Análises</Titulo>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-stone-200 text-sm" aria-label="Painéis">
        {ABAS.map((t) => (
          <Link key={t.chave} href={qs({ aba: t.chave === "visao" ? null : t.chave })} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 font-medium transition ${aba === t.chave ? "border-violeta text-stone-900" : "border-transparent text-stone-500 hover:text-stone-900"}`} aria-current={aba === t.chave ? "page" : undefined}>
            {t.rotulo}
          </Link>
        ))}
      </nav>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link href={qs({ mes: somarMeses(mes, -1) })} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 hover:border-violeta/40" aria-label="Mês anterior">←</Link>
        <span className="min-w-20 text-center font-semibold">{rotuloMes(mes)}</span>
        {proximo <= mesAtual ? (
          <Link href={qs({ mes: proximo === mesAtual ? null : proximo })} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 hover:border-violeta/40" aria-label="Próximo mês">→</Link>
        ) : (
          <span className="rounded-full border border-stone-100 px-3 py-1.5 text-stone-300">→</span>
        )}
        <span className="mx-1 h-5 w-px bg-stone-200" />
        {([6, 12, 24] as const).map((n) => (
          <Link key={n} href={qs({ meses: n === 12 ? null : String(n) })} className={pilula(janela === n)}>{n} meses</Link>
        ))}
        <span className="mx-1 h-5 w-px bg-stone-200" />
        {([null, "marcenaria", "loja"] as const).map((u) => (
          <Link key={u ?? "todas"} href={qs({ unidade: u })} className={pilula(unidade === u)}>
            {u ? ROTULOS.unidade[u] : "Todas"}
          </Link>
        ))}
      </div>

      {aba === "visao" && <VisaoGeral a={a} mes={mes} />}
      {aba === "vendas" && <Vendas a={a} mes={mes} />}
      {aba === "funil" && <FunilAba a={a} />}
      {aba === "producao" && <Producao a={a} />}
      {aba === "financeiro" && <Financeiro a={a} mes={mes} />}
    </>
  );
}
