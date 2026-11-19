import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Selo, Tabela, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { AcoesLinha, BotaoCancelar, JanelaEditar, LinkEditar } from "@/components/acoes";
import { perfilAtual } from "@/lib/perfil";
import { data } from "@/lib/format";
import { alterarMelhoria, sugerirMelhoria } from "./actions";

type Melhoria = {
  id: string; titulo: string; descricao: string | null; area: string | null; resultado: number; esforco: number;
  situacao: "ideia" | "fazendo" | "feito" | "descartado"; sugerido_por: string | null; criado_em: string;
};

const SITUACAO = { ideia: ["Ideia", "stone"], fazendo: ["Fazendo", "amber"], feito: ["Feito", "green"], descartado: ["Descartado", "red"] } as const;
const NOTAS = [1, 2, 3, 4, 5];

/** Muito resultado com pouco esforço vem primeiro. */
const prioridade = (m: Melhoria) => m.resultado * 2 - m.esforco;
function quadrante(m: Melhoria) {
  if (m.resultado >= 4 && m.esforco <= 2) return { texto: "Fazer primeiro", cor: "green" as const };
  if (m.resultado >= 4) return { texto: "Planejar", cor: "blue" as const };
  if (m.esforco <= 2) return { texto: "Quando sobrar tempo", cor: "amber" as const };
  return { texto: "Repensar", cor: "stone" as const };
}

function FormMelhoria({ m, admin }: { m?: Melhoria; admin: boolean }) {
  const nota = (nome: "resultado" | "esforco", rotulo: string) => (
    <Campo rotulo={rotulo} className="md:col-span-2">
      <select name={nome} defaultValue={m?.[nome] ?? 3} className={inputCls}>
        {NOTAS.map((n) => <option key={n} value={n}>{n} {n === 1 ? "(pouco)" : n === 5 ? "(muito)" : ""}</option>)}
      </select>
    </Campo>
  );
  return (
    <form action={m ? alterarMelhoria.bind(null, m.id) : sugerirMelhoria} className="grid gap-3 md:grid-cols-6">
      <Campo rotulo="O que melhorar *" className="md:col-span-4"><input name="titulo" required defaultValue={m?.titulo ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Tela ou assunto" className="md:col-span-2"><input name="area" defaultValue={m?.area ?? ""} placeholder="Ex.: Orçamentos" className={inputCls} /></Campo>
      <Campo rotulo="Detalhes" className="md:col-span-6"><textarea name="descricao" rows={3} defaultValue={m?.descricao ?? ""} className={inputCls} /></Campo>
      {nota("resultado", "Quanto ajuda (1 a 5)")}
      {nota("esforco", "Quanto trabalho dá (1 a 5)")}
      {m && admin && (
        <Campo rotulo="Situação" className="md:col-span-2">
          <select name="situacao" defaultValue={m.situacao} className={inputCls}>
            {Object.entries(SITUACAO).map(([k, [r]]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
      )}
      <div className="flex gap-2 md:col-span-6">
        <Botao type="submit">{m ? "Salvar alterações" : "Salvar ideia"}</Botao>
        {m && <BotaoCancelar />}
      </div>
    </form>
  );
}

export default async function MelhoriasPage({ searchParams }: PageProps<"/melhorias">) {
  const { editar, ver } = await searchParams;
  const admin = (await perfilAtual())?.papel === "admin";
  const supabase = await createClient();
  const { data: brutas } = await supabase.from("melhorias").select("*");
  const todas = ((brutas ?? []) as Melhoria[]).sort((a, b) => prioridade(b) - prioridade(a) || a.criado_em.localeCompare(b.criado_em));
  const verTodas = ver === "todas";
  const lista = verTodas ? todas : todas.filter((m) => m.situacao === "ideia" || m.situacao === "fazendo");
  const emEdicao = admin && typeof editar === "string" ? todas.find((m) => m.id === editar) : undefined;

  return (
    <>
      <Titulo sub="Ideias para o sistema, em ordem: o que ajuda muito e dá pouco trabalho vem primeiro">Melhorias do sistema</Titulo>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a href={verTodas ? "/melhorias" : "/melhorias?ver=todas"} className="text-sm text-stone-500 hover:text-stone-800">
          {verTodas ? "Mostrar só as abertas" : `Mostrar também as feitas e descartadas (${todas.length - lista.length})`}
        </a>
        <JanelaBotao rotulo="Nova ideia" titulo="Nova ideia de melhoria" aviso="Ideia salva">
          <FormMelhoria admin={admin} />
        </JanelaBotao>
      </div>
      <Tabela cabecalho={["O que melhorar", "Tela", "Ajuda", "Trabalho", "Prioridade", "Situação", "Sugerido por", ""]} vazio={!lista.length}>
        {lista.map((m) => {
          const q = quadrante(m);
          return (
            <tr key={m.id}>
              <td className="px-4 py-3">
                <div className="font-medium">{m.titulo}</div>
                {m.descricao && <div className="mt-0.5 max-w-md text-xs text-stone-500">{m.descricao}</div>}
              </td>
              <td className="px-4 py-3">{m.area ?? "—"}</td>
              <td className="px-4 py-3 font-mono">{m.resultado}</td>
              <td className="px-4 py-3 font-mono">{m.esforco}</td>
              <td className="px-4 py-3"><Selo cor={q.cor}>{q.texto}</Selo></td>
              <td className="px-4 py-3"><Selo cor={SITUACAO[m.situacao][1]}>{SITUACAO[m.situacao][0]}</Selo></td>
              <td className="px-4 py-3 text-xs text-stone-500">{m.sugerido_por ?? "—"}<br />{data(m.criado_em)}</td>
              <td className="px-4 py-2">{admin && <AcoesLinha><LinkEditar id={m.id} /></AcoesLinha>}</td>
            </tr>
          );
        })}
      </Tabela>
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Alterar melhoria" descricao={emEdicao.titulo} aviso="Melhoria salva">
          <FormMelhoria m={emEdicao} admin={admin} />
        </JanelaEditar>
      )}
    </>
  );
}
