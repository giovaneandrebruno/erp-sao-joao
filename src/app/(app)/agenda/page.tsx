import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Titulo } from "@/components/ui";
import { ROTULOS2, hojeISO } from "@/lib/format";
import { JanelaBotao } from "@/components/janela";
import { baixarAgenda, lerAgenda } from "@/lib/ics";
import { AgendaLigada, LigarGoogle } from "./google";
import { CORES_AGENDA } from "@/lib/cores-agenda";
import { perfilAtual } from "@/lib/perfil";

type Evento = {
  data: string;
  hora?: string;
  titulo: string;
  sub: string;
  href: string;
  tipo: "marco" | "chamado" | "venda" | "google";
  externo?: boolean;
  cor?: string;
  feito?: boolean;
  atrasado?: boolean;
};

type Vista = "mes" | "semana" | "dia";

const COR = {
  marco: "bg-violeta/10 text-violeta",
  chamado: "bg-rosa/10 text-rosa",
  venda: "bg-ciano/10 text-[#0089a8]",
  google: "",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const SEMANA_LONGA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/* datas no formato AAAA-MM-DD, contadas em UTC para não sofrer com fuso */
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const isoDe = (t: number) => new Date(t).toISOString().slice(0, 10);
const somar = (d: string, dias: number) => isoDe(ms(d) + dias * 86_400_000);
const diaSemana = (d: string) => new Date(ms(d)).getUTCDay();
/** Posição na semana começando na segunda: segunda = 0 … domingo = 6. */
const posSemana = (d: string) => (diaSemana(d) + 6) % 7;
const somarMeses = (d: string, n: number) => {
  const x = new Date(ms(d));
  return isoDe(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + n, 1));
};
const diaMes = (d: string) => `${Number(d.slice(8))} de ${MESES[Number(d.slice(5, 7)) - 1]}`;

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  await connection(); // a data de hoje muda: a tela é sempre montada na hora
  const sp = await searchParams;
  const hoje = hojeISO();
  const txt = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : null);

  // como ver: semana (padrão), mês ou dia, a partir da data de referência
  const vista: Vista = txt("vista") === "mes" || txt("vista") === "dia" ? (txt("vista") as Vista) : "semana";
  const antigoMes = txt("mes"); // links antigos usavam ?mes=AAAA-MM
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(txt("d") ?? "") ? txt("d")! : antigoMes && /^\d{4}-\d{2}$/.test(antigoMes) ? `${antigoMes}-01` : hoje;
  const resp = txt("resp");
  const ag = txt("ag"); // null = todas, "sistema" = só do sistema, ou o id de uma agenda do Google

  let inicio: string, fim: string;
  if (vista === "mes") {
    inicio = `${ref.slice(0, 7)}-01`;
    fim = somar(somarMeses(inicio, 1), -1);
  } else if (vista === "semana") {
    inicio = somar(ref, -posSemana(ref));
    fim = somar(inicio, 6);
  } else {
    inicio = fim = ref;
  }
  const anterior = vista === "mes" ? somarMeses(inicio, -1) : somar(ref, vista === "semana" ? -7 : -1);
  const proximo = vista === "mes" ? somarMeses(inicio, 1) : somar(ref, vista === "semana" ? 7 : 1);
  const titulo =
    vista === "mes"
      ? `${MESES[Number(inicio.slice(5, 7)) - 1]} ${inicio.slice(0, 4)}`
      : vista === "semana"
        ? inicio.slice(5, 7) === fim.slice(5, 7)
          ? `${Number(inicio.slice(8))} a ${diaMes(fim)} ${fim.slice(0, 4)}`
          : `${diaMes(inicio)} a ${diaMes(fim)} ${fim.slice(0, 4)}`
        : `${SEMANA_LONGA[diaSemana(ref)]}, ${diaMes(ref)} ${ref.slice(0, 4)}`;
  const estaNoPeriodo = hoje >= inicio && hoje <= fim;

  const link = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const atual: Record<string, string | null> = { vista, d: ref, resp, ag, ...mudar };
    for (const [k, v] of Object.entries(atual)) if (v && !(k === "vista" && v === "semana")) p.set(k, v);
    return `/agenda?${p}`;
  };

  const supabase = await createClient();
  const ehAdmin = (await perfilAtual())?.papel === "admin";
  const verSistema = ag === null || ag === "sistema";
  let qm = supabase
    .from("pedido_marcos")
    .select("id, tipo, previsto, realizado, pedido_id, responsavel:responsavel_id(nome), pedidos!inner(numero, status, clientes(nome))")
    .gte("previsto", inicio).lte("previsto", fim)
    .neq("pedidos.status", "cancelado");
  let qc = supabase.from("chamados").select("id, numero, status, data_agendada, responsavel:responsavel_id(nome), clientes(nome)").gte("data_agendada", inicio).lte("data_agendada", fim);
  let qn = supabase.from("negociacoes").select("id, titulo, proxima_acao, proxima_acao_data, vendedor:vendedor_id(nome), clientes(nome)").gte("proxima_acao_data", inicio).lte("proxima_acao_data", fim).not("etapa", "in", "(ganho,perdido)");
  if (resp) {
    qm = qm.eq("responsavel_id", resp);
    qc = qc.eq("responsavel_id", resp);
    qn = qn.eq("vendedor_id", resp);
  }
  const vazio = Promise.resolve({ data: [] as never[] });
  const [{ data: marcos }, { data: chamados }, { data: negs }, { data: pessoas }, { data: agendas }] = await Promise.all([
    verSistema ? qm : vazio,
    verSistema ? qc : vazio,
    verSistema ? qn : vazio,
    supabase.from("parceiros").select("id, nome, tipo").in("tipo", ["montador", "vendedor"]).eq("ativo", true).order("nome"),
    // agendas do Google da empresa: toda a equipe vê, só o administrador liga e desliga
    supabase.from("agendas_google").select("id, nome, url, cor").order("criado_em"),
  ]);

  // compromissos do Google Agenda: baixados na hora, direto do Google (só as agendas filtradas)
  const visiveis = resp || ag === "sistema" ? [] : (agendas ?? []).filter((a) => !ag || a.id === ag);
  const arquivos = await Promise.all(visiveis.map((a) => baixarAgenda(a.url)));
  const comFalha = visiveis.filter((_, i) => !arquivos[i]).map((a) => a.nome);
  const doGoogle = arquivos.flatMap((t, i) => (t ? lerAgenda(t, inicio, fim).map((e) => ({ ...e, agenda: visiveis[i] })) : []));

  const nome = (x: unknown) => (x as { nome: string } | null)?.nome ?? "";
  const eventos: Evento[] = [
    ...(marcos ?? []).map((mm) => {
      const p = mm.pedidos as unknown as { numero: number; clientes: { nome: string } };
      return {
        data: mm.previsto!,
        titulo: `${ROTULOS2.marco[mm.tipo as keyof typeof ROTULOS2.marco]} · ${p.clientes?.nome}`,
        sub: [`pedido #${p.numero}`, nome(mm.responsavel)].filter(Boolean).join(" · "),
        href: `/pedidos/${mm.pedido_id}`,
        tipo: "marco" as const,
        feito: Boolean(mm.realizado),
        atrasado: !mm.realizado && mm.previsto! < hoje,
      };
    }),
    ...(chamados ?? []).map((c) => ({
      data: c.data_agendada!,
      titulo: `Assistência · ${nome(c.clientes)}`,
      sub: [`#${c.numero}`, nome(c.responsavel)].filter(Boolean).join(" · "),
      href: `/assistencia`,
      tipo: "chamado" as const,
      feito: c.status === "resolvido",
      atrasado: c.status !== "resolvido" && c.data_agendada! < hoje,
    })),
    ...(negs ?? []).map((n) => ({
      data: n.proxima_acao_data!,
      titulo: `${n.proxima_acao ?? "Retorno"} · ${nome(n.clientes)}`,
      sub: [n.titulo, nome(n.vendedor)].filter(Boolean).join(" · "),
      href: `/crm/${n.id}`,
      tipo: "venda" as const,
      atrasado: n.proxima_acao_data! < hoje,
    })),
    ...doGoogle.map((g) => ({
      data: g.data,
      hora: g.hora ?? undefined,
      titulo: g.titulo,
      sub: [g.agenda.nome, g.local].filter(Boolean).join(" · "),
      cor: g.agenda.cor as string,
      href: `https://calendar.google.com/calendar/r/day/${g.data.replaceAll("-", "/")}`,
      tipo: "google" as const,
      externo: true,
    })),
  ];
  eventos.sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? "").localeCompare(b.hora ?? ""));

  // a legenda só mostra o que tem compromisso no período
  const temTipo = new Set(eventos.map((e) => e.tipo));
  const agendasComEvento = (agendas ?? []).filter((a) => doGoogle.some((g) => g.agenda.id === a.id));
  const usadas = new Set((agendas ?? []).map((a) => a.cor));
  const proximaCor = CORES_AGENDA.find((c) => !usadas.has(c.cor))?.cor;
  const estilo = (e: Evento) => (e.cor ? { backgroundColor: `${e.cor}1f`, color: e.cor, boxShadow: `inset 3px 0 0 ${e.cor}` } : undefined);
  const externo = (e: Evento) => (e.externo ? { target: "_blank", rel: "noreferrer" } : {});
  const classe = (e: Evento) => `${COR[e.tipo]} ${e.feito ? "line-through opacity-50" : ""} ${e.atrasado ? "ring-1 ring-rosa" : ""}`;

  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e]);

  const dias = Array.from({ length: Math.round((ms(fim) - ms(inicio)) / 86_400_000) + 1 }, (_, i) => somar(inicio, i));
  const celulasMes: (string | null)[] = [...Array.from({ length: posSemana(inicio) }, () => null), ...dias];
  while (celulasMes.length % 7) celulasMes.push(null);

  const botaoNav = "rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm hover:border-violeta/40";

  return (
    <>
      <Titulo
        sub="Medições, entregas, montagens, assistência, retornos de venda e o Google Agenda da empresa"
        acao={
          ehAdmin ? (
            <JanelaBotao rotulo={agendas?.length ? "Google Agenda" : "Ligar Google Agenda"} titulo="Google Agenda" descricao="Os compromissos do Google aparecem aqui para toda a equipe, junto com os do sistema." variante="secundario" icone="mais" largura="md">
              <div className="flex flex-col gap-5">
                {!!agendas?.length && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-stone-600">Agendas ligadas</div>
                    <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                      {agendas.map((a) => <AgendaLigada key={a.id} id={a.id} nome={a.nome} cor={a.cor} falhou={comFalha.includes(a.nome)} />)}
                    </ul>
                  </div>
                )}
                <ol className="list-decimal space-y-1.5 rounded-lg bg-stone-50 p-4 pl-8 text-sm text-stone-700">
                  <li>No computador, entre no Gmail com o e-mail da agenda e abra <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noreferrer" className="font-medium text-violeta hover:underline">as configurações do Google Agenda</a>.</li>
                  <li>Na coluna da esquerda, em <b>Configurações das minhas agendas</b>, clique no nome da agenda.</li>
                  <li>Desça até <b>Integrar agenda</b> e copie o <b>Endereço secreto no formato iCal</b>.</li>
                  <li>Cole o endereço abaixo, dê um nome, escolha a cor e clique em <b>Ligar agenda</b>.</li>
                </ol>
                <div className="text-xs font-medium text-stone-600">{agendas?.length ? "Ligar outra agenda" : "Ligar agenda"}</div>
                <LigarGoogle proximaCor={proximaCor} />
                <p className="text-xs text-stone-500">Toda a equipe vê esses compromissos na Agenda. O sistema apenas lê os compromissos, não muda nada no Google. Novos compromissos podem levar alguns minutos para aparecer.</p>
              </div>
            </JanelaBotao>
          ) : undefined
        }
      >
        Agenda
      </Titulo>
      {!!comFalha.length && <p className="mb-4 rounded-lg bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-rosa/30">Não foi possível ler {comFalha.join(", ")} agora. Os outros compromissos estão normais.</p>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={link({ d: anterior })} className={botaoNav} aria-label="Anterior">←</Link>
          <span className="min-w-48 text-center text-lg font-semibold first-letter:uppercase">{titulo}</span>
          <Link href={link({ d: proximo })} className={botaoNav} aria-label="Próximo">→</Link>
          {!estaNoPeriodo && <Link href={link({ d: null })} className="text-sm text-violeta hover:underline">hoje</Link>}
          <div className="ml-1 flex rounded-full border border-stone-200 bg-white p-0.5 text-sm">
            {([["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"]] as const).map(([v, r]) => (
              <Link
                key={v}
                href={link({ vista: v, d: vista === "mes" && v !== "mes" && estaNoPeriodo ? hoje : ref })}
                className={`rounded-full px-3 py-1 ${vista === v ? "bg-marinho font-semibold text-white" : "text-stone-600 hover:text-stone-900"}`}
              >
                {r}
              </Link>
            ))}
          </div>
        </div>
        <form className="flex flex-wrap items-center gap-2">
          {vista !== "semana" && <input type="hidden" name="vista" value={vista} />}
          <input type="hidden" name="d" value={ref} />
          {!!agendas?.length && (
            <select name="ag" defaultValue={ag ?? ""} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm">
              <option value="">Todas as agendas</option>
              <option value="sistema">Só do sistema</option>
              {agendas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          )}
          <select name="resp" defaultValue={resp ?? ""} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm">
            <option value="">Toda a equipe</option>
            {pessoas?.map((p) => <option key={p.id} value={p.id}>{p.nome} ({ROTULOS2.tipoParceiro[p.tipo as keyof typeof ROTULOS2.tipoParceiro].toLowerCase()})</option>)}
          </select>
          <button className="rounded-full bg-marinho px-4 py-1.5 text-sm font-semibold text-white">Filtrar</button>
        </form>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-stone-500">
        {temTipo.has("marco") && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violeta" />Pedidos (medição, entrega, montagem…)</span>}
        {temTipo.has("chamado") && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rosa" />Assistência</span>}
        {temTipo.has("venda") && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ciano" />Retornos de venda</span>}
        {agendasComEvento.map((a) => (
          <span key={a.id} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.cor }} />{a.nome}</span>
        ))}
      </div>

      {vista === "mes" && (
        <div className="vidro hidden overflow-hidden rounded-2xl md:block">
          <div className="grid grid-cols-7 border-b border-stone-200/70 text-[11px] font-medium uppercase tracking-wider text-stone-500">
            {[...SEMANA.slice(1), SEMANA[0]].map((d) => <div key={d} className="px-3 py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {celulasMes.map((dia, i) => {
              const evs = dia ? porDia.get(dia) ?? [] : [];
              return (
                <div key={i} className={`min-h-28 border-b border-r border-stone-100 p-1.5 ${dia ? "" : "bg-stone-50/60"} ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}>
                  {dia && (
                    <Link href={link({ vista: "dia", d: dia })} className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs hover:ring-1 hover:ring-stone-300 ${dia === hoje ? "bg-marinho font-semibold text-white" : "text-stone-500"}`}>
                      {Number(dia.slice(8))}
                    </Link>
                  )}
                  <div className="space-y-1">
                    {evs.slice(0, 4).map((e, k) => (
                      <Link key={k} href={e.href} {...externo(e)} style={estilo(e)} title={`${e.hora ? `${e.hora} ` : ""}${e.titulo} — ${e.sub}`} className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${classe(e)}`}>
                        {e.hora && <span className="opacity-75">{e.hora} </span>}{e.titulo}
                      </Link>
                    ))}
                    {evs.length > 4 && dia && <Link href={link({ vista: "dia", d: dia })} className="block px-1.5 text-[11px] text-stone-500 hover:underline">+{evs.length - 4} mais</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vista === "semana" && (
        <div className="vidro hidden overflow-hidden rounded-2xl md:grid md:grid-cols-7">
          {dias.map((dia, i) => {
            const evs = porDia.get(dia) ?? [];
            return (
              <div key={dia} className={`flex min-h-[28rem] flex-col border-stone-100 ${i < 6 ? "border-r" : ""} ${dia === hoje ? "bg-madeira-50/60" : ""}`}>
                <Link href={link({ vista: "dia", d: dia })} className="flex items-center gap-2 border-b border-stone-200/70 px-3 py-2 hover:bg-stone-50">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-stone-500">{SEMANA[diaSemana(dia)]}</span>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${dia === hoje ? "bg-marinho font-semibold text-white" : "text-stone-800"}`}>{Number(dia.slice(8))}</span>
                </Link>
                <div className="flex flex-col gap-1.5 p-1.5">
                  {evs.map((e, k) => (
                    <Link key={k} href={e.href} {...externo(e)} style={estilo(e)} title={`${e.titulo} — ${e.sub}`} className={`block rounded-md px-2 py-1.5 text-xs ${classe(e)}`}>
                      {e.hora && <div className="text-[11px] font-semibold opacity-80">{e.hora}</div>}
                      <div className="line-clamp-2 font-medium">{e.titulo}</div>
                      {e.sub && <div className="truncate text-[11px] opacity-75">{e.sub}</div>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {vista === "dia" && (
        <div className="vidro hidden rounded-2xl p-4 md:block">
          {(porDia.get(ref) ?? []).map((e, k) => (
            <Link key={k} href={e.href} {...externo(e)} className="flex items-stretch gap-4 border-b border-stone-100 py-2 last:border-b-0">
              <div className="w-16 shrink-0 pt-2 text-right text-sm font-semibold text-stone-600">{e.hora ?? "dia todo"}</div>
              <div style={estilo(e)} className={`flex-1 rounded-lg px-3 py-2 ${classe(e)}`}>
                <div className="font-medium">{e.titulo}</div>
                {e.sub && <div className="text-xs opacity-80">{e.sub}</div>}
              </div>
            </Link>
          ))}
          {!porDia.get(ref)?.length && <p className="py-6 text-center text-sm text-stone-500">Nada agendado neste dia.</p>}
        </div>
      )}

      {/* no celular, qualquer visão vira uma lista por dia */}
      <div className="space-y-4 md:hidden">
        {[...porDia.entries()].map(([dia, evs]) => (
          <div key={dia}>
            <div className={`mb-1 text-[11px] font-medium uppercase tracking-[0.2em] ${dia === hoje ? "text-violeta" : "text-stone-500"}`}>{SEMANA[diaSemana(dia)]}, {diaMes(dia)}</div>
            <div className="space-y-1">
              {evs.map((e, k) => (
                <Link key={k} href={e.href} {...externo(e)} style={estilo(e)} className={`block rounded-xl px-3 py-2 text-sm ${classe(e)}`}>
                  <div className="font-medium">{e.hora && <span className="opacity-75">{e.hora} </span>}{e.titulo}</div>
                  <div className="text-xs opacity-80">{e.sub}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {!eventos.length && <p className="text-sm text-stone-400">Nada agendado neste período.</p>}
      </div>
    </>
  );
}
