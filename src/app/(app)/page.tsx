import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Cartao, Titulo } from "@/components/ui";
import { ROTULOS, brl, data, hojeISO, linkWhats, pct } from "@/lib/format";
import { AtualizarSozinho } from "@/components/atualizar";
import { perfilAtual } from "@/lib/perfil";
import { situacaoPrazo } from "@/lib/pcp";
import { Icone, type NomeDoIcone } from "@/components/icones";

export default async function PainelPage() {
  await connection(); // a data de hoje muda: a tela é sempre montada na hora
  const supabase = await createClient();
  const admin = (await perfilAtual())?.papel === "admin";
  const hoje = hojeISO();
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const daqui7 = hojeISO(7);

  const [vendasMes, negociacoes, pedidosAtivos, marcosAtrasados, vencidos, semana, produtos, chamados, orcAbertos, agendaSemana, vendasSemana, ordens, agendaHoje] = await Promise.all([
    supabase.from("pedidos_resumo").select("total, lucro").gte("criado_em", inicioMes).neq("status", "cancelado"),
    supabase.from("negociacoes").select("id, titulo, valor_estimado, proxima_acao, proxima_acao_data, clientes(nome)").not("etapa", "in", "(ganho,perdido)").order("proxima_acao_data", { nullsFirst: false }),
    supabase.from("pedidos_resumo").select("id, numero, cliente_nome, status, data_entrega_prevista").in("status", ["aberto", "em_producao", "pronto"]).order("data_entrega_prevista", { nullsFirst: false }),
    supabase.from("pedido_marcos").select("id", { count: "exact", head: true }).is("realizado", null).lt("previsto", hoje),
    supabase.from("lancamentos").select("tipo, valor").is("pago_em", null).lt("vencimento", hoje),
    supabase.from("lancamentos").select("tipo, valor").is("pago_em", null).gte("vencimento", hoje).lte("vencimento", daqui7),
    supabase.from("produtos").select("estoque_atual, estoque_minimo").eq("ativo", true).neq("tipo", "servico"),
    supabase.from("chamados").select("id", { count: "exact", head: true }).neq("status", "resolvido"),
    supabase.from("orcamentos_resumo").select("total").eq("status", "enviado"),
    supabase.from("pedido_marcos").select("id", { count: "exact", head: true }).is("realizado", null).in("tipo", ["medicao", "entrega", "montagem", "vistoria"]).gte("previsto", hoje).lte("previsto", daqui7),
    supabase.from("pedidos_resumo").select("total").gte("criado_em", hojeISO(-6)).neq("status", "cancelado"),
    supabase.from("ordens_producao").select("status_pcp, entrega_limite").neq("status_pcp", "FIN"),
    supabase.from("pedido_marcos").select("tipo").is("realizado", null).in("tipo", ["medicao", "entrega", "montagem", "vistoria"]).eq("previsto", hoje),
  ]);

  const somar = (rows: { tipo: string; valor: number }[] | null, t: string) => (rows ?? []).filter((r) => r.tipo === t).reduce((s, r) => s + Number(r.valor), 0);
  const vendido = (vendasMes.data ?? []).reduce((s, p) => s + Number(p.total), 0);
  const lucroMes = (vendasMes.data ?? []).reduce((s, p) => s + Number(p.lucro), 0);
  const potencial = (negociacoes.data ?? []).reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0);
  const acoesHoje = (negociacoes.data ?? []).filter((n) => n.proxima_acao_data && n.proxima_acao_data <= hoje);
  const repor = (produtos.data ?? []).filter((p) => Number(p.estoque_atual) <= Number(p.estoque_minimo)).length;

  const vendidoSemana = (vendasSemana.data ?? []).reduce((s, p) => s + Number(p.total), 0);
  const ordensAtivas = ordens.data ?? [];
  const ordensAtrasadas = ordensAtivas.filter((o) => situacaoPrazo(o, hoje).tipo === "atrasada").length;
  const compromissosHoje = agendaHoje.data?.length ?? 0;
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const atalhos = [
    { titulo: "Ver resumo da semana", sub: `${brl(vendidoSemana)} vendidos em 7 dias`, href: "/analises", icone: "analises" as NomeDoIcone },
    { titulo: "Ver minhas rotinas", sub: acoesHoje.length ? plural(acoesHoje.length, "retorno para hoje", "retornos para hoje") : "nada pendente hoje", href: "/crm", icone: "sino" as NomeDoIcone },
    { titulo: "Como está a produção", sub: `${plural(ordensAtivas.length, "serviço", "serviços")} em andamento${ordensAtrasadas ? ` · ${ordensAtrasadas} atrasado${ordensAtrasadas > 1 ? "s" : ""}` : ""}`, href: "/producao", icone: "producao" as NomeDoIcone },
    { titulo: "Agenda de hoje", sub: compromissosHoje ? plural(compromissosHoje, "compromisso", "compromissos") : "nenhum compromisso", href: "/agenda", icone: "pedidos" as NomeDoIcone },
  ];

  const cards = [
    { rotulo: "Vendido no mês", valor: brl(vendido), sub: `${vendasMes.data?.length ?? 0} pedidos · lucro ${brl(lucroMes)}${vendido ? ` (${pct((lucroMes / vendido) * 100)})` : ""}`, href: "/pedidos" },
    { rotulo: "Funil de vendas", valor: `${negociacoes.data?.length ?? 0}`, sub: `potencial ${brl(potencial)}`, href: "/crm" },
    { rotulo: "Pedidos ativos", valor: `${pedidosAtivos.data?.length ?? 0}`, sub: `${marcosAtrasados.count ?? 0} prazos atrasados`, href: "/prazos", alerta: (marcosAtrasados.count ?? 0) > 0 },
    ...(admin ? [] : [
      { rotulo: "Orçamentos enviados", valor: `${orcAbertos.data?.length ?? 0}`, sub: `aguardando resposta · ${brl((orcAbertos.data ?? []).reduce((s, o) => s + Number(o.total), 0))}`, href: "/orcamentos" },
      { rotulo: "Agenda da semana", valor: `${agendaSemana.count ?? 0}`, sub: "medições, entregas e montagens", href: "/agenda" },
    ]),
    ...(!admin ? [] : [{ rotulo: "A receber em 7 dias", valor: brl(somar(semana.data, "receber")), sub: `vencido: ${brl(somar(vencidos.data, "receber"))}`, href: "/financeiro?tipo=receber" },
    { rotulo: "A pagar em 7 dias", valor: brl(somar(semana.data, "pagar")), sub: `vencido: ${brl(somar(vencidos.data, "pagar"))}`, href: "/financeiro?tipo=pagar" }]),
    { rotulo: "Assistência técnica", valor: `${chamados.count ?? 0}`, sub: "chamados abertos", href: "/assistencia" },
    { rotulo: "Estoque", valor: `${repor}`, sub: "itens abaixo do mínimo", href: "/estoque", alerta: repor > 0 },
  ];

  const [destaque, ...resto] = cards;

  // propostas que o cliente abriu nas últimas 48 horas: hora de ligar
  const agora = instante();
  const { data: abertasBrutas } = await supabase
    .from("orcamentos")
    .select("id, numero, aberturas, ultima_abertura_em, clientes(nome, telefone)")
    .eq("status", "enviado")
    .gte("ultima_abertura_em", new Date(agora - 48 * 3_600_000).toISOString())
    .order("ultima_abertura_em", { ascending: false })
    .limit(6);
  const propostasAbertas = (abertasBrutas ?? []).map((o) => {
    const cliente = o.clientes as unknown as { nome: string; telefone: string | null } | null;
    const minutos = Math.max(0, Math.round((agora - Date.parse(String(o.ultima_abertura_em))) / 60_000));
    return {
      ...o, cliente, minutos,
      whats: linkWhats(cliente?.telefone, `Olá, ${cliente?.nome?.split(" ")[0] ?? ""}! Vi que você abriu a nossa proposta nº ${o.numero}. Ficou alguma dúvida? Posso te ajudar a fechar os detalhes.`),
    };
  });
  const haQuanto = (m: number) => (m < 1 ? "agora mesmo" : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.floor(m / 60)} h` : "ontem");

  // resumo de ontem (só o administrador)
  const ontem = hojeISO(-1);
  const [pedOntem, orcOntem, finOntem] = admin
    ? await Promise.all([
        supabase.from("pedidos_resumo").select("total").gte("criado_em", `${ontem}T00:00:00-03:00`).lt("criado_em", `${hoje}T00:00:00-03:00`).neq("status", "cancelado"),
        supabase.from("orcamentos").select("id", { count: "exact", head: true }).gte("criado_em", `${ontem}T00:00:00-03:00`).lt("criado_em", `${hoje}T00:00:00-03:00`),
        supabase.from("lancamentos").select("tipo, valor").eq("pago_em", ontem),
      ])
    : [null, null, null];
  const resumoOntem = admin
    ? [
        { rotulo: "Vendido", valor: brl((pedOntem?.data ?? []).reduce((s, p) => s + Number(p.total), 0)), sub: `${pedOntem?.data?.length ?? 0} pedidos` },
        { rotulo: "Orçamentos feitos", valor: String(orcOntem?.count ?? 0), sub: "novos" },
        { rotulo: "Recebido", valor: brl(somar(finOntem?.data ?? null, "receber")), sub: "parcelas pagas" },
        { rotulo: "Pago", valor: brl(somar(finOntem?.data ?? null, "pagar")), sub: "contas pagas" },
      ]
    : [];

  // cópia de segurança: o administrador é avisado depois de 7 dias sem baixar
  const { data: copia } = admin ? await supabase.from("configuracoes").select("ultima_copia_em").single() : { data: null };
  const diasSemCopia = copia ? (copia.ultima_copia_em ? Math.round((Date.parse(hoje) - Date.parse(String(copia.ultima_copia_em).slice(0, 10))) / 86_400_000) : null) : 0;
  const avisarCopia = admin && (diasSemCopia === null || diasSemCopia > 7);
  const lista = "divide-y divide-stone-100 text-sm";

  return (
    <>
      <Titulo sub={agoraTexto()}>Painel</Titulo>
      {avisarCopia && (
        <Link href="/configuracoes" className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-laranja/40 bg-bege/40 px-5 py-3 text-sm text-stone-800 transition hover:border-laranja">
          <span>{diasSemCopia === null ? "Você ainda não baixou nenhuma cópia de segurança do sistema." : `Faz ${diasSemCopia} dias que você não baixa uma cópia de segurança do sistema.`}</span>
          <span className="shrink-0 font-semibold text-laranja">Baixar agora →</span>
        </Link>
      )}
      <AtualizarSozinho segundos={60} />
      {propostasAbertas.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-violeta">Clientes olhando a proposta</h2>
          <Cartao className="filete">
            <ul className={lista}>
              {propostasAbertas.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <Link href={`/orcamentos/${o.id}`} className="text-stone-800 transition hover:text-ciano">
                    <span className="font-mono font-semibold text-violeta">#{o.numero}</span> {o.cliente?.nome ?? "Cliente"}
                    <span className="text-stone-500"> · abriu {haQuanto(o.minutos)}{o.aberturas > 1 ? ` · ${o.aberturas} vezes no total` : ""}</span>
                  </Link>
                  <span className="flex items-center gap-3">
                    {o.minutos <= 20 && <span className="rounded-full bg-laranja/15 px-2.5 py-0.5 text-xs font-semibold text-laranja">Ligue agora</span>}
                    {o.whats && <a href={o.whats} target="_blank" rel="noreferrer" className="text-xs font-semibold text-laranja hover:underline">Chamar no WhatsApp</a>}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        </section>
      )}
      {admin && (
        <section className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-violeta">Ontem ({data(ontem)})</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {resumoOntem.map((r) => (
              <Cartao key={r.rotulo} className="p-4!">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">{r.rotulo}</div>
                <div className="mt-1 font-mono text-lg font-semibold text-stone-900">{r.valor}</div>
                <div className="text-xs text-stone-500">{r.sub}</div>
              </Cartao>
            ))}
          </div>
        </section>
      )}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {atalhos.map((a, i) => (
          <Link
            key={a.titulo}
            href={a.href}
            className={`group flex items-center gap-3 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-18px_rgb(227_127_51/0.8)] ${i === 0 ? "border-laranja bg-laranja text-white" : "border-bege bg-white hover:border-laranja"}`}
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${i === 0 ? "bg-white/20 text-white" : "bg-bege text-violeta"}`}>
              <Icone nome={a.icone} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${i === 0 ? "text-white" : "text-stone-900"}`}>{a.titulo}</span>
              <span className={`block truncate text-xs ${i === 0 ? "text-white/85" : "text-stone-500"}`}>{a.sub}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <Link href={destaque.href} className="cartao-laranja group relative overflow-hidden col-span-2 rounded-3xl p-6 sm:p-8 lg:row-span-2">
                    <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">{destaque.rotulo}</div>
            <div>
              <div className="font-mono text-4xl text-white font-semibold tracking-tighter xl:text-5xl 2xl:text-6xl">{destaque.valor}</div>
              <div className="mt-3 text-sm text-white/90">{destaque.sub}</div>
            </div>
          </div>
        </Link>
        {resto.map((c) => (
          <Link key={c.rotulo} href={c.href} className="group">
            <Cartao className="filete h-full p-4! transition group-hover:border-laranja/60 sm:p-6!">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-violeta">
                {c.rotulo}
                <span className={`h-1.5 w-1.5 rounded-full ${c.alerta ? "bg-laranja shadow-[0_0_10px_2px_rgb(227_127_51/0.6)]" : "bg-bege"}`} />
              </div>
              <div className="mt-4 font-mono text-lg font-semibold tracking-tight text-stone-900 sm:text-2xl">{c.valor}</div>
              <div className={`mt-1 text-xs ${c.alerta ? "text-rosa" : "text-stone-500"}`}>{c.sub}</div>
            </Cartao>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-violeta">Retornos para hoje</h2>
          <Cartao className="filete">
            {acoesHoje.length ? (
              <ul className={lista}>
                {acoesHoje.slice(0, 8).map((n) => (
                  <li key={n.id} className="flex justify-between gap-4 py-2.5">
                    <Link href={`/crm/${n.id}`} className="text-stone-800 transition hover:text-ciano">{(n.clientes as unknown as { nome: string })?.nome} · <span className="text-stone-500">{n.proxima_acao}</span></Link>
                    <span className={`font-mono text-xs ${n.proxima_acao_data! < hoje ? "text-rosa" : "text-stone-500"}`}>{data(n.proxima_acao_data)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">Nenhum retorno pendente.</p>
            )}
          </Cartao>
        </section>
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-violeta">Próximas entregas</h2>
          <Cartao className="filete">
            {pedidosAtivos.data?.length ? (
              <ul className={lista}>
                {pedidosAtivos.data.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex justify-between gap-4 py-2.5">
                    <Link href={`/pedidos/${p.id}`} className="text-stone-800 transition hover:text-ciano"><span className="font-mono font-semibold text-violeta">#{p.numero}</span> {p.cliente_nome}</Link>
                    <span className={`text-xs ${p.data_entrega_prevista && p.data_entrega_prevista < hoje ? "text-rosa" : "text-stone-500"}`}>
                      {ROTULOS.statusPedido[p.status as keyof typeof ROTULOS.statusPedido]} · <span className="font-mono">{data(p.data_entrega_prevista)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-stone-400">Nenhum pedido em andamento.</p>
            )}
          </Cartao>
        </section>
      </div>
    </>
  );
}

function agoraTexto() {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
}

/** Agora, em milissegundos (a tela é montada na hora, então pode mudar a cada visita). */
function instante() {
  return Date.now();
}
