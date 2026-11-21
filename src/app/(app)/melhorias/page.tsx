import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoCancelar, JanelaEditar, LinkEditar } from "@/components/acoes";
import { perfilAtual } from "@/lib/perfil";
import { dataHora } from "@/lib/format";
import { alterarMelhoria, sugerirMelhoria } from "./actions";

type Melhoria = {
  id: string; titulo: string; descricao: string | null;
  situacao: "ideia" | "fazendo" | "feito" | "descartado"; sugerido_por: string | null; criado_em: string;
};

const SITUACAO = { ideia: ["Nova", "stone"], fazendo: ["Fazendo", "amber"], feito: ["Feito", "green"], descartado: ["Descartado", "red"] } as const;

function FormMelhoria({ m, admin }: { m?: Melhoria; admin: boolean }) {
  return (
    <form action={m ? alterarMelhoria.bind(null, m.id) : sugerirMelhoria} className="grid gap-3">
      <Campo rotulo="Título *"><input name="titulo" required defaultValue={m?.titulo ?? ""} placeholder="Ex.: Mostrar o telefone do cliente no pedido" className={inputCls} /></Campo>
      <Campo rotulo="Descrição"><textarea name="descricao" rows={5} defaultValue={m?.descricao ?? ""} placeholder="Explique o que você gostaria que mudasse" className={inputCls} /></Campo>
      {m && admin && (
        <Campo rotulo="Situação">
          <select name="situacao" defaultValue={m.situacao} className={inputCls}>
            {Object.entries(SITUACAO).map(([k, [r]]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
      )}
      {!m && <p className="text-xs text-stone-500">Seu nome e a data entram sozinhos.</p>}
      <div className="flex gap-2">
        <Botao type="submit">{m ? "Salvar alterações" : "Salvar anotação"}</Botao>
        {m && <BotaoCancelar />}
      </div>
    </form>
  );
}

export default async function MelhoriasPage({ searchParams }: PageProps<"/melhorias">) {
  const { editar, ver } = await searchParams;
  const admin = (await perfilAtual())?.papel === "admin";
  const supabase = await createClient();
  const { data: brutas } = await supabase
    .from("melhorias")
    .select("id, titulo, descricao, situacao, sugerido_por, criado_em")
    .order("criado_em", { ascending: false });
  const todas = (brutas ?? []) as Melhoria[];
  const verTodas = ver === "todas";
  const lista = verTodas ? todas : todas.filter((m) => m.situacao === "ideia" || m.situacao === "fazendo");
  const emEdicao = admin && typeof editar === "string" ? todas.find((m) => m.id === editar) : undefined;

  return (
    <>
      <Titulo sub="Anote aqui o que pode melhorar no sistema. As mais novas aparecem primeiro.">Melhorias</Titulo>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <a href={verTodas ? "/melhorias" : "/melhorias?ver=todas"} className="text-sm text-stone-500 hover:text-stone-800">
          {verTodas ? "Mostrar só as abertas" : `Mostrar também as feitas e descartadas (${todas.length - lista.length})`}
        </a>
        <JanelaBotao rotulo="Nova anotação" titulo="Nova anotação de melhoria" aviso="Anotação salva">
          <FormMelhoria admin={admin} />
        </JanelaBotao>
      </div>
      {!lista.length && <Cartao><p className="text-sm text-stone-400">Nenhuma anotação ainda. Clique em &quot;Nova anotação&quot; para escrever a primeira.</p></Cartao>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map((m) => (
          <Cartao key={m.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug">{m.titulo}</h3>
              <Selo cor={SITUACAO[m.situacao][1]}>{SITUACAO[m.situacao][0]}</Selo>
            </div>
            {m.descricao && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">{m.descricao}</p>}
            <div className="mt-auto flex items-end justify-between gap-2 pt-4 text-xs text-stone-500">
              <div>
                <div>Pedido por <span className="font-medium text-stone-700">{m.sugerido_por ?? "—"}</span></div>
                <div>{dataHora(m.criado_em)}</div>
              </div>
              {admin && <LinkEditar id={m.id} />}
            </div>
          </Cartao>
        ))}
      </div>
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} titulo="Alterar melhoria" descricao={emEdicao.titulo} aviso="Melhoria salva">
          <FormMelhoria m={emEdicao} admin={admin} />
        </JanelaEditar>
      )}
    </>
  );
}
