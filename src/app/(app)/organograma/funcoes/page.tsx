import Link from "next/link";
import { Botao, Campo, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoCancelar, BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";
import { decimal } from "@/lib/format";
import { calcularOrganograma, ehVaga, horas, nomeDaPessoa, type FuncaoOrg, type PessoaOrg } from "@/lib/organograma";
import { lerOrganograma } from "../dados";
import { excluirFuncao, salvarFuncao } from "../actions";

function FormFuncao({ id = null, f, pessoas, marcadas = [], setores }: { id?: string | null; f?: FuncaoOrg; pessoas: PessoaOrg[]; marcadas?: string[]; setores: string[] }) {
  return (
    <form action={salvarFuncao.bind(null, id)} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="Função *" className="md:col-span-4"><input name="nome" required defaultValue={f?.nome ?? ""} placeholder="Ex.: Fazer orçamentos" className={inputCls} /></Campo>
      <Campo rotulo="Horas por semana" className="md:col-span-2"><input name="horas_semana" inputMode="decimal" defaultValue={decimal(f?.horas_semana ?? "")} placeholder="Ex.: 10" className={inputCls} /></Campo>
      <Campo rotulo="Setor" className="md:col-span-6">
        <input name="setor" list="setores-funcao" defaultValue={f?.setor ?? ""} className={inputCls} />
        <datalist id="setores-funcao">{setores.map((s) => <option key={s} value={s} />)}</datalist>
      </Campo>
      <Campo rotulo="Descrição" className="md:col-span-6"><textarea name="descricao" rows={2} defaultValue={f?.descricao ?? ""} className={inputCls} /></Campo>
      <fieldset className="md:col-span-6">
        <legend className="mb-1.5 text-xs font-medium text-stone-600">Quem faz</legend>
        {pessoas.length ? (
          <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-stone-200 p-2 sm:grid-cols-2">
            {pessoas.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50">
                <input type="checkbox" name="pessoas" value={p.id} defaultChecked={marcadas.includes(p.id)} className="accent-[#e37f33]" />
                <span className="min-w-0 truncate">{p.cargo} <span className={ehVaga(p) ? "italic text-madeira-700" : "text-stone-500"}>· {nomeDaPessoa(p)}</span></span>
              </label>
            ))}
          </div>
        ) : <p className="text-sm text-stone-500">Ainda não há quadros no organograma.</p>}
      </fieldset>
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{id ? "Salvar alterações" : "Salvar"}</Botao>
        {id && <BotaoCancelar />}
      </div>
    </form>
  );
}

/** Funções (o que precisa ser feito), com as horas por semana e quem faz cada uma. */
export default async function FuncoesPage({ searchParams }: PageProps<"/organograma/funcoes">) {
  const sp = await searchParams;
  const ver = typeof sp.ver === "string" ? sp.ver : "";
  const { pessoas, funcoes, atribuicoes } = await lerOrganograma();
  const calc = calcularOrganograma(pessoas, funcoes, atribuicoes);
  const semIds = new Set(calc.semNinguem.map((x) => x.funcao.id));
  const lista = ver === "sem" ? funcoes.filter((f) => semIds.has(f.id)) : funcoes;
  const ordenadas = [...pessoas].sort((a, b) => a.cargo.localeCompare(b.cargo, "pt-BR"));
  const setores = [...new Set([...funcoes.map((f) => f.setor), ...pessoas.map((p) => p.setor)].filter(Boolean))] as string[];
  const emEdicao = typeof sp.editar === "string" ? funcoes.find((f) => f.id === sp.editar) : undefined;

  return (
    <>
      <Titulo
        sub="Tudo o que precisa ser feito na empresa. Função sem ninguém mostra onde é preciso contratar ou passar para alguém."
        acao={
          <JanelaBotao rotulo="Nova função" titulo="Nova função" aviso="Função salva">
            <FormFuncao pessoas={ordenadas} setores={setores} />
          </JanelaBotao>
        }
      >
        Funções
      </Titulo>
      <nav className="mb-4 flex flex-wrap gap-1.5 text-sm">
        {[{ id: "", rotulo: `Todas (${funcoes.length})` }, { id: "sem", rotulo: `Sem ninguém (${calc.semNinguem.length})` }].map((f) => (
          <Link key={f.id} href={f.id ? `?ver=${f.id}` : "?"} className={`rounded-full px-3 py-1.5 font-medium transition ${ver === f.id ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-inset ring-stone-200 hover:bg-stone-50"}`}>
            {f.rotulo}
          </Link>
        ))}
      </nav>
      <Tabela cabecalho={["Função", "Setor", "Horas por semana", "Quem faz", ""]} vazio={!lista.length}>
        {lista.map((f) => {
          const quem = calc.genteDe(f.id);
          const gente = quem.filter((p) => !ehVaga(p));
          return (
            <tr key={f.id}>
              <td className="px-4 py-3">
                <div className="font-medium text-stone-900">{f.nome}</div>
                {f.descricao && <div className="mt-0.5 max-w-md truncate text-xs text-stone-500">{f.descricao}</div>}
              </td>
              <td className="px-4 py-3">{f.setor ?? "—"}</td>
              <td className="px-4 py-3 font-mono">{horas(Number(f.horas_semana))}</td>
              <td className="px-4 py-3">
                {gente.length ? (
                  <span className="text-stone-800">
                    {gente.map((p) => p.nome).join(", ")}
                    {gente.length > 1 && <span className="text-xs text-stone-500"> · {horas(Number(f.horas_semana) / gente.length)} cada</span>}
                  </span>
                ) : quem.length ? <Selo cor="amber">Só vaga em aberto: {quem.map((p) => p.cargo).join(", ")}</Selo> : <Selo cor="red">Sem ninguém</Selo>}
              </td>
              <td className="px-4 py-2">
                <AcoesLinha>
                  <LinkEditar id={f.id} />
                  <BotaoExcluir
                    acao={excluirFuncao.bind(null, f.id)}
                    titulo="Excluir esta função?"
                    detalhe={<><strong>{f.nome}</strong>. Ela sai dos quadros de quem fazia.</>}
                    aviso="Função excluída"
                  />
                </AcoesLinha>
              </td>
            </tr>
          );
        })}
      </Tabela>
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Alterar função" descricao={emEdicao.nome} aviso="Função salva">
          <FormFuncao id={emEdicao.id} f={emEdicao} pessoas={ordenadas} setores={setores} marcadas={atribuicoes.filter((a) => a.funcao_id === emEdicao.id).map((a) => a.pessoa_id)} />
        </JanelaEditar>
      )}
    </>
  );
}
