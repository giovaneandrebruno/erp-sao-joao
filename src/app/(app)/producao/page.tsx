import { connection } from "next/server";
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { FerramentasImportacao } from "@/components/importador";
import { createClient } from "@/lib/supabase/server";
import { BotaoLink, Cartao, Indicador, Titulo, inputCls } from "@/components/ui";
import { hojeISO } from "@/lib/format";
import { CAMPOS, GRUPOS, STATUS_PCP, situacaoPrazo, statusPcp, type Ordem } from "@/lib/pcp";
import { Legenda, PrazoSelo, SeloStatus, ValorMarco } from "./componentes";
import { QuadroArrastavel } from "./quadro";

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

function montarHref(atual: Busca, muda: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...atual, ...muda })) if (typeof v === "string" && v) p.set(k, v);
  const s = p.toString();
  return s ? `/producao?${s}` : "/producao";
}

export default async function ProducaoPage({ searchParams }: PageProps<"/producao">) {
  await connection(); // a data de hoje muda: a tela é sempre montada na hora
  const sp = (await searchParams) as Busca;
  const ver = um(sp.ver) || "quadro";
  const termo = um(sp.busca).trim();
  const filtroStatus = um(sp.status);
  const filtroPessoa = um(sp.pessoa);
  const filtroPrazo = um(sp.prazo);

  const supabase = await createClient();
  const { data } = await supabase
    .from("ordens_producao")
    .select("*")
    .order("ordem", { ascending: true, nullsFirst: false })
    .order("numero", { ascending: true });
  const todas = (data ?? []) as Ordem[];

  // pedidos com material reservado que o estoque não cobre
  const { data: emFalta } = await supabase.from("produtos_saldo").select("id").lt("livre", 0);
  const idsEmFalta = (emFalta ?? []).map((x) => x.id);
  const { data: materiaisEmFalta } = idsEmFalta.length
    ? await supabase.from("pedido_materiais").select("pedido_id").in("produto_id", idsEmFalta)
    : { data: [] };
  const faltaMaterial = [...new Set((materiaisEmFalta ?? []).map((m) => m.pedido_id as string))];
  const hoje = hojeISO();

  const ativas = todas.filter((o) => o.status_pcp !== "FIN");
  const atrasadas = ativas.filter((o) => situacaoPrazo(o, hoje).tipo === "atrasada");
  const proximas = ativas.filter((o) => situacaoPrazo(o, hoje).tipo === "proxima");
  const comPendencia = ativas.filter((o) => o.status_pcp === "IP" || o.status_pcp === "PP" || (o.pendencias && String(o.pendencias).toUpperCase().includes("PENDENTE")));

  const pessoas = [...new Set(todas.flatMap((o) => [o.consultor, o.resp_detalhamento, o.resp_fabricacao, o.montador])
    .flatMap((p) => String(p ?? "").split(/\s*[+/]\s*/))
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p && p !== "-"))].sort();

  let lista = ver === "concluidos" ? todas.filter((o) => o.status_pcp === "FIN") : ver === "planilha" ? todas : ativas;
  if (termo) {
    const t = termo.toLowerCase();
    lista = lista.filter((o) => [o.os, o.cliente_nome, o.ambiente, o.endereco, o.pendencias].some((x) => String(x ?? "").toLowerCase().includes(t)));
  }
  if (filtroStatus) lista = lista.filter((o) => o.status_pcp === filtroStatus);
  if (filtroPessoa) lista = lista.filter((o) => [o.consultor, o.resp_detalhamento, o.resp_fabricacao, o.montador, o.arquiteto].some((x) => String(x ?? "").toUpperCase().includes(filtroPessoa)));
  if (filtroPrazo) lista = lista.filter((o) => situacaoPrazo(o, hoje).tipo === filtroPrazo);

  const contagem: Record<string, number> = {};
  const base = ver === "concluidos" ? todas.filter((o) => o.status_pcp === "FIN") : ver === "planilha" ? todas : ativas;
  for (const s of STATUS_PCP) {
    const n = base.filter((o) => o.status_pcp === s.sigla).length;
    if (n) contagem[s.sigla] = n;
  }

  const abas = [
    { chave: "quadro", rotulo: "Quadro por etapa", n: ativas.length },
    { chave: "planilha", rotulo: "Planilha completa", n: todas.length },
    { chave: "concluidos", rotulo: "Concluídos", n: todas.length - ativas.length },
  ];

  return (
    <>
      <Titulo
        sub="Controle de produção no formato da planilha de PCP: legenda de status, colunas Comercial, Administrativo e Operacional e prazo de entrega calculado."
        acao={
          <div className="flex flex-wrap gap-2">
            <FerramentasImportacao area="producao" />
            <a href="/producao/exportar" download className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50">Baixar planilha</a>
            <BotaoLink href="/producao/nova">Nova OS</BotaoLink>
          </div>
        }
      >
        Produção
      </Titulo>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link href={montarHref({}, { ver: "quadro" })}><Indicador rotulo="Em andamento" valor={ativas.length} sub={`${todas.length} ordens no total`} /></Link>
        <Link href={montarHref({}, { ver: "quadro", prazo: "atrasada" })}><Indicador rotulo="Atrasadas" valor={atrasadas.length} cor={atrasadas.length ? "vermelho" : undefined} sub="Passaram da entrega limite" /></Link>
        <Link href={montarHref({}, { ver: "quadro", prazo: "proxima" })}><Indicador rotulo="Vencem em 7 dias" valor={proximas.length} sub="Entregas da semana" /></Link>
        <Link href={montarHref({}, { ver: "quadro", status: "IP" })}><Indicador rotulo="Pendências" valor={comPendencia.length} sub="Itens pendentes ou parados" /></Link>
        <Link href={montarHref({}, { ver: "concluidos" })}><Indicador rotulo="Concluídas" valor={todas.length - ativas.length} cor="verde" sub="Status FIN" /></Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-200">
        {abas.map((a) => (
          <Link
            key={a.chave}
            href={montarHref({}, { ver: a.chave === "quadro" ? undefined : a.chave })}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${ver === a.chave ? "border-azul text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
          >
            {a.rotulo} <span className="ml-1 rounded bg-stone-100 px-1.5 font-mono text-[11px] text-stone-500">{a.n}</span>
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        {ver !== "quadro" && <input type="hidden" name="ver" value={ver} />}
        {filtroStatus && <input type="hidden" name="status" value={filtroStatus} />}
        <input name="busca" defaultValue={termo} placeholder="Buscar cliente, OS, ambiente, endereço…" className={`${inputCls} w-full max-w-xs`} />
        <select name="pessoa" defaultValue={filtroPessoa} className={inputCls}>
          <option value="">Todas as pessoas</option>
          {pessoas.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select name="prazo" defaultValue={filtroPrazo} className={inputCls}>
          <option value="">Qualquer prazo</option>
          <option value="atrasada">Atrasadas</option>
          <option value="proxima">Vencem em 7 dias</option>
          <option value="no_prazo">No prazo</option>
          <option value="sem_prazo">Sem prazo definido</option>
        </select>
        <button className="rounded-lg bg-marinho px-3 py-2 text-sm font-semibold text-white hover:bg-marinho-claro">Filtrar</button>
        {(termo || filtroPessoa || filtroPrazo || filtroStatus) && <Link href={montarHref({}, { ver: ver === "quadro" ? undefined : ver })} className="text-sm text-madeira-700 hover:underline">Limpar filtros</Link>}
      </form>

      <div className="mb-5">
        <Legenda contagem={contagem} ativo={filtroStatus || undefined} href={(s) => montarHref(sp, { status: s })} />
      </div>

      {ver === "quadro" ? lista.length ? <QuadroArrastavel ordens={lista} hoje={hoje} concluidas={todas.length - ativas.length} faltaMaterial={faltaMaterial} /> : <Cartao><p className="text-center text-sm text-stone-400">Nenhuma ordem de serviço com esses filtros.</p></Cartao> : <PlanilhaOs ordens={lista} hoje={hoje} />}
    </>
  );
}

const COR_GRUPO: Record<string, string> = { Comercial: "bg-[#fde7d3]", Administrativo: "bg-[#e3ecfb]", Operacional: "bg-[#dff3ea]" };

/** A planilha inteira, com as mesmas colunas e a linha pintada pela cor do status. */
function PlanilhaOs({ ordens, hoje }: { ordens: Ordem[]; hoje: string }) {
  const cols = CAMPOS;
  const qtdPorGrupo = GRUPOS.map((g) => ({ g, n: cols.filter((c) => c.grupo === g).length + (g === "Comercial" ? 1 : 0) }));
  return (
    <div className="vidro max-h-[70vh] overflow-auto rounded-2xl">
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-20">
          <tr>
            {qtdPorGrupo.map(({ g, n }) => (
              <th key={g} colSpan={n} className={`${COR_GRUPO[g]} border-b border-stone-200 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.4em] text-stone-600`}>{g}</th>
            ))}
          </tr>
          <tr className="bg-stone-50">
            {cols.map((c, i) => (
              <Fragment key={c.chave}>
                <th className={`border-b border-stone-200 bg-stone-50 px-3 py-2 align-bottom text-[10px] font-semibold uppercase leading-tight tracking-wide text-stone-500 ${i < 2 ? "sticky z-10" : ""} ${i === 0 ? "left-0 min-w-20" : i === 1 ? "left-20 min-w-56" : "min-w-24 max-w-40"}`}>{c.rotulo}</th>
                {c.chave === "prazo_texto" && <th className="border-b border-stone-200 bg-stone-50 px-3 py-2 align-bottom text-[10px] font-semibold uppercase tracking-wide text-azul">Entrega limite</th>}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordens.map((o) => {
            const s = statusPcp(o.status_pcp);
            const fundo = `${s.cor}30`;
            return (
              <tr key={o.id} className="group">
                {cols.map((c, i) => {
                  const fixo = i < 2 ? `sticky z-10 ${i === 0 ? "left-0" : "left-20"}` : "";
                  let conteudo: ReactNode;
                  if (c.chave === "cliente_nome") conteudo = <Link href={`/producao/${o.id}`} className="font-semibold text-stone-900 hover:underline">{o.cliente_nome}</Link>;
                  else if (c.chave === "status_pcp") conteudo = <SeloStatus sigla={o.status_pcp} />;
                  else if (c.tipo === "marco" || c.chave === "data_venda") conteudo = <ValorMarco valor={c.chave === "data_venda" ? o.data_venda ?? o.data_venda_obs : o[c.chave]} hoje={hoje} compacto />;
                  else conteudo = o[c.chave] ? <span className={c.tipo === "longo" ? "line-clamp-2 min-w-48 whitespace-normal" : ""}>{String(o[c.chave])}</span> : <span className="text-stone-300">·</span>;
                  return (
                    <Fragment key={c.chave}>
                      <td className={`whitespace-nowrap border-b border-white px-3 py-1.5 ${fixo}`} style={{ background: i < 2 ? `color-mix(in srgb, ${s.cor} 19%, white)` : fundo }}>{conteudo}</td>
                      {c.chave === "prazo_texto" && <td className="whitespace-nowrap border-b border-white px-3 py-1.5" style={{ background: fundo }}><PrazoSelo ordem={o} hoje={hoje} /></td>}
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!ordens.length && <p className="p-8 text-center text-sm text-stone-400">Nenhuma ordem de serviço com esses filtros.</p>}
    </div>
  );
}
