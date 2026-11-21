import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Selo, Titulo, estiloBotao, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { BotaoExcluir } from "@/components/acoes";
import { Icone } from "@/components/icones";
import { dataHora } from "@/lib/format";
import { BUCKET_CURRICULOS, corDaIdade, ehUuid, haQuantoTempo, tamanhoLegivel, tipoDeVisualizacao } from "@/lib/curriculos";
import { FormCurriculo } from "../form";
import { adicionarAnotacaoCurriculo, editarAnotacaoCurriculo, excluirAnotacaoCurriculo, excluirCurriculo } from "../actions";

/** O currículo aberto na tela (PDF ou foto) com as anotações da equipe ao lado. */
export default async function CurriculoPage({ params }: PageProps<"/curriculos/[id]">) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: c }, { data: anotacoes }] = await Promise.all([
    supabase.from("curriculos").select("*").eq("id", id).maybeSingle(),
    supabase.from("curriculo_anotacoes").select("id, texto, criado_por_nome, alterado_por_nome, criado_em, atualizado_em").eq("curriculo_id", id).order("criado_em", { ascending: false }),
  ]);
  if (!c) notFound();
  // link para abrir o arquivo da pasta privada (vale 1 hora)
  const { data: link } = await supabase.storage.from(BUCKET_CURRICULOS).createSignedUrl(c.caminho, 3600);
  const url = link?.signedUrl ?? null;
  const ver = tipoDeVisualizacao(c.nome_arquivo, c.tipo_arquivo);
  const trocouArquivo = c.atualizado_em && new Date(c.atualizado_em).getTime() - new Date(c.criado_em).getTime() > 60_000;

  return (
    <>
      <div className="mb-2 text-sm"><Link href="/curriculos" className="text-madeira-700 hover:underline">← Todos os currículos</Link></div>
      <Titulo
        sub={[c.vaga, c.telefone, c.email].filter(Boolean).join(" · ") || undefined}
        acao={
          <div className="flex flex-wrap items-center gap-2">
            {url && <a href={url} target="_blank" rel="noreferrer" className={estiloBotao.secundario}>Abrir em outra aba</a>}
            <JanelaBotao rotulo="Alterar" titulo="Alterar currículo" descricao={c.nome} variante="secundario" icone="lapis" largura="md" aviso={null}>
              <FormCurriculo curriculo={c} />
            </JanelaBotao>
            <BotaoExcluir acao={excluirCurriculo.bind(null, c.id)} rotulo="Excluir" titulo="Excluir este currículo?" detalhe={<><strong>{c.nome}</strong>. O arquivo e as anotações também são apagados.</>} aviso="Currículo excluído" depois="/curriculos" />
          </div>
        }
      >
        {c.nome}
      </Titulo>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-madeira-50 text-madeira-700 ring-1 ring-inset ring-madeira-200">
              <Icone nome="documento" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-stone-800">{c.nome_arquivo}</div>
              <div className="mt-0.5 text-xs text-stone-500">
                Salvo em {dataHora(c.criado_em)}{c.enviado_por_nome && !trocouArquivo ? `, por ${c.enviado_por_nome}` : ""}
                {tamanhoLegivel(c.tamanho) && <> · {tamanhoLegivel(c.tamanho)}</>}
                {trocouArquivo && <> · alterado em {dataHora(c.atualizado_em)}{c.enviado_por_nome ? `, por ${c.enviado_por_nome}` : ""}</>}
              </div>
            </div>
            <Selo cor={corDaIdade(c.criado_em)}>{haQuantoTempo(c.criado_em)}</Selo>
          </div>

          {!url ? (
            <p className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">Não foi possível abrir o arquivo agora. Atualize a página e tente de novo.</p>
          ) : ver === "pdf" ? (
            <iframe src={url} title={`Currículo de ${c.nome}`} className="h-[75vh] w-full rounded-xl bg-stone-50 ring-1 ring-stone-200" />
          ) : ver === "imagem" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Currículo de ${c.nome}`} className="mx-auto max-h-[75vh] rounded-xl ring-1 ring-stone-200" />
          ) : (
            <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-500">
              Este tipo de arquivo não abre aqui na tela.
              <div className="mt-3"><a href={url} target="_blank" rel="noreferrer" className={estiloBotao.primario}>Baixar o arquivo</a></div>
            </div>
          )}
        </Cartao>

        <Cartao className="self-start">
          <h3 className="mb-3 text-sm font-semibold text-stone-800">Anotações</h3>
          <form action={adicionarAnotacaoCurriculo.bind(null, c.id)} className="mb-4 grid gap-2">
            <textarea name="texto" required rows={3} placeholder="Ex.: ligou dia 20, tem experiência com montagem, entrevista marcada…" className={inputCls} />
            <button className={`${estiloBotao.primario} justify-self-end`}>Adicionar anotação</button>
          </form>
          {anotacoes?.length ? (
            <ul className="grid gap-3">
              {anotacoes.map((a) => (
                <li key={a.id} className="rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
                  <p className="whitespace-pre-line text-sm text-stone-800">{a.texto}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-stone-500">
                      {a.criado_por_nome ?? "Equipe"} · {dataHora(a.criado_em)}
                      {a.alterado_por_nome && a.atualizado_em !== a.criado_em ? ` · alterada por ${a.alterado_por_nome}` : ""}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <JanelaBotao rotulo="Alterar" titulo="Alterar anotação" variante="link" icone={null} largura="sm" aviso="Anotação alterada" className="!text-xs">
                        <form action={editarAnotacaoCurriculo.bind(null, a.id, c.id)} className="grid gap-3">
                          <textarea name="texto" required rows={6} defaultValue={a.texto} className={inputCls} />
                          <button className={`${estiloBotao.primario} justify-self-end`}>Salvar</button>
                        </form>
                      </JanelaBotao>
                      <BotaoExcluir acao={excluirAnotacaoCurriculo.bind(null, a.id, c.id)} titulo="Excluir esta anotação?" aviso="Anotação excluída" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-stone-400">Nenhuma anotação ainda.</p>
          )}
        </Cartao>
      </div>
    </>
  );
}
