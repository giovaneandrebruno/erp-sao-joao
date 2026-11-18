import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Titulo } from "@/components/ui";
import { ROTULOS2, hojeISO } from "@/lib/format";
import { JanelaBotao } from "@/components/janela";
import { baixarAgenda, lerAgenda } from "@/lib/ics";
import { Desligar, LigarGoogle } from "./google";

type Evento = { data: string; titulo: string; sub: string; href: string; tipo: "marco" | "chamado" | "venda" | "google"; externo?: boolean; feito?: boolean; atrasado?: boolean };

const COR = {
  marco: "bg-violeta/10 text-violeta",
  chamado: "bg-rosa/10 text-rosa",
  venda: "bg-ciano/10 text-[#0089a8]",
  google: "bg-stone-200/70 text-stone-700",
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoje.slice(0, 7);
  const resp = typeof sp.resp === "string" && sp.resp ? sp.resp : null;
  const [ano, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const ultimoDia = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
  const mesDe = (d: number) => {
    const x = new Date(Date.UTC(ano, m - 1 + d, 1));
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const supabase = await createClient();
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
  const [{ data: marcos }, { data: chamados }, { data: negs }, { data: pessoas }, { data: agendas }] = await Promise.all([
    qm, qc, qn,
    supabase.from("parceiros").select("id, nome, tipo").in("tipo", ["montador", "vendedor"]).eq("ativo", true).order("nome"),
    // só as agendas do Google do próprio usuário (a regra do banco garante isso)
    supabase.from("agendas_google").select("id, nome, url").order("criado_em"),
  ]);

  // compromissos do Google Agenda: baixados na hora, direto do Google
  const arquivos = await Promise.all((agendas ?? []).map((a) => baixarAgenda(a.url)));
  const comFalha = (agendas ?? []).filter((_, i) => !arquivos[i]).map((a) => a.nome);
  const doGoogle = resp ? [] : arquivos.flatMap((t, i) => (t ? lerAgenda(t, inicio, fim).map((e) => ({ ...e, agenda: agendas![i].nome })) : []));

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
      titulo: g.hora ? `${g.hora} ${g.titulo}` : g.titulo,
      sub: [g.local, g.agenda].filter(Boolean).join(" · "),
      href: `https://calendar.google.com/calendar/r/day/${g.data.replaceAll("-", "/")}`,
      tipo: "google" as const,
      externo: true,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data));

  const porDia = new Map<string, Evento[]>();
  for (const e of eventos) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e]);

  const primeiroDiaSemana = new Date(Date.UTC(ano, m - 1, 1)).getUTCDay();
  const celulas: (string | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: ultimoDia }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (celulas.length % 7) celulas.push(null);
  const qs = (novoMes: string) => `/agenda?mes=${novoMes}${resp ? `&resp=${resp}` : ""}`;

  return (
    <>
      <Titulo
        sub="Medições, entregas, montagens, assistência, retornos de venda e o seu Google Agenda"
        acao={
          <JanelaBotao rotulo={agendas?.length ? "Google Agenda" : "Ligar Google Agenda"} titulo="Google Agenda" descricao="Seus compromissos do Google aparecem aqui, junto com os do sistema." variante="secundario" icone="mais" largura="md">
            <div className="flex flex-col gap-5">
              {!!agendas?.length && (
                <div>
                  <div className="mb-2 text-xs font-medium text-stone-600">Agendas ligadas</div>
                  <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                    {agendas.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="truncate">{a.nome}{comFalha.includes(a.nome) && <span className="ml-2 text-xs text-rosa">sem resposta do Google</span>}</span>
                        <Desligar id={a.id} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ol className="list-decimal space-y-1.5 rounded-lg bg-stone-50 p-4 pl-8 text-sm text-stone-700">
                <li>No computador, abra <a href="https://calendar.google.com/calendar/r/settings" target="_blank" rel="noreferrer" className="font-medium text-violeta hover:underline">as configurações do Google Agenda</a> com a sua conta do Gmail.</li>
                <li>Na coluna da esquerda, em <b>Configurações das minhas agendas</b>, clique no seu nome.</li>
                <li>Desça até <b>Integrar agenda</b> e copie o <b>Endereço secreto no formato iCal</b>.</li>
                <li>Cole o endereço abaixo e clique em <b>Ligar agenda</b>.</li>
              </ol>
              <LigarGoogle />
              <p className="text-xs text-stone-500">Só você vê a sua agenda do Google aqui. O sistema apenas lê os compromissos, não muda nada no Google. Novos compromissos podem levar alguns minutos para aparecer.</p>
            </div>
          </JanelaBotao>
        }
      >
        Agenda
      </Titulo>
      {!!comFalha.length && <p className="mb-4 rounded-lg bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-rosa/30">Não foi possível ler {comFalha.join(", ")} agora. Os outros compromissos estão normais.</p>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={qs(mesDe(-1))} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm hover:border-violeta/40">←</Link>
          <span className="min-w-40 text-center text-lg font-semibold capitalize">{MESES[m - 1]} {ano}</span>
          <Link href={qs(mesDe(1))} className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm hover:border-violeta/40">→</Link>
          {mes !== hoje.slice(0, 7) && <Link href={qs(hoje.slice(0, 7))} className="text-sm text-violeta hover:underline">hoje</Link>}
        </div>
        <form className="flex items-center gap-2">
          <input type="hidden" name="mes" value={mes} />
          <select name="resp" defaultValue={resp ?? ""} className="rounded-full border border-stone-200 bg-white px-4 py-1.5 text-sm">
            <option value="">Toda a equipe</option>
            {pessoas?.map((p) => <option key={p.id} value={p.id}>{p.nome} ({ROTULOS2.tipoParceiro[p.tipo as keyof typeof ROTULOS2.tipoParceiro].toLowerCase()})</option>)}
          </select>
          <button className="rounded-full bg-marinho px-4 py-1.5 text-sm font-semibold text-white">Filtrar</button>
        </form>
      </div>

      <div className="mb-3 flex flex-wrap gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violeta" />Pedidos (medição, entrega, montagem…)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rosa" />Assistência</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ciano" />Retornos de venda</span>
        {!!agendas?.length && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-stone-400" />Google Agenda</span>}
      </div>

      <div className="vidro hidden overflow-hidden rounded-2xl md:block">
        <div className="grid grid-cols-7 border-b border-stone-200/70 text-[11px] font-medium uppercase tracking-wider text-stone-500">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <div key={d} className="px-3 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map((dia, i) => {
            const evs = dia ? porDia.get(dia) ?? [] : [];
            return (
              <div key={i} className={`min-h-28 border-b border-r border-stone-100 p-1.5 ${dia ? "" : "bg-stone-50/60"} ${(i + 1) % 7 === 0 ? "border-r-0" : ""}`}>
                {dia && (
                  <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${dia === hoje ? "bg-marinho font-semibold text-white" : "text-stone-500"}`}>
                    {Number(dia.slice(8))}
                  </div>
                )}
                <div className="space-y-1">
                  {evs.slice(0, 4).map((e, k) => (
                    <Link key={k} href={e.href} {...(e.externo ? { target: "_blank", rel: "noreferrer" } : {})} title={`${e.titulo} — ${e.sub}`} className={`block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ${COR[e.tipo]} ${e.feito ? "line-through opacity-50" : ""} ${e.atrasado ? "ring-1 ring-rosa" : ""}`}>
                      {e.titulo}
                    </Link>
                  ))}
                  {evs.length > 4 && <div className="px-1.5 text-[11px] text-stone-400">+{evs.length - 4} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        {[...porDia.entries()].map(([dia, evs]) => (
          <div key={dia}>
            <div className={`mb-1 text-[11px] font-medium uppercase tracking-[0.2em] ${dia === hoje ? "text-violeta" : "text-stone-500"}`}>{Number(dia.slice(8))} de {MESES[m - 1]}</div>
            <div className="space-y-1">
              {evs.map((e, k) => (
                <Link key={k} href={e.href} {...(e.externo ? { target: "_blank", rel: "noreferrer" } : {})} className={`block rounded-xl px-3 py-2 text-sm ${COR[e.tipo]} ${e.feito ? "line-through opacity-50" : ""}`}>
                  <div className="font-medium">{e.titulo}</div>
                  <div className="text-xs opacity-80">{e.sub}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {!eventos.length && <p className="text-sm text-stone-400">Nada agendado neste mês.</p>}
      </div>
    </>
  );
}
