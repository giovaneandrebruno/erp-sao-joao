import Link from "next/link";
import { Colunas, Linhas } from "@/components/graficos/graficos";
import { formatar } from "@/components/graficos/formato";
import { BarrasH, Bloco, Funil, Insights, Kpi, Legenda, Segmentada } from "@/components/graficos/paineis";
import { ESTADO, ORDINAL, SERIE } from "@/components/graficos/cores";
import { ROTULOS2, data } from "@/lib/format";
import { rotuloMes } from "@/lib/analise";
import type { Analise } from "./calculo";

const grade2 = "grid gap-4 lg:grid-cols-2";
const kpis = "mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
const CINZA = "#9a9eb0";

function AvisoPrevisao({ historico, sazonal }: { historico: number; sazonal: boolean }) {
  if (!historico) return <>Previsão aparece com 3 meses de vendas lançadas.</>;
  return (
    <>
      Previsão por tendência dos últimos {historico} meses{sazonal ? ", com ajuste de sazonalidade" : ""}, faixa com 80% de chance.
      {historico < 6 && " Estimativa inicial: fica mais precisa com mais histórico."}
    </>
  );
}

export function VisaoGeral({ a, mes }: { a: Analise; mes: string }) {
  const v = a.vendas;
  const f = a.funil;
  const fin = a.financeiro;
  const ult12 = a.rotulos.slice(-12);
  return (
    <>
      <div className={kpis}>
        <Kpi rotulo={`Vendido em ${rotuloMes(mes)}`} valor={formatar(v.vendidoMes)} variacao={v.varMes} contra={a.contra} serie={v.vendido.slice(-12)} rotulos={ult12} sub={`${v.qtdMes} ${v.qtdMes === 1 ? "pedido" : "pedidos"}`} href="/analises?aba=vendas" />
        <Kpi rotulo="Lucro previsto do mês" valor={formatar(v.lucroMes)} sub={`margem de ${formatar(v.vendidoMes ? (v.lucroMes / v.vendidoMes) * 100 : 0, "pct")} · mínima ${formatar(v.margemMinima, "pct")}`} serie={v.lucro.slice(-12)} rotulos={ult12} />
        <Kpi rotulo="Funil ponderado" valor={formatar(f.ponderado)} sub={`${f.abertas} negociações abertas · ${formatar(f.potencial)} no total`} href="/analises?aba=funil" />
        <Kpi rotulo="Resultado de caixa do mês" valor={formatar(fin.entradasMes - fin.saidasMes)} sub={`entrou ${formatar(fin.entradasMes)} · saiu ${formatar(fin.saidasMes)}`} serie={fin.resultado.slice(-12)} rotulos={ult12} href="/analises?aba=financeiro" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Bloco
            titulo="Vendas por mês e previsão"
            sub={<AvisoPrevisao historico={v.historicoPrevisao} sazonal={v.sazonal} />}
            legenda={<Legenda itens={[{ nome: "Vendido", cor: SERIE[0] }, { nome: "Média de 3 meses", tipo: "linha" }, ...(v.previsao ? [{ nome: "Previsão", tipo: "tracejado" as const }] : [])]} />}
            tabela={{
              cabecalho: ["Mês", "Vendido", "Lucro", "Pedidos"],
              linhas: [
                ...a.rotulos.map((r, i) => [r, formatar(v.vendido[i]), formatar(v.lucro[i]), v.qtd[i]]),
                ...(v.previsaoMesAtual ? [[`${rotuloMes(mes)} (previsão do mês)`, `${formatar(v.previsaoMesAtual.baixo)} a ${formatar(v.previsaoMesAtual.alto)}`, "—", "—"]] : []),
                ...(v.previsao?.rotulos.map((r, i) => [`${r} (previsão)`, `${formatar(v.previsao!.baixo[i])} a ${formatar(v.previsao!.alto[i])}`, "—", "—"]) ?? []),
              ],
            }}
          >
            <Colunas
              rotulos={a.rotulos.slice(-12)}
              series={[{ nome: "Vendido", valores: v.vendido.slice(-12) }]}
              tendencia={{ nome: "Média de 3 meses", valores: v.mediaMovel.slice(-12) }}
              previsao={v.previsao ?? undefined}
              alvoUltimo={v.previsaoMesAtual ?? undefined}
              destaque={Math.min(12, a.rotulos.length) - 1}
              links={a.meses.slice(-12).map((m) => `/analises?aba=vendas&mes=${m}`)}
              altura={260}
            />
          </Bloco>
          <Bloco
            titulo="Caixa: acumulado e projeção"
            sub="Entradas menos saídas nos últimos meses e o que as contas já lançadas indicam para os próximos 3"
            legenda={<Legenda itens={[{ nome: "Acumulado", cor: SERIE[0] }, { nome: "Projeção", tipo: "tracejado" }]} />}
          >
            <Linhas rotulos={a.rotulos.slice(-12)} series={[{ nome: "Acumulado", valores: fin.saldoAcum.slice(-12) }]} previsao={fin.previsaoCaixa} area altura={200} />
          </Bloco>
        </div>
        <Bloco titulo="O que merece atenção" sub="Gerado automaticamente a partir dos seus dados">
          <Insights itens={a.insights} />
        </Bloco>
      </div>
    </>
  );
}

export function Vendas({ a, mes }: { a: Analise; mes: string }) {
  const v = a.vendas;
  const temAnoAnt = v.anoAnterior.some((x) => x > 0);
  return (
    <>
      <div className={kpis}>
        <Kpi rotulo={`Vendido em ${rotuloMes(mes)}`} valor={formatar(v.vendidoMes)} variacao={v.varMes} contra={a.contra} serie={v.vendido.slice(-12)} rotulos={a.rotulos.slice(-12)} />
        <Kpi rotulo="Mesmo mês do ano anterior" valor={v.varAno === null ? "—" : `${v.varAno > 0 ? "+" : ""}${formatar(v.varAno, "pct")}`} sub={a.emAndamento ? "comparando os mesmos dias" : "variação das vendas"} />
        <Kpi rotulo={`Ticket médio · ${a.meses.length} meses`} valor={formatar(v.ticket)} sub={`metade dos pedidos fica abaixo de ${formatar(v.ticketMediana)}`} />
        <Kpi rotulo={`Margem · ${a.meses.length} meses`} valor={formatar(v.totalJanela ? (v.lucroJanela / v.totalJanela) * 100 : 0, "pct")} sub={`lucro previsto ${formatar(v.lucroJanela)}`} />
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco
          titulo="Vendido e lucro por mês"
          sub="Pelo mês em que o pedido foi fechado"
          legenda={<Legenda itens={[{ nome: "Vendido" }, { nome: "Lucro previsto" }]} />}
          tabela={{ cabecalho: ["Mês", "Vendido", "Lucro", "Margem"], linhas: a.rotulos.map((r, i) => [r, formatar(v.vendido[i]), formatar(v.lucro[i]), formatar(v.margem[i], "pct")]) }}
        >
          <Colunas rotulos={a.rotulos} series={[{ nome: "Vendido", valores: v.vendido }, { nome: "Lucro previsto", valores: v.lucro }]} destaque={a.rotulos.length - 1} links={a.meses.map((m) => `/analises?aba=vendas&mes=${m}`)} />
        </Bloco>
        <Bloco
          titulo={`${v.ano} contra ${v.ano - 1}`}
          sub={temAnoAnt ? `Acumulado no ano: ${formatar(v.acumAno)} contra ${formatar(v.acumAnoAnt)} no mesmo período` : "A comparação aparece quando houver vendas lançadas no ano anterior"}
          legenda={<Legenda itens={[{ nome: String(v.ano), cor: SERIE[0] }, { nome: String(v.ano - 1), cor: CINZA }]} />}
          tabela={{ cabecalho: ["Mês", String(v.ano), String(v.ano - 1)], linhas: v.anoAnterior.map((x, i) => [rotuloMes(`2000-${String(i + 1).padStart(2, "0")}`, false), formatar(v.anoAtual[i]), formatar(x)]) }}
        >
          <Linhas
            rotulos={Array.from({ length: 12 }, (_, i) => rotuloMes(`2000-${String(i + 1).padStart(2, "0")}`, false))}
            series={[{ nome: String(v.ano), valores: v.anoAtual, cor: SERIE[0] }, { nome: String(v.ano - 1), valores: v.anoAnterior, cor: CINZA }]}
          />
        </Bloco>
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco titulo="Margem de lucro por mês" sub={`A linha marca a margem mínima configurada (${formatar(v.margemMinima, "pct")})`} tabela={{ cabecalho: ["Mês", "Margem"], linhas: a.rotulos.map((r, i) => [r, formatar(v.margem[i], "pct")]) }}>
          <Linhas rotulos={a.rotulos} series={[{ nome: "Margem", valores: v.margem }]} formato="pct" area referencia={{ valor: v.margemMinima, rotulo: `mínima ${formatar(v.margemMinima, "pct")}` }} />
        </Bloco>
        <Bloco titulo="Vendas por vendedor" sub={`Últimos ${a.meses.length} meses · lucro ao lado`} tabela={{ cabecalho: ["Vendedor", "Vendido", "Lucro"], linhas: v.porVendedor.map((x) => [x.nome, formatar(x.valor), formatar(x.extra)]) }}>
          <BarrasH itens={v.porVendedor.map((x) => ({ nome: x.nome, valor: x.valor, detalhe: `lucro ${formatar(x.extra)}` }))} />
        </Bloco>
      </div>
      <div className={grade2}>
        <Bloco titulo="O que mais vende, por ambiente" sub={`Últimos ${a.meses.length} meses, pelo nome do ambiente no pedido`} tabela={{ cabecalho: ["Ambiente", "Vendido"], linhas: v.porAmbiente.map((x) => [x.nome, formatar(x.valor)]) }}>
          <BarrasH itens={v.porAmbiente.map((x) => ({ nome: x.nome, valor: x.valor }))} />
        </Bloco>
        <Bloco titulo="Vendas por unidade" sub={`Últimos ${a.meses.length} meses`}>
          <Segmentada partes={v.porUnidade.map((x) => ({ nome: x.nome, valor: x.valor }))} />
        </Bloco>
      </div>
    </>
  );
}

export function FunilAba({ a }: { a: Analise }) {
  const f = a.funil;
  return (
    <>
      <div className={kpis}>
        <Kpi rotulo="Funil ponderado" valor={formatar(f.ponderado)} sub="valor de cada etapa × chance de fechar" />
        <Kpi rotulo={`Taxa de conversão · ${a.meses.length} meses`} valor={f.conversao === null ? "—" : formatar(f.conversao, "pct")} sub={`${f.ganhas} ganhas de ${f.fechadas} encerradas`} />
        <Kpi rotulo="Ciclo de venda" valor={f.ciclo === null ? "—" : formatar(f.ciclo, "dias")} sub="do primeiro contato ao fechamento (mediana)" />
        <Kpi rotulo="Novos contatos no mês" valor={String(f.novosMes)} variacao={f.novos.length > 1 && !a.emAndamento ? (f.novos[f.novos.length - 2] ? ((f.novosMes - f.novos[f.novos.length - 2]) / f.novos[f.novos.length - 2]) * 100 : null) : undefined} serie={f.novos.slice(-12)} rotulos={a.rotulos.slice(-12)} formato="num" />
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco titulo="Onde estão as negociações abertas" sub="Quantas estão em cada etapa agora, o valor estimado e a chance usada na previsão" tabela={{ cabecalho: ["Etapa", "Negociações", "Valor", "Chance", "Ponderado"], linhas: f.etapas.map((e) => [e.nome, e.qtd, formatar(e.valor), formatar((e.ponderado / (e.valor || 1)) * 100, "pct"), formatar(e.ponderado)]) }}>
          <Funil etapas={f.etapas} />
        </Bloco>
        <Bloco titulo="Contatos novos e vendas ganhas por mês" legenda={<Legenda itens={[{ nome: "Contatos novos" }, { nome: "Ganhas" }]} />} tabela={{ cabecalho: ["Mês", "Contatos", "Ganhas"], linhas: a.rotulos.map((r, i) => [r, f.novos[i], f.ganhosMes[i]]) }}>
          <Colunas rotulos={a.rotulos} series={[{ nome: "Contatos novos", valores: f.novos }, { nome: "Ganhas", valores: f.ganhosMes }]} formato="num" rotular="nenhum" destaque={a.rotulos.length - 1} />
        </Bloco>
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco titulo="Qual origem fecha mais" sub="Taxa de conversão das negociações encerradas, por origem do cliente" tabela={{ cabecalho: ["Origem", "Contatos", "Ganhas", "Perdidas", "Conversão"], linhas: f.porOrigem.map((o) => [o.nome, o.contatos, o.ganhos, o.perdidos, o.taxa === null ? "—" : formatar(o.taxa, "pct")]) }}>
          <BarrasH formato="pct" max={100} itens={f.porOrigem.filter((o) => o.taxa !== null).map((o) => ({ nome: o.nome, valor: o.taxa ?? 0, detalhe: `${o.ganhos} de ${o.ganhos + o.perdidos}` })).sort((x, y) => y.valor - x.valor)} vazio="Ainda não há negociações encerradas com origem." />
        </Bloco>
        <Bloco titulo="Por que perdemos vendas" sub={`Últimos ${a.meses.length} meses`} tabela={{ cabecalho: ["Motivo", "Vezes"], linhas: f.motivos.map((m) => [m.nome, m.valor]) }}>
          <BarrasH formato="num" itens={f.motivos.map((m) => ({ nome: m.nome, valor: m.valor, cor: SERIE[1] }))} vazio="Nenhuma venda perdida registrada." />
        </Bloco>
      </div>
      <Bloco titulo="Negociações paradas" sub="Sem movimento há mais de 14 dias ou com a próxima ação vencida, das maiores para as menores">
        {f.paradas.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {f.paradas.slice(0, 10).map((n) => (
              <li key={n.id}>
                <Link href={`/crm/${n.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-violeta">
                  <span><span className="font-medium">{n.titulo}</span> <span className="text-stone-500">· {n.cliente_nome} · {ROTULOS2.etapaNegociacao[n.etapa as "novo"]}</span></span>
                  <span className="font-mono text-[13px] tabular-nums">{formatar(n.valor_estimado ?? 0)} <span className="ml-2 font-sans text-xs text-stone-500">última mudança {data(n.atualizado_em)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-stone-400">Nenhuma negociação parada. Ótimo.</p>
        )}
      </Bloco>
    </>
  );
}

export function Producao({ a }: { a: Analise }) {
  const p = a.producao;
  return (
    <>
      <div className={kpis}>
        <Kpi rotulo={`Prazos cumpridos · ${a.meses.length} meses`} valor={p.pctPrazo === null ? "—" : formatar(p.pctPrazo, "pct")} sub={`${p.concluidos} etapas concluídas com data prevista`} />
        <Kpi rotulo="Atraso médio quando atrasa" valor={p.atrasoMedio === null ? "—" : formatar(p.atrasoMedio, "dias")} sub="entre a data prevista e a realizada" />
        <Kpi rotulo="Prazos atrasados agora" valor={String(p.atrasados.length)} sub={`${p.proximos7} vencem nos próximos 7 dias`} href="/prazos" />
        <Kpi rotulo="Assistências abertas" valor={String(p.chamadosAbertos)} sub={p.assistPorPedido === null ? "chamados de pós-venda" : `${formatar(p.assistPorPedido, "num")} chamados a cada 100 pedidos`} href="/assistencia" />
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco titulo="Onde estão as ordens de produção" sub="Ordens em andamento por etapa; a maior barra é o gargalo" tabela={{ cabecalho: ["Etapa", "Ordens", "Com prazo vencido"], linhas: p.ordensEtapa.map((e) => [e.nome, e.qtd, e.atrasadas]) }}>
          <BarrasH formato="num" max={Math.max(1, ...p.ordensEtapa.map((e) => e.qtd))} limite={20} itens={p.ordensEtapa.map((e, i) => ({ nome: e.nome, valor: e.qtd, cor: ORDINAL[Math.min(i, ORDINAL.length - 1)], detalhe: e.atrasadas ? `${e.atrasadas} com prazo vencido` : undefined }))} />
        </Bloco>
        <Bloco titulo="Prazos cumpridos por mês" sub="Etapas concluídas até a data prevista, pelo mês em que foram concluídas" tabela={{ cabecalho: ["Mês", "No prazo"], linhas: a.rotulos.map((r, i) => [r, formatar(p.prazoPorMes[i], "pct")]) }}>
          <Linhas rotulos={a.rotulos} series={[{ nome: "No prazo", valores: p.prazoPorMes }]} formato="pct" area referencia={{ valor: 90, rotulo: "meta sugerida 90%" }} />
        </Bloco>
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco titulo="Em que etapa mais atrasa" sub="Atraso médio em dias por tipo de prazo" tabela={{ cabecalho: ["Etapa", "Atraso médio"], linhas: p.atrasoPorTipo.map((x) => [x.nome, formatar(x.valor, "dias")]) }}>
          <BarrasH formato="dias" itens={p.atrasoPorTipo.filter((x) => x.valor > 0).map((x) => ({ nome: x.nome, valor: x.valor, cor: SERIE[1] }))} vazio="Nenhum atraso registrado no período." />
        </Bloco>
        <Bloco titulo="Chamados de assistência por mês" tabela={{ cabecalho: ["Mês", "Chamados"], linhas: a.rotulos.map((r, i) => [r, p.chamadosMes[i]]) }}>
          <Colunas rotulos={a.rotulos} series={[{ nome: "Chamados", valores: p.chamadosMes }]} formato="num" destaque={a.rotulos.length - 1} />
        </Bloco>
      </div>
      <Bloco titulo="Prazos atrasados" sub="Dos mais atrasados para os menos">
        {p.atrasados.length ? (
          <ul className="divide-y divide-stone-100 text-sm">
            {p.atrasados.slice(0, 10).map((m) => (
              <li key={`${m.pedido_id}-${m.tipo}`}>
                <Link href={`/pedidos/${m.pedido_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:text-violeta">
                  <span><span className="font-medium">Pedido #{m.numero}</span> <span className="text-stone-500">· {m.cliente_nome} · {ROTULOS2.marco[m.tipo as "medicao"] ?? m.tipo}</span></span>
                  <span className="text-xs text-stone-500">previsto {data(m.previsto)} · <span className="font-semibold" style={{ color: ESTADO.ruim }}>▼ {m.dias} {m.dias === 1 ? "dia" : "dias"}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-stone-400">Nenhum prazo atrasado.</p>
        )}
      </Bloco>
    </>
  );
}

export function Financeiro({ a, mes }: { a: Analise; mes: string }) {
  const f = a.financeiro;
  return (
    <>
      <div className={kpis}>
        <Kpi rotulo={`Entrou em ${rotuloMes(mes)}`} valor={formatar(f.entradasMes)} variacao={a.emAndamento ? undefined : f.varEntradas} serie={f.entradas.slice(-12)} rotulos={a.rotulos.slice(-12)} />
        <Kpi rotulo={`Saiu em ${rotuloMes(mes)}`} valor={formatar(f.saidasMes)} variacao={a.emAndamento ? undefined : f.varSaidas} bomSeSobe={false} serie={f.saidas.slice(-12)} rotulos={a.rotulos.slice(-12)} />
        <Kpi rotulo="A receber vencido" valor={formatar(f.totalVencidoReceber)} sub={f.inadimplencia === null ? "nada a receber em aberto" : `${formatar(f.inadimplencia, "pct")} do total a receber`} href="/financeiro?tipo=receber" />
        <Kpi
          rotulo="Ponto de equilíbrio"
          valor={f.pontoEquilibrio === null ? "—" : formatar(f.pontoEquilibrio)}
          sub={f.pontoEquilibrio === null ? "aparece com despesas e vendas lançadas" : `vendas por mês para pagar a estrutura (${formatar(f.fixasMedia)} de despesas ÷ ${formatar((f.margemContrib ?? 0) * 100, "pct")} de margem)`}
        />
      </div>
      <div className={`${grade2} mb-4`}>
        <Bloco
          titulo="Entradas e saídas por mês"
          sub="Pelo dia em que o dinheiro entrou ou saiu"
          legenda={<Legenda itens={[{ nome: "Entradas" }, { nome: "Saídas" }]} />}
          tabela={{ cabecalho: ["Mês", "Entradas", "Saídas", "Resultado"], linhas: a.rotulos.map((r, i) => [r, formatar(f.entradas[i]), formatar(f.saidas[i]), formatar(f.resultado[i])]) }}
        >
          <Colunas rotulos={a.rotulos} series={[{ nome: "Entradas", valores: f.entradas }, { nome: "Saídas", valores: f.saidas }]} destaque={a.rotulos.length - 1} rotular="nenhum" />
        </Bloco>
        <Bloco
          titulo="Resultado de caixa acumulado e projeção"
          sub={`Soma de entradas menos saídas no período. A projeção usa as contas já lançadas; a faixa de baixo considera que ${formatar(f.taxaEmDia * 100, "pct")} dos clientes pagam em dia.`}
          legenda={<Legenda itens={[{ nome: "Acumulado", cor: SERIE[0] }, { nome: "Projeção", tipo: "tracejado" }]} />}
          tabela={{
            cabecalho: ["Mês", "Acumulado", "A receber", "A pagar"],
            linhas: [
              ...a.rotulos.map((r, i) => [r, formatar(f.saldoAcum[i]), "—", "—"]),
              ...f.previsaoCaixa.rotulos.map((r, i) => [`${r} (projeção)`, formatar(f.previsaoCaixa.valores[i]), formatar(f.aReceberFut[i]), formatar(f.aPagarFut[i])]),
            ],
          }}
        >
          <Linhas rotulos={a.rotulos} series={[{ nome: "Acumulado", valores: f.saldoAcum }]} previsao={f.previsaoCaixa} area />
        </Bloco>
      </div>
      <div className={grade2}>
        <Bloco
          titulo={`Para onde foi o dinheiro em ${rotuloMes(mes)}`}
          sub={f.anomalias.length ? `Fora do normal: ${f.anomalias.join(", ")} (comparado com a mediana dos últimos 12 meses)` : "Despesas pagas por categoria"}
          tabela={{ cabecalho: ["Categoria", "Pago"], linhas: f.categorias.map((c) => [c.nome, formatar(c.valor)]) }}
        >
          <BarrasH
            itens={f.categorias.map((c) => ({ nome: f.anomalias.includes(c.nome) ? `${c.nome}  ⚠ acima do normal` : c.nome, valor: c.valor, cor: f.anomalias.includes(c.nome) ? ESTADO.atencao : SERIE[0] }))}
            vazio="Nenhum pagamento feito neste mês."
          />
        </Bloco>
        <Bloco titulo="Há quanto tempo está vencido" sub={`Valores a receber em atraso · ${formatar(f.totalVencidoReceber)} no total`} tabela={{ cabecalho: ["Atraso", "Valor"], linhas: f.faixas.map((x) => [x.nome, formatar(x.valor)]) }}>
          <BarrasH limite={10} max={Math.max(1, ...f.faixas.map((x) => x.valor))} itens={f.faixas.map((x, i) => ({ nome: x.nome, valor: x.valor, cor: ORDINAL[Math.min(i * 2, ORDINAL.length - 1)] }))} />
          {f.totalVencidoPagar > 0 && <p className="mt-4 text-xs text-stone-500">Contas a pagar vencidas: <span className="font-mono text-stone-900">{formatar(f.totalVencidoPagar)}</span></p>}
        </Bloco>
      </div>
    </>
  );
}
