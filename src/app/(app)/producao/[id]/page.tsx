import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Cartao, Titulo, inputCls } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { data, hojeISO } from "@/lib/format";
import { CAMPOS, GRUPOS, POSICOES, STATUS_PCP, lerMarco, progresso, situacaoPrazo, statusPcp, textoDias, vizinho, type Ordem } from "@/lib/pcp";
import { PrazoSelo, SeloStatus, ValorMarco } from "../componentes";
import { FormOrdem } from "../form";
import { anotar, moverStatus, mudarStatus } from "../actions";

export default async function OrdemPage({ params }: PageProps<"/producao/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: ordem }, { data: historico }, { data: clientes }] = await Promise.all([
    supabase.from("ordens_producao").select("*, pedidos(numero)").eq("id", id).maybeSingle(),
    supabase.from("producao_historico").select("*").eq("ordem_id", id).order("criado_em", { ascending: false }).limit(50),
    supabase.from("clientes").select("id, nome").order("nome"),
  ]);
  if (!ordem) notFound();
  const o = ordem as Ordem & { pedidos: { numero: number } | null };
  const hoje = hojeISO();
  const s = statusPcp(o.status_pcp);
  const prazo = situacaoPrazo(o, hoje);
  const prog = progresso(o, hoje);
  const ant = vizinho(o.status_pcp, -1);
  const prox = vizinho(o.status_pcp, 1);
  const outras = o.cliente_id
    ? (await supabase.from("ordens_producao").select("id, os, cliente_nome, status_pcp").eq("cliente_id", o.cliente_id).neq("id", id).order("ordem")).data ?? []
    : [];

  return (
    <>
      <Link href="/producao" className="mb-3 inline-block text-sm text-madeira-700 hover:underline">← Produção</Link>
      <Titulo
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {o.os ? <span className="font-mono">OS {o.os}</span> : <span>OS sem número</span>}
            {o.cliente_id && <Link href={`/clientes/${o.cliente_id}`} className="text-madeira-700 hover:underline">ver cadastro do cliente</Link>}
            {o.pedidos && <Link href={`/pedidos/${o.pedido_id}`} className="text-madeira-700 hover:underline">Pedido #{o.pedidos.numero}</Link>}
          </span>
        }
        acao={
          <JanelaBotao rotulo="Editar todas as colunas" titulo="Editar ordem de serviço" descricao={String(o.cliente_nome ?? "")} variante="secundario" icone={null} largura="xl">
            <FormOrdem ordem={o} clientes={clientes ?? []} hoje={hoje} />
          </JanelaBotao>
        }
      >
        {o.cliente_nome}
        <SeloStatus sigla={o.status_pcp} nome grande />
      </Titulo>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Etapa atual</div>
              <div className="mt-1 text-lg font-semibold" style={{ color: s.cor === "#FFFF00" ? "#8a7a00" : undefined }}>{s.nome}</div>
              <div className="text-sm text-stone-500">Posição: <b className="text-stone-800">{o.posicao ?? "—"}</b> · fase {s.fase}</div>
            </div>
            <div className="flex gap-2">
              <form action={moverStatus.bind(null, o.id, -1)}><Botao variante="secundario" disabled={!ant}>← {ant ?? "Voltar"}</Botao></form>
              <form action={moverStatus.bind(null, o.id, 1)}><Botao disabled={!prox}>Avançar para {prox ?? "—"} →</Botao></form>
            </div>
          </div>
          <EtapasLinha atual={o.status_pcp} />
          <form action={mudarStatus.bind(null, o.id)} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
            <select name="status_pcp" defaultValue={o.status_pcp} className={inputCls}>
              {STATUS_PCP.map((x) => <option key={x.sigla} value={x.sigla}>{x.sigla} · {x.nome}</option>)}
            </select>
            <input name="posicao" list="posicoes-ficha" defaultValue={String(o.posicao ?? "")} placeholder="Posição" className={inputCls} />
            <datalist id="posicoes-ficha">{POSICOES.map((p) => <option key={p} value={p} />)}</datalist>
            <input name="nota" placeholder="Anotação (opcional)" className={inputCls} />
            <Botao type="submit" variante="secundario">Mudar</Botao>
          </form>
        </Cartao>

        <Cartao>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Prazo de entrega</div>
          <div className="mt-2 space-y-1.5 text-sm">
            <Linha r="Data da venda" v={o.data_venda ? data(String(o.data_venda)) : String(o.data_venda_obs ?? "—")} />
            <Linha r="Prazo a cumprir" v={String(o.prazo_texto ?? (o.prazo_dias ? `${o.prazo_dias} dias` : "—"))} />
            <Linha r="Entrega limite" v={prazo.limite ? data(prazo.limite) : "—"} forte />
          </div>
          <div className="mt-3"><PrazoSelo ordem={o} hoje={hoje} /></div>
          {prazo.tipo === "sem_prazo" && <p className="mt-2 text-xs text-stone-500">Informe a data da venda e o prazo em dias para o sistema calcular a entrega limite.</p>}
          {prazo.dias !== null && <p className="mt-2 text-xs text-stone-500">{textoDias(prazo.dias)}</p>}
          <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500">Etapas concluídas</div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-neon" style={{ width: `${(prog.feitos / prog.total) * 100}%` }} /></div>
            <span className="font-mono text-xs text-stone-600">{prog.feitos}/{prog.total}</span>
          </div>
        </Cartao>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {GRUPOS.map((g) => (
          <Cartao key={g}>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-stone-500">{g}</h2>
            <dl className="divide-y divide-stone-100 text-sm">
              {CAMPOS.filter((c) => c.grupo === g && c.chave !== "cliente_nome" && c.chave !== "status_pcp").map((c) => {
                const valor = c.chave === "data_venda" ? o.data_venda ?? o.data_venda_obs : o[c.chave];
                const marco = c.tipo === "marco" ? lerMarco(valor) : null;
                return (
                  <div key={c.chave} className="flex items-start justify-between gap-3 py-1.5">
                    <dt className="flex items-center gap-2 text-stone-500">
                      {marco && <Bolinha estado={marco.estado} />}
                      {c.rotulo}
                    </dt>
                    <dd className="max-w-[55%] text-right text-stone-800">
                      {c.tipo === "marco" || c.chave === "data_venda" ? <ValorMarco valor={valor} hoje={hoje} /> : valor ? String(valor) : <span className="text-stone-300">—</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Cartao>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Histórico</h2>
          <form action={anotar.bind(null, o.id)} className="mb-4 flex gap-2">
            <input name="nota" placeholder="Escreva uma anotação sobre esta OS" className={`${inputCls} flex-1`} />
            <Botao type="submit" variante="secundario">Anotar</Botao>
          </form>
          <ol className="space-y-2 text-sm">
            {(historico ?? []).map((h) => (
              <li key={h.id} className="flex gap-3">
                <span className="w-28 shrink-0 font-mono text-xs text-stone-400">{new Date(h.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
                <span className="text-stone-700">
                  {h.status_para && (h.status_de ? <>Status <b>{h.status_de}</b> → <b>{h.status_para}</b></> : <>Entrou como <b>{h.status_para}</b></>)}
                  {h.posicao && <> · {h.posicao}</>}
                  {h.nota && <span className="block text-stone-600">{h.nota}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Cartao>
        <Cartao>
          <h2 className="mb-3 text-base font-semibold">Outras OS deste cliente</h2>
          {outras.length ? (
            <ul className="space-y-1.5 text-sm">
              {outras.map((x) => (
                <li key={x.id} className="flex items-center gap-2">
                  <SeloStatus sigla={x.status_pcp} />
                  <Link href={`/producao/${x.id}`} className="text-madeira-700 hover:underline">{x.cliente_nome}</Link>
                  {x.os && <span className="ml-auto font-mono text-xs text-stone-400">{x.os}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-400">Nenhuma outra.</p>
          )}
        </Cartao>
      </div>
    </>
  );
}

function Linha({ r, v, forte }: { r: string; v: string; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-stone-500">{r}</span>
      <span className={forte ? "font-semibold text-stone-900" : "text-stone-800"}>{v}</span>
    </div>
  );
}

function Bolinha({ estado }: { estado: string }) {
  const cor = estado === "feito" || estado === "nao_se_aplica" ? "bg-neon" : estado === "data" ? "bg-azul" : estado === "duvida" ? "bg-amber-400" : estado === "pendente" ? "bg-rosa" : "bg-stone-200";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${cor}`} />;
}

/** Faixa com a sequência da legenda, destacando onde a OS está. */
function EtapasLinha({ atual }: { atual: string }) {
  const sequencia = STATUS_PCP.filter((x) => x.sigla !== "IP" && x.sigla !== "PP");
  const pos = sequencia.findIndex((x) => x.sigla === atual);
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto">
      {sequencia.map((x, i) => (
        <div key={x.sigla} title={x.nome} className="min-w-14 flex-1">
          <div className="h-2 rounded-full" style={{ background: pos >= 0 && i <= pos ? x.cor : "#e1e7ef", outline: i === pos ? "2px solid #13294b" : undefined, outlineOffset: 1 }} />
          <div className={`mt-1 text-center text-[10px] ${i === pos ? "font-bold text-stone-900" : "text-stone-400"}`}>{x.sigla}</div>
        </div>
      ))}
      {(atual === "IP" || atual === "PP") && <div className="ml-2 self-start"><SeloStatus sigla={atual} nome /></div>}
    </div>
  );
}
