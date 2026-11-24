import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Selo, Titulo } from "@/components/ui";
import { BotaoExcluir, JanelaEditar, LinkEditar } from "@/components/acoes";
import { data, hojeISO } from "@/lib/format";
import { TIPOS_REUNIAO, ordinal, type Acao, type Reuniao } from "@/lib/reunioes";
import { excluirReuniao } from "../actions";
import { FormAcao, FormReuniao, ListaDePessoas, TabelaDeAcoes } from "../componentes";
import { nomesDaEquipe } from "../dados";

/**
 * Ata de uma reunião: as ações combinadas nela e as pendências que vieram das reuniões anteriores
 * (tudo que ainda não estava resolvido no dia desta reunião).
 */
export default async function ReuniaoPage({ params, searchParams }: PageProps<"/reunioes/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const hoje = hojeISO();
  const { data: bruta } = await supabase.from("reunioes").select("*").eq("id", id).maybeSingle();
  if (!bruta) notFound();
  const r = bruta as Reuniao;

  const [{ data: anteriores }, { data: minhas }, nomes] = await Promise.all([
    supabase.from("reunioes").select("id, numero, data").or(`data.lt.${r.data},and(data.eq.${r.data},numero.lt.${r.numero})`).limit(1000),
    supabase.from("reuniao_acoes").select("*").eq("reuniao_id", id).order("criado_em"),
    nomesDaEquipe(),
  ]);
  const mapa = new Map((anteriores ?? []).filter((x) => x.id !== r.id).map((x) => [x.id, x]));
  const { data: herdadasBrutas } = mapa.size
    ? await supabase
        .from("reuniao_acoes")
        .select("*")
        .in("reuniao_id", [...mapa.keys()])
        .or(`situacao.neq.ok,concluida_em.gte.${r.data}`)
        .order("prazo", { ascending: true, nullsFirst: false })
        .limit(2000)
    : { data: [] };
  const acoes = (minhas ?? []) as Acao[];
  const herdadas = ((herdadasBrutas ?? []) as Acao[]).filter((a) => mapa.has(a.reuniao_id) && (a.situacao !== "ok" || (a.concluida_em ?? "") >= r.data)).sort((a, b) => (mapa.get(a.reuniao_id)?.numero ?? 0) - (mapa.get(b.reuniao_id)?.numero ?? 0));
  const responsaveis = [...nomes, ...acoes.map((a) => a.responsavel ?? ""), ...herdadas.map((a) => a.responsavel ?? "")].filter(Boolean);

  const emEdicao = typeof sp.acao === "string" ? [...acoes, ...herdadas].find((a) => a.id === sp.acao) : undefined;
  const horario = [r.inicio?.slice(0, 5), r.termino?.slice(0, 5)].filter(Boolean).join(" às ");

  return (
    <>
      <Titulo
        sub={<Link href="/reunioes" className="hover:text-stone-800">← Todas as reuniões</Link>}
        acao={
          <div className="flex items-center gap-2">
            <LinkEditar id="reuniao" param="editar" />
            <BotaoExcluir acao={excluirReuniao.bind(null, id)} titulo="Excluir esta reunião?" detalhe="As ações combinadas nela também são excluídas." aviso="Reunião excluída" depois="/reunioes" />
          </div>
        }
      >
        {ordinal(r.numero)} {TIPOS_REUNIAO[r.tipo].toLowerCase()} · {data(r.data)}
      </Titulo>

      <Cartao className="mb-8">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><div className="text-xs text-stone-500">Assunto</div><div className="font-medium">{r.assunto || "—"}</div></div>
          <div><div className="text-xs text-stone-500">Participantes</div><div className="font-medium">{r.participantes || "—"}</div></div>
          <div><div className="text-xs text-stone-500">Local</div><div className="font-medium">{r.local || "—"}</div></div>
          <div><div className="text-xs text-stone-500">Horário</div><div className="font-medium">{horario || "—"}</div></div>
        </div>
        {r.anotacoes && <p className="mt-4 whitespace-pre-wrap border-t border-stone-100 pt-4 text-sm text-stone-700">{r.anotacoes}</p>}
      </Cartao>

      <ListaDePessoas id="pessoas-reuniao" nomes={responsaveis} />

      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Ações desta reunião <span className="text-stone-400">({acoes.length})</span></h2>
      </div>
      <Cartao className="mb-4">
        <FormAcao reuniaoId={id} listaPessoas="pessoas-reuniao" />
      </Cartao>
      <div className="mb-10">
        <TabelaDeAcoes acoes={acoes} hoje={hoje} vazio="Nenhuma ação nova nesta reunião ainda. Escreva acima a primeira." />
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Pendências das reuniões anteriores <span className="text-stone-400">({herdadas.length})</span></h2>
        <span className="text-sm text-stone-500">O que ainda não estava resolvido no dia desta reunião. Marque <Selo cor="green">OK</Selo> quando resolver.</span>
      </div>
      <TabelaDeAcoes acoes={herdadas} hoje={hoje} reunioes={mapa} mostrarOrigem vazio="Nenhuma pendência das reuniões anteriores." />

      {sp.editar === "reuniao" && (
        <JanelaEditar titulo="Alterar reunião" descricao={`${ordinal(r.numero)} · ${data(r.data)}`} aviso="Reunião salva">
          <FormReuniao r={r} />
        </JanelaEditar>
      )}
      {emEdicao && (
        <JanelaEditar key={emEdicao.id} param="acao" titulo="Alterar ação" aviso="Ação salva">
          <FormAcao reuniaoId={emEdicao.reuniao_id} a={emEdicao} listaPessoas="pessoas-reuniao" />
        </JanelaEditar>
      )}
    </>
  );
}
