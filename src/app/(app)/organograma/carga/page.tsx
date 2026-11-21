import Link from "next/link";
import { Cartao, Selo, Tabela, Titulo, estiloBotao } from "@/components/ui";
import { AcoesLinha, BotaoExcluir } from "@/components/acoes";
import { NIVEL, calcularOrganograma, corDoQuadro, ehVaga, horas, nomeDaPessoa } from "@/lib/organograma";
import { lerOrganograma } from "../dados";
import { excluirQuadro } from "../actions";

const FILTROS = [
  { id: "", rotulo: "Todos" },
  { id: "sobrecarregadas", rotulo: "Sobrecarregadas" },
  { id: "vagas", rotulo: "Vagas em aberto" },
  { id: "folga", rotulo: "Com folga" },
];

/** Carga de trabalho de cada pessoa: quem está acima de 100% e quem tem folga. */
export default async function CargaPage({ searchParams }: PageProps<"/organograma/carga">) {
  const sp = await searchParams;
  const ver = typeof sp.ver === "string" ? sp.ver : "";
  const { pessoas, funcoes, atribuicoes } = await lerOrganograma();
  const calc = calcularOrganograma(pessoas, funcoes, atribuicoes);
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const linhas = pessoas
    .map((p) => ({ p, c: calc.cargas.get(p.id)! }))
    .filter(({ c }) => !ver || (ver === "sobrecarregadas" ? c.nivel === "sobrecarregada" : ver === "vagas" ? c.nivel === "vaga" : ver === "folga" ? c.nivel === "folga" || c.nivel === "sem_funcao" : true))
    .sort((a, b) => Number(a.c.nivel === "vaga") - Number(b.c.nivel === "vaga") || (b.c.pct ?? -1) - (a.c.pct ?? -1) || nomeDaPessoa(a.p).localeCompare(nomeDaPessoa(b.p), "pt-BR"));
  const horasSemNinguem = calc.semNinguem.reduce((s, x) => s + Number(x.funcao.horas_semana), 0);
  const excesso = calc.sobrecarregadas.reduce((s, p) => { const c = calc.cargas.get(p.id)!; return s + Math.max(c.horas - c.capacidade, 0); }, 0);

  return (
    <>
      <Titulo sub="Soma das horas por semana das funções de cada pessoa, comparada com as horas que ela trabalha. Função dividida entre várias pessoas tem as horas divididas entre elas.">
        Pessoas e carga
      </Titulo>

      {(calc.sobrecarregadas.length > 0 || calc.vagas.length > 0 || calc.semNinguem.length > 0) && (
        <Cartao className="mb-6">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Onde precisamos de gente</div>
          <ul className="grid gap-2 text-sm text-stone-700 md:grid-cols-3">
            <li>
              <b className="text-rosa">{calc.sobrecarregadas.length}</b> {calc.sobrecarregadas.length === 1 ? "pessoa sobrecarregada" : "pessoas sobrecarregadas"}
              {excesso > 0 && <span className="text-stone-500">, {horas(excesso)} a mais por semana no total</span>}
            </li>
            <li>
              <b className="text-madeira-700">{calc.vagas.length}</b> {calc.vagas.length === 1 ? "vaga em aberto" : "vagas em aberto"}
              {calc.vagas.length > 0 && <span className="text-stone-500">: {calc.vagas.map((v) => v.cargo).join(", ")}</span>}
            </li>
            <li>
              <Link href="/organograma/funcoes?ver=sem" className="hover:underline">
                <b className="text-rosa">{calc.semNinguem.length}</b> {calc.semNinguem.length === 1 ? "função sem ninguém" : "funções sem ninguém"}
              </Link>
              {horasSemNinguem > 0 && <span className="text-stone-500">, {horas(horasSemNinguem)} por semana</span>}
            </li>
          </ul>
        </Cartao>
      )}

      <nav className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {FILTROS.map((f) => (
          <Link key={f.id} href={f.id ? `?ver=${f.id}` : "?"} className={`rounded-full px-3 py-1.5 font-medium transition ${ver === f.id ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:bg-stone-50"}`}>
            {f.rotulo}
          </Link>
        ))}
      </nav>

      <Tabela cabecalho={["Cargo e pessoa", "Setor", "Responde a", "Funções", "Carga", "Situação", ""]} vazio={!linhas.length}>
        {linhas.map(({ p, c }) => {
          const chefe = p.chefe_id ? porId.get(p.chefe_id) : null;
          const nivel = NIVEL[c.nivel];
          return (
            <tr key={p.id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: corDoQuadro(p.cor).hex }} />
                  <span className="font-medium text-stone-900">{p.cargo}</span>
                </div>
                <div className={`mt-0.5 pl-5 text-xs ${ehVaga(p) ? "italic text-madeira-700" : "text-stone-500"}`}>{nomeDaPessoa(p)}</div>
              </td>
              <td className="px-4 py-3">{p.setor ?? "—"}</td>
              <td className="px-4 py-3">{chefe ? `${chefe.cargo}${ehVaga(chefe) ? "" : ` (${chefe.nome})`}` : "—"}</td>
              <td className="max-w-xs px-4 py-3">
                {c.funcoes.length ? (
                  <details>
                    <summary className="cursor-pointer whitespace-nowrap text-stone-800">{c.funcoes.length} {c.funcoes.length === 1 ? "função" : "funções"}</summary>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-stone-600">
                      {c.funcoes.map((f) => (
                        <li key={f.funcao.id}>
                          {f.funcao.nome} · {horas(f.horas)}{f.dividida > 1 ? ` (dividida por ${f.dividida})` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : <span className="text-stone-400">Nenhuma</span>}
              </td>
              <td className="min-w-44 px-4 py-3">
                {c.nivel === "vaga" ? <span className="text-xs text-stone-500">{horas(c.horas)} esperando contratação</span> : (
                  <>
                    <div className="flex justify-between font-mono text-xs text-stone-600">
                      <span>{horas(c.horas)} de {horas(c.capacidade)}</span>
                      <span className="font-semibold">{c.pct === null ? "" : `${Math.round(c.pct)}%`}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                      <div className={`h-full rounded-full ${nivel.barra}`} style={{ width: `${Math.min(c.pct ?? 0, 100)}%` }} />
                    </div>
                  </>
                )}
              </td>
              <td className="px-4 py-3"><Selo cor={nivel.cor}>{nivel.rotulo}</Selo></td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <Link href={`/organograma?quadro=${p.id}`} className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Abrir</Link>
                  <BotaoExcluir
                    acao={excluirQuadro.bind(null, p.id)}
                    titulo="Excluir este quadro?"
                    detalhe={<><strong>{p.cargo}</strong> ({nomeDaPessoa(p)}). Quem responde a ele passa a responder a quem está acima.</>}
                    aviso="Quadro excluído"
                  />
                </AcoesLinha>
              </td>
            </tr>
          );
        })}
      </Tabela>
      <p className="mt-3 text-xs text-stone-500">
        Com folga: abaixo de 50% · Normal: 50% a 89% · No limite: 90% a 100% · Sobrecarregada: acima de 100%.
      </p>
    </>
  );
}
