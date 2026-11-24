import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoCancelar, BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";
import { dataHora } from "@/lib/format";
import { excluirPolitica, salvarPolitica } from "./actions";

type Politica = { id: string; titulo: string; texto: string | null; ordem: number; alterado_por_nome: string | null; atualizado_em: string };

function FormPolitica({ p }: { p?: Politica }) {
  return (
    <form action={salvarPolitica.bind(null, p?.id ?? null)} className="grid gap-3">
      <Campo rotulo="Título *"><input name="titulo" required defaultValue={p?.titulo ?? ""} placeholder="Ex.: Uso do celular" className={inputCls} /></Campo>
      <Campo rotulo="Regra">
        <textarea name="texto" rows={8} defaultValue={p?.texto ?? ""} placeholder="Ex.: O celular fica no armário durante o trabalho na fábrica. Pode usar nos intervalos." className={inputCls} />
      </Campo>
      <div className="flex gap-2">
        <Botao type="submit">{p ? "Salvar alterações" : "Cadastrar política"}</Botao>
        {p && <BotaoCancelar />}
      </div>
    </form>
  );
}

/** Políticas da empresa: as regras de horário, intervalo, celular etc., num lugar só. */
export default async function PoliticasPage({ searchParams }: PageProps<"/funcionarios/politicas">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("politicas_empresa").select("*").order("ordem").order("criado_em");
  const politicas = (data ?? []) as Politica[];
  const emEdicao = typeof sp.editar === "string" ? politicas.find((p) => p.id === sp.editar) : undefined;
  const faltam = politicas.filter((p) => !p.texto).length;

  return (
    <>
      <Titulo
        sub="As regras da empresa para a equipe: horários, intervalos, local de almoço, uso do celular e banco de horas."
        acao={
          <JanelaBotao rotulo="Nova política" titulo="Nova política da empresa" aviso="Política cadastrada">
            <FormPolitica />
          </JanelaBotao>
        }
      >
        Políticas da empresa
      </Titulo>
      {faltam > 0 && <p className="mb-4 text-sm text-stone-500">{faltam} política(s) ainda sem texto. Clique no lápis para escrever.</p>}
      {!politicas.length && <Cartao><p className="text-sm text-stone-400">Nenhuma política cadastrada.</p></Cartao>}
      <div className="grid gap-4 md:grid-cols-2">
        {politicas.map((p) => (
          <Cartao key={p.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug">{p.titulo}</h3>
              {!p.texto && <Selo cor="amber">a escrever</Selo>}
            </div>
            {p.texto ? <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{p.texto}</p> : <p className="mt-2 text-sm text-stone-400">Ainda não escrita.</p>}
            <div className="mt-auto flex items-end justify-between gap-2 pt-4 text-xs text-stone-500">
              <div>Atualizada por <span className="font-medium text-stone-700">{p.alterado_por_nome ?? "—"}</span> em {dataHora(p.atualizado_em)}</div>
              <div className="flex gap-1.5">
                <LinkEditar id={p.id} />
                <BotaoExcluir acao={excluirPolitica.bind(null, p.id)} titulo="Excluir esta política?" detalhe={p.titulo} aviso="Política excluída" />
              </div>
            </div>
          </Cartao>
        ))}
      </div>
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Alterar política" descricao={emEdicao.titulo} aviso="Política salva">
          <FormPolitica p={emEdicao} />
        </JanelaEditar>
      )}
    </>
  );
}
