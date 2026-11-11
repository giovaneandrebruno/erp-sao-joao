import type { Insight } from "@/components/graficos/paineis";
import { ROTULOS, ROTULOS2 } from "@/lib/format";
import {
  acumulado,
  anomalia,
  brlCurto,
  dias,
  mediana,
  mediaMovel,
  mesesAte,
  prever,
  rotuloMes,
  soma,
  somaMensal,
  somarMeses,
  variacao,
} from "@/lib/analise";

export type Brutos = {
  pedidos: { id: string; numero: number; criado_em: string; total: number; lucro: number; unidade: string; vendedor_id: string | null; status: string; cliente_nome: string }[];
  itens: { ambiente: string | null; total: number; criado_em: string }[];
  negociacoes: { id: string; titulo: string; etapa: string; origem: string | null; valor_estimado: number | null; motivo_perda: string | null; unidade: string; criado_em: string; atualizado_em: string; proxima_acao_data: string | null; cliente_nome: string | null }[];
  lancamentos: { tipo: "receber" | "pagar"; valor: number; categoria: string | null; vencimento: string; pago_em: string | null; pedido_id: string | null }[];
  marcos: { tipo: string; previsto: string | null; realizado: string | null; pedido_id: string; numero: number; cliente_nome: string }[];
  ordens: { etapa: string; prazo: string | null }[];
  chamados: { criado_em: string; status: string }[];
  orcamentos: { id: string; numero: number; total: number; criado_em: string; visualizado_em: string | null; cliente_nome: string }[];
  vendedores: { id: string; nome: string }[];
  margemMinima: number;
};

export type Parametros = { hoje: string; mes: string; janela: number };

/** Chance de fechar por etapa do funil, usada no valor ponderado. */
export const CHANCE: Record<string, number> = { novo: 0.05, contato: 0.1, medicao: 0.25, projeto: 0.4, proposta: 0.55, negociacao: 0.7 };
const ABERTAS = ["novo", "contato", "medicao", "projeto", "proposta", "negociacao"] as const;

export function calcular(b: Brutos, { hoje, mes, janela }: Parametros) {
  const mesAtual = hoje.slice(0, 7);
  const emAndamento = mes === mesAtual;
  const diaHoje = Number(hoje.slice(8, 10));
  const meses = mesesAte(mes, janela);
  const meses24 = mesesAte(mes, 24);
  const rotulos = meses.map((m) => rotuloMes(m));
  const inicioJanela = `${meses[0]}-01`;
  const fimMes = `${somarMeses(mes, 1)}-01`;
  const naJanela = (d: string | null | undefined) => !!d && d >= inicioJanela && d < fimMes;
  const doMes = (d: string | null | undefined, m = mes) => !!d && d.slice(0, 7) === m;
  const ate = (d: string, dia: number) => Number(d.slice(8, 10)) <= dia;
  const corte = (m: string) => `${m}-01`;

  // ------------------------------------------------------------------ vendas
  const ped = b.pedidos.filter((p) => p.status !== "cancelado");
  const vend24 = somaMensal(ped, (p) => p.criado_em, (p) => Number(p.total), meses24);
  const lucro24 = somaMensal(ped, (p) => p.criado_em, (p) => Number(p.lucro), meses24);
  const qtd24 = somaMensal(ped, (p) => p.criado_em, () => 1, meses24);
  const vendido = vend24.slice(-janela);
  const lucro = lucro24.slice(-janela);
  const qtd = qtd24.slice(-janela);
  const margem = vendido.map((v, i) => (v ? (lucro[i] / v) * 100 : null));

  const pedMes = ped.filter((p) => doMes(p.criado_em));
  const vendidoMes = soma(pedMes.map((p) => Number(p.total)));
  const lucroMes = soma(pedMes.map((p) => Number(p.lucro)));
  const mesAnt = somarMeses(mes, -1);
  // Mês em andamento: compara com os mesmos dias do mês anterior.
  const vendidoAntComparavel = soma(ped.filter((p) => doMes(p.criado_em, mesAnt) && (!emAndamento || ate(p.criado_em, diaHoje))).map((p) => Number(p.total)));
  const vendidoAnoAnt = soma(ped.filter((p) => doMes(p.criado_em, somarMeses(mes, -12)) && (!emAndamento || ate(p.criado_em, diaHoje))).map((p) => Number(p.total)));
  const contra = emAndamento ? "vs. mesmos dias do mês anterior" : "vs. mês anterior";

  // previsão: só com meses completos (exclui o mês em andamento)
  const baseHist = emAndamento ? vend24.slice(0, -1) : vend24;
  const prev = prever(baseHist, emAndamento ? 4 : 3);
  const rotPrev = Array.from({ length: prev?.valores.length ?? 0 }, (_, i) => rotuloMes(somarMeses(emAndamento ? mesAnt : mes, i + 1)));
  // Se o mês atual está em andamento, a 1ª previsão é para ele: mostra as 3 seguintes no gráfico.
  const previsaoVendas = prev
    ? {
        rotulos: emAndamento ? rotPrev.slice(1) : rotPrev,
        valores: emAndamento ? prev.valores.slice(1) : prev.valores,
        baixo: emAndamento ? prev.baixo.slice(1) : prev.baixo,
        alto: emAndamento ? prev.alto.slice(1) : prev.alto,
        nome: "Previsão de vendas",
      }
    : null;
  const previsaoMesAtual = prev && emAndamento ? { valor: prev.valores[0], baixo: prev.baixo[0], alto: prev.alto[0] } : null;

  const pedJanela = ped.filter((p) => naJanela(p.criado_em));
  const valoresJanela = pedJanela.map((p) => Number(p.total));
  const ticket = valoresJanela.length ? soma(valoresJanela) / valoresJanela.length : 0;
  const ticketMediana = mediana(valoresJanela);

  const nomeVend = new Map(b.vendedores.map((v) => [v.id, v.nome]));
  const porVendedor = agrupar(pedJanela, (p) => (p.vendedor_id ? nomeVend.get(p.vendedor_id) ?? "—" : "Sem vendedor"), (p) => Number(p.total), (p) => Number(p.lucro));
  const porUnidade = agrupar(pedJanela, (p) => ROTULOS.unidade[p.unidade as "loja"] ?? p.unidade, (p) => Number(p.total));
  const porAmbiente = agrupar(b.itens.filter((i) => naJanela(i.criado_em)), (i) => normalizarAmbiente(i.ambiente), (i) => Number(i.total));

  // este ano x ano anterior (mesmos meses do calendário)
  const ano = Number(mes.slice(0, 4));
  const mesesAno = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);
  const mesesAnoAnt = mesesAno.map((m) => somarMeses(m, -12));
  const anoAtual = somaMensal(ped, (p) => p.criado_em, (p) => Number(p.total), mesesAno).map((v, i) => (mesesAno[i] > mes ? null : v));
  const anoAnterior = somaMensal(ped, (p) => p.criado_em, (p) => Number(p.total), mesesAnoAnt);
  const acumAno = soma(anoAtual.map((v) => v ?? 0));
  const acumAnoAnt = soma(anoAnterior.slice(0, Number(mes.slice(5, 7))));

  const abaixoMinima = pedMes.filter((p) => Number(p.total) > 0 && (Number(p.lucro) / Number(p.total)) * 100 < b.margemMinima);

  // ------------------------------------------------------------------ funil
  const negs = b.negociacoes;
  const abertas = negs.filter((n) => (ABERTAS as readonly string[]).includes(n.etapa));
  const etapas = ABERTAS.map((e) => {
    const ns = abertas.filter((n) => n.etapa === e);
    const valor = soma(ns.map((n) => Number(n.valor_estimado ?? 0)));
    return { chave: e, nome: ROTULOS2.etapaNegociacao[e], qtd: ns.length, valor, ponderado: valor * CHANCE[e] };
  });
  const ponderado = soma(etapas.map((e) => e.ponderado));
  const potencial = soma(etapas.map((e) => e.valor));
  const fechadasJanela = negs.filter((n) => (n.etapa === "ganho" || n.etapa === "perdido") && naJanela(n.atualizado_em));
  const ganhasJanela = fechadasJanela.filter((n) => n.etapa === "ganho");
  const conversao = fechadasJanela.length ? (ganhasJanela.length / fechadasJanela.length) * 100 : null;
  const ciclos = ganhasJanela.map((n) => dias(n.criado_em, n.atualizado_em)).filter((d) => d >= 0);
  const ciclo = ciclos.length ? mediana(ciclos) : null;
  const novos = somaMensal(negs, (n) => n.criado_em, () => 1, meses);
  const ganhosMes = somaMensal(negs.filter((n) => n.etapa === "ganho"), (n) => n.atualizado_em, () => 1, meses);
  const limiteParada = isoMenosDias(hoje, 14);
  const paradas = abertas
    .filter((n) => n.atualizado_em.slice(0, 10) < limiteParada || (n.proxima_acao_data && n.proxima_acao_data < hoje))
    .sort((a, b2) => Number(b2.valor_estimado ?? 0) - Number(a.valor_estimado ?? 0));

  const origens = new Map<string, { contatos: number; ganhos: number; perdidos: number; valor: number }>();
  for (const n of negs.filter((x) => naJanela(x.criado_em))) {
    const o = n.origem?.trim() || "Não informada";
    const r = origens.get(o) ?? { contatos: 0, ganhos: 0, perdidos: 0, valor: 0 };
    r.contatos++;
    if (n.etapa === "ganho") { r.ganhos++; r.valor += Number(n.valor_estimado ?? 0); }
    if (n.etapa === "perdido") r.perdidos++;
    origens.set(o, r);
  }
  const porOrigem = [...origens.entries()]
    .map(([nome, r]) => ({ nome, ...r, taxa: r.ganhos + r.perdidos ? (r.ganhos / (r.ganhos + r.perdidos)) * 100 : null }))
    .sort((a, b2) => b2.contatos - a.contatos);
  const motivos = agrupar(negs.filter((n) => n.etapa === "perdido" && naJanela(n.atualizado_em)), (n) => n.motivo_perda?.trim() || "Não informado", () => 1);

  const propostasSemResposta = b.orcamentos.filter((o) => o.criado_em.slice(0, 10) < isoMenosDias(hoje, 7));

  // ------------------------------------------------------------------ produção e prazos
  const concluidos = b.marcos.filter((m) => m.realizado && m.previsto);
  const concluidosJanela = concluidos.filter((m) => naJanela(m.realizado));
  const noPrazo = (m: { realizado: string | null; previsto: string | null }) => (m.realizado ?? "") <= (m.previsto ?? "");
  const pctPrazo = concluidosJanela.length ? (concluidosJanela.filter(noPrazo).length / concluidosJanela.length) * 100 : null;
  const prazoPorMes = meses.map((m) => {
    const ms = concluidos.filter((x) => doMes(x.realizado, m));
    return ms.length ? (ms.filter(noPrazo).length / ms.length) * 100 : null;
  });
  const atrasosJanela = concluidosJanela.filter((m) => !noPrazo(m)).map((m) => dias(m.previsto!, m.realizado!));
  const atrasoMedio = atrasosJanela.length ? soma(atrasosJanela) / atrasosJanela.length : null;
  const atrasoPorTipo = agrupar(
    concluidosJanela,
    (m) => ROTULOS2.marco[m.tipo as "medicao"] ?? m.tipo,
    (m) => Math.max(0, dias(m.previsto!, m.realizado!)),
    () => 1,
  ).map((x) => ({ ...x, valor: x.extra ? x.valor / x.extra : 0 }));
  const atrasados = b.marcos
    .filter((m) => !m.realizado && m.previsto && m.previsto < hoje)
    .map((m) => ({ ...m, dias: dias(m.previsto!, hoje) }))
    .sort((a, b2) => b2.dias - a.dias);
  const proximos7 = b.marcos.filter((m) => !m.realizado && m.previsto && m.previsto >= hoje && m.previsto <= isoMaisDias(hoje, 7));
  const ordensEtapa = (Object.keys(ROTULOS.etapa) as (keyof typeof ROTULOS.etapa)[])
    .filter((e) => e !== "concluido")
    .map((e) => ({ chave: e, nome: ROTULOS.etapa[e], qtd: b.ordens.filter((o) => o.etapa === e).length, atrasadas: b.ordens.filter((o) => o.etapa === e && o.prazo && o.prazo < hoje).length }));
  const gargalo = [...ordensEtapa].filter((e) => e.chave !== "aguardando").sort((a, b2) => b2.qtd - a.qtd)[0];
  const chamadosMes = somaMensal(b.chamados, (c) => c.criado_em, () => 1, meses);
  const chamadosAbertos = b.chamados.filter((c) => c.status !== "resolvido").length;
  const entregues = soma(qtd);
  const assistPorPedido = entregues ? (soma(chamadosMes) / entregues) * 100 : null;

  // ------------------------------------------------------------------ financeiro
  const lanc = b.lancamentos;
  const pagos = lanc.filter((l) => l.pago_em);
  const entradas = somaMensal(pagos.filter((l) => l.tipo === "receber"), (l) => l.pago_em, (l) => Number(l.valor), meses);
  const saidas = somaMensal(pagos.filter((l) => l.tipo === "pagar"), (l) => l.pago_em, (l) => Number(l.valor), meses);
  const resultado = entradas.map((e, i) => e - saidas[i]);
  const saldoAcum = acumulado(resultado);
  const mesesFuturos = [1, 2, 3].map((k) => somarMeses(mes, k));
  const abertosLanc = lanc.filter((l) => !l.pago_em);
  const aReceberFut = mesesFuturos.map((m) => soma(abertosLanc.filter((l) => l.tipo === "receber" && doMes(l.vencimento, m)).map((l) => Number(l.valor))));
  const aPagarFut = mesesFuturos.map((m) => soma(abertosLanc.filter((l) => l.tipo === "pagar" && doMes(l.vencimento, m)).map((l) => Number(l.valor))));
  const vencidosReceber = abertosLanc.filter((l) => l.tipo === "receber" && l.vencimento < hoje);
  const vencidosPagar = abertosLanc.filter((l) => l.tipo === "pagar" && l.vencimento < hoje);
  const totalVencidoReceber = soma(vencidosReceber.map((l) => Number(l.valor)));
  const totalAReceber = soma(abertosLanc.filter((l) => l.tipo === "receber").map((l) => Number(l.valor)));
  const inadimplencia = totalAReceber ? (totalVencidoReceber / totalAReceber) * 100 : null;

  // Taxa histórica de recebimento no mês do vencimento (para a faixa pessimista da projeção).
  const recebiveisPassados = lanc.filter((l) => l.tipo === "receber" && l.vencimento < corte(mes) && l.vencimento >= corte(somarMeses(mes, -12)));
  const recebidosEmDia = recebiveisPassados.filter((l) => l.pago_em && l.pago_em.slice(0, 7) <= l.vencimento.slice(0, 7));
  const taxaEmDia = recebiveisPassados.length ? soma(recebidosEmDia.map((l) => Number(l.valor))) / soma(recebiveisPassados.map((l) => Number(l.valor))) : 0.85;
  const saldoAtual = saldoAcum[saldoAcum.length - 1] ?? 0;
  const projecao = acumulado(mesesFuturos.map((_, i) => aReceberFut[i] - aPagarFut[i]), saldoAtual);
  const projecaoBaixa = acumulado(mesesFuturos.map((_, i) => aReceberFut[i] * taxaEmDia - aPagarFut[i]), saldoAtual);
  const previsaoCaixa = {
    rotulos: mesesFuturos.map((m) => rotuloMes(m)),
    valores: projecao,
    baixo: projecaoBaixa,
    alto: projecao,
    nome: "Projeção com o que está lançado",
  };

  const despMes = pagos.filter((l) => l.tipo === "pagar" && doMes(l.pago_em));
  const categorias = agrupar(despMes, (l) => l.categoria?.trim() || "Sem categoria", (l) => Number(l.valor));
  const historicoCat = (cat: string) =>
    mesesAte(mesAnt, 12).map((m) => soma(pagos.filter((l) => l.tipo === "pagar" && (l.categoria?.trim() || "Sem categoria") === cat && doMes(l.pago_em, m)).map((l) => Number(l.valor))));
  const anomalias = emAndamento
    ? [] // mês incompleto: comparar gasto parcial com meses fechados geraria falso alarme de queda
    : categorias
        .map((c) => ({ ...c, anomalia: anomalia(c.valor, historicoCat(c.nome)) }))
        .filter((c) => c.anomalia && c.anomalia.desvio > 0);
  // em andamento: só alerta categorias que já passaram do normal do mês inteiro
  const anomaliasParciais = emAndamento
    ? categorias.map((c) => ({ ...c, anomalia: anomalia(c.valor, historicoCat(c.nome)) })).filter((c) => c.anomalia && c.anomalia.desvio > 0)
    : [];

  const faixas = [
    { nome: "1 a 30 dias", de: 1, ate: 30 },
    { nome: "31 a 60 dias", de: 31, ate: 60 },
    { nome: "61 a 90 dias", de: 61, ate: 90 },
    { nome: "Mais de 90 dias", de: 91, ate: Infinity },
  ].map((f) => ({ nome: f.nome, valor: soma(vencidosReceber.filter((l) => { const d = dias(l.vencimento, hoje); return d >= f.de && d <= f.ate; }).map((l) => Number(l.valor))) }));

  // Ponto de equilíbrio: despesas sem pedido (estrutura) ÷ margem de contribuição dos pedidos.
  const ult3 = mesesAte(emAndamento ? mesAnt : mes, 3);
  const fixasMedia = soma(ult3.map((m) => soma(pagos.filter((l) => l.tipo === "pagar" && !l.pedido_id && doMes(l.pago_em, m)).map((l) => Number(l.valor))))) / 3;
  const ult6v = soma(vend24.slice(emAndamento ? -7 : -6, emAndamento ? -1 : undefined));
  const ult6l = soma(lucro24.slice(emAndamento ? -7 : -6, emAndamento ? -1 : undefined));
  const margemContrib = ult6v ? ult6l / ult6v : null;
  const pontoEquilibrio = margemContrib && margemContrib > 0 ? fixasMedia / margemContrib : null;

  // ------------------------------------------------------------------ insights
  const ins: Insight[] = [];
  const varVend = variacao(vendidoMes, vendidoAntComparavel);
  if (varVend !== null && Math.abs(varVend) >= 10) {
    ins.push({
      nivel: varVend > 0 ? "bom" : "atencao",
      titulo: `Vendas ${varVend > 0 ? "subiram" : "caíram"} ${fmtPct(Math.abs(varVend))} ${emAndamento ? "em relação aos mesmos dias do mês passado" : "em relação ao mês anterior"}`,
      detalhe: `${brlCurto(vendidoMes)} agora contra ${brlCurto(vendidoAntComparavel)}.`,
      href: "/analises?aba=vendas",
    });
  }
  if (previsaoMesAtual) {
    const falta = previsaoMesAtual.valor - vendidoMes;
    ins.push({
      nivel: "info",
      titulo: `Previsão para ${rotuloMes(mes)}: ${brlCurto(previsaoMesAtual.valor)}`,
      detalhe: `Faixa provável de ${brlCurto(previsaoMesAtual.baixo)} a ${brlCurto(previsaoMesAtual.alto)}. ${falta > 0 ? `Faltam ${brlCurto(falta)} para chegar lá.` : "O mês já passou da previsão."}${prev && prev.historico < 6 ? " Estimativa inicial, com pouco histórico." : ""}`,
    });
  } else if (previsaoVendas) {
    ins.push({
      nivel: "info",
      titulo: `Previsão para ${previsaoVendas.rotulos[0]}: ${brlCurto(previsaoVendas.valores[0])}`,
      detalhe: `Faixa provável de ${brlCurto(previsaoVendas.baixo[0])} a ${brlCurto(previsaoVendas.alto[0])}.${prev && prev.historico < 6 ? " Estimativa inicial, com pouco histórico." : ""}`,
    });
  }
  if (abaixoMinima.length) {
    ins.push({
      nivel: "risco",
      titulo: `${abaixoMinima.length} ${abaixoMinima.length === 1 ? "pedido do mês ficou" : "pedidos do mês ficaram"} abaixo da margem mínima de ${fmtPct(b.margemMinima)}`,
      detalhe: abaixoMinima.slice(0, 3).map((p) => `#${p.numero} ${p.cliente_nome} (${fmtPct((Number(p.lucro) / Number(p.total)) * 100)})`).join(" · "),
      href: abaixoMinima.length === 1 ? `/pedidos/${abaixoMinima[0].id}` : "/pedidos",
    });
  }
  for (const c of [...anomalias, ...anomaliasParciais].slice(0, 2)) {
    ins.push({
      nivel: "atencao",
      titulo: `Gasto com ${c.nome.toLowerCase()} ${fmtPct(c.anomalia!.desvio)} acima do normal`,
      detalhe: `${brlCurto(c.valor)} em ${rotuloMes(mes)}; o normal tem sido ${brlCurto(c.anomalia!.mediana)} por mês.`,
      href: "/analises?aba=financeiro",
    });
  }
  if (paradas.length) {
    ins.push({
      nivel: "atencao",
      titulo: `${paradas.length} ${paradas.length === 1 ? "negociação parada" : "negociações paradas"}, somando ${brlCurto(soma(paradas.map((n) => Number(n.valor_estimado ?? 0))))}`,
      detalhe: "Sem movimento há mais de 14 dias ou com a próxima ação vencida.",
      href: "/analises?aba=funil",
    });
  }
  if (propostasSemResposta.length) {
    ins.push({
      nivel: "atencao",
      titulo: `${propostasSemResposta.length} ${propostasSemResposta.length === 1 ? "orçamento enviado está" : "orçamentos enviados estão"} sem resposta há mais de 7 dias`,
      detalhe: `${brlCurto(soma(propostasSemResposta.map((o) => Number(o.total))))} esperando. ${propostasSemResposta.filter((o) => o.visualizado_em).length} já foram abertos pelo cliente.`,
      href: "/orcamentos",
    });
  }
  if (atrasados.length) {
    ins.push({
      nivel: "risco",
      titulo: `${atrasados.length} ${atrasados.length === 1 ? "prazo atrasado" : "prazos atrasados"} em pedidos`,
      detalhe: atrasados.slice(0, 3).map((m) => `#${m.numero} ${ROTULOS2.marco[m.tipo as "medicao"] ?? m.tipo} (${m.dias} d)`).join(" · "),
      href: "/prazos",
    });
  }
  const negativo = projecaoBaixa.findIndex((v) => v < 0);
  if (negativo >= 0 && saldoAtual >= 0) {
    ins.push({
      nivel: "risco",
      titulo: `O caixa pode ficar negativo em ${previsaoCaixa.rotulos[negativo]}`,
      detalhe: `Considerando as contas lançadas e que ${fmtPct(taxaEmDia * 100)} dos clientes pagam em dia.`,
      href: "/analises?aba=financeiro",
    });
  }
  if (inadimplencia !== null && inadimplencia >= 10) {
    ins.push({
      nivel: "risco",
      titulo: `${fmtPct(inadimplencia)} do que há para receber está vencido`,
      detalhe: `${brlCurto(totalVencidoReceber)} em ${vencidosReceber.length} ${vencidosReceber.length === 1 ? "parcela" : "parcelas"}.`,
      href: "/financeiro?tipo=receber",
    });
  }
  const comBase = porOrigem.filter((o) => o.taxa !== null && o.ganhos + o.perdidos >= 4 && o.nome !== "Não informada");
  if (comBase.length >= 2) {
    const ord = [...comBase].sort((a, b2) => (b2.taxa ?? 0) - (a.taxa ?? 0));
    const melhor = ord[0];
    const pior = ord[ord.length - 1];
    if ((melhor.taxa ?? 0) > 0 && (pior.taxa ?? 0) >= 0 && (melhor.taxa ?? 0) - (pior.taxa ?? 0) >= 15) {
      ins.push({
        nivel: "bom",
        titulo: `${melhor.nome} é a origem que mais fecha: ${fmtPct(melhor.taxa ?? 0)} das negociações`,
        detalhe: `${pior.nome} fecha ${fmtPct(pior.taxa ?? 0)}. Vale reforçar o canal que converte.`,
        href: "/analises?aba=funil",
      });
    }
  }
  if (gargalo && gargalo.qtd >= 3 && gargalo.qtd >= soma(ordensEtapa.map((e) => e.qtd)) * 0.4) {
    ins.push({ nivel: "atencao", titulo: `Gargalo na produção: ${gargalo.qtd} ordens em ${gargalo.nome.toLowerCase()}`, detalhe: "Mais de 40% das ordens em andamento estão nessa etapa.", href: "/producao" });
  }
  if (acumAnoAnt > 0) {
    const v = variacao(acumAno, acumAnoAnt)!;
    if (Math.abs(v) >= 5) {
      ins.push({ nivel: v > 0 ? "bom" : "atencao", titulo: `No ano, as vendas estão ${fmtPct(Math.abs(v))} ${v > 0 ? "acima" : "abaixo"} de ${ano - 1}`, detalhe: `${brlCurto(acumAno)} até ${rotuloMes(mes)} contra ${brlCurto(acumAnoAnt)} no mesmo período.`, href: "/analises?aba=vendas" });
    }
  }
  const ordem = { risco: 0, atencao: 1, bom: 2, info: 3 };
  ins.sort((a, b2) => ordem[a.nivel] - ordem[b2.nivel]);

  return {
    meses,
    rotulos,
    emAndamento,
    contra,
    insights: ins.slice(0, 8),
    vendas: {
      vendido, lucro, qtd, margem, mediaMovel: mediaMovel(vendido),
      vendidoMes, lucroMes, qtdMes: pedMes.length,
      varMes: varVend, varAno: variacao(vendidoMes, vendidoAnoAnt),
      previsao: previsaoVendas, previsaoMesAtual, historicoPrevisao: prev?.historico ?? 0, sazonal: prev?.sazonal ?? false,
      ticket, ticketMediana, porVendedor, porUnidade, porAmbiente,
      anoAtual, anoAnterior, ano, acumAno, acumAnoAnt,
      margemMinima: b.margemMinima,
      totalJanela: soma(vendido), lucroJanela: soma(lucro),
    },
    funil: { etapas, ponderado, potencial, conversao, ciclo, novos, ganhosMes, paradas, porOrigem, motivos, abertas: abertas.length, fechadas: fechadasJanela.length, ganhas: ganhasJanela.length, novosMes: novos[novos.length - 1] ?? 0 },
    producao: { pctPrazo, prazoPorMes, atrasoMedio, atrasoPorTipo, atrasados, proximos7: proximos7.length, ordensEtapa, chamadosMes, chamadosAbertos, assistPorPedido, concluidos: concluidosJanela.length },
    financeiro: {
      entradas, saidas, resultado, saldoAcum, previsaoCaixa, taxaEmDia,
      entradasMes: entradas[entradas.length - 1] ?? 0, saidasMes: saidas[saidas.length - 1] ?? 0,
      varEntradas: variacao(entradas[entradas.length - 1] ?? 0, entradas[entradas.length - 2] ?? 0),
      varSaidas: variacao(saidas[saidas.length - 1] ?? 0, saidas[saidas.length - 2] ?? 0),
      categorias, anomalias: [...anomalias, ...anomaliasParciais].map((a) => a.nome),
      faixas, totalVencidoReceber, totalVencidoPagar: soma(vencidosPagar.map((l) => Number(l.valor))), inadimplencia, totalAReceber,
      aReceberFut, aPagarFut, fixasMedia, margemContrib, pontoEquilibrio,
    },
  };
}

export type Analise = ReturnType<typeof calcular>;

function agrupar<T>(lista: T[], chave: (x: T) => string, valor: (x: T) => number, extra?: (x: T) => number) {
  const m = new Map<string, { valor: number; extra: number }>();
  for (const x of lista) {
    const k = chave(x);
    const r = m.get(k) ?? { valor: 0, extra: 0 };
    r.valor += valor(x);
    if (extra) r.extra += extra(x);
    m.set(k, r);
  }
  return [...m.entries()].map(([nome, r]) => ({ nome, valor: r.valor, extra: r.extra })).sort((a, b) => b.valor - a.valor);
}

function normalizarAmbiente(a: string | null) {
  const t = a?.trim();
  if (!t) return "Sem ambiente";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function isoMenosDias(iso: string, n: number) {
  return new Date(Date.parse(iso) - n * 86_400_000).toISOString().slice(0, 10);
}
function isoMaisDias(iso: string, n: number) {
  return isoMenosDias(iso, -n);
}

function fmtPct(v: number) {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 10 ? 0 : 1 })}%`;
}
