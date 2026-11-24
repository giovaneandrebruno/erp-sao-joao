import { connection } from "next/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Selo, Tabela, Titulo } from "@/components/ui";
import { ROTULOS2, data, hojeISO } from "@/lib/format";
import { diasUteisEntre, somarDiasUteis } from "@/lib/dias-uteis";
import { avisosDoProcesso } from "@/lib/processo-avisos";

export default async function PrazosPage() {
  await connection(); // a data de hoje muda: a tela é sempre montada na hora
  const supabase = await createClient();
  const hoje = hojeISO();
  const { data: marcos } = await supabase
    .from("pedido_marcos")
    .select("id, tipo, previsto, pedido_id, pedidos!inner(numero, status, clientes(nome)), responsavel:responsavel_id(nome)")
    .is("realizado", null)
    .not("previsto", "is", null)
    .lte("previsto", hojeISO(21))
    .not("pedidos.status", "in", "(entregue,cancelado)")
    .order("previsto");

  // Orçamentos ainda em rascunho: prontos em até X dias úteis depois do pedido do comercial
  const [{ data: cfg }, { data: rascunhos }] = await Promise.all([
    supabase.from("configuracoes").select("prazo_orcamento_dias_uteis").single(),
    supabase.from("orcamentos").select("id, numero, solicitado_em, criado_em, clientes(nome)").eq("status", "rascunho").order("solicitado_em").limit(500),
  ]);
  const prazoOrc = Number(cfg?.prazo_orcamento_dias_uteis ?? 5);
  const orcamentos = (rascunhos ?? [])
    .map((o) => {
      const pedido = o.solicitado_em ?? o.criado_em.slice(0, 10);
      const ate = somarDiasUteis(pedido, prazoOrc);
      return { ...o, pedido, ate, faltam: diasUteisEntre(hoje, ate) };
    })
    .sort((a, b) => a.ate.localeCompare(b.ate));

  const avisos = await avisosDoProcesso(supabase, hoje, 21);
  const { data: pessoas } = await supabase.from("perfis").select("user_id, nome, email");
  const pessoaDe = (uid: string | null) => { const x = pessoas?.find((q) => q.user_id === uid); return x ? x.nome || x.email : "—"; };
  const datasLimite = avisos.filter((a) => a.tipo === "dlp" || a.tipo === "dle");
  const paradas = avisos.filter((a) => a.tipo === "atendimento" || a.tipo === "pasta");
  const linhasAviso = (lista: typeof avisos) =>
    lista.map((a) => (
      <tr key={a.chave}>
        <td className="px-4 py-3">{data(a.quando)}</td>
        <td className="px-4 py-3">{a.vencido ? <Selo cor="red">{a.motivo}</Selo> : <span className="text-stone-700">{a.motivo}</span>}</td>
        <td className="px-4 py-3"><Link href={a.href} className="text-madeira-700 hover:underline">{a.numero ? `#${a.numero} · ` : ""}{a.cliente}</Link></td>
        <td className="px-4 py-3">{pessoaDe(a.responsavelId)}</td>
      </tr>
    ));
  const atrasados = (marcos ?? []).filter((m) => m.previsto! < hoje);
  const proximos = (marcos ?? []).filter((m) => m.previsto! >= hoje);

  const linhas = (lista: typeof atrasados, atraso: boolean) =>
    lista.map((m) => {
      const ped = m.pedidos as unknown as { numero: number; clientes: { nome: string } | null };
      const resp = m.responsavel as unknown as { nome: string } | null;
      const dias = diasUteisEntre(hoje, m.previsto!); // em dias úteis
      return (
        <tr key={m.id}>
          <td className="px-4 py-3">{data(m.previsto)}</td>
          <td className="px-4 py-3">{atraso ? <Selo cor="red">{Math.max(1, -dias)} dia(s) útil(eis) de atraso</Selo> : m.previsto === hoje ? <Selo cor="amber">hoje</Selo> : <span className="text-stone-500">em {dias} dia(s) útil(eis)</span>}</td>
          <td className="px-4 py-3 font-medium">{ROTULOS2.marco[m.tipo as keyof typeof ROTULOS2.marco]}</td>
          <td className="px-4 py-3"><Link href={`/pedidos/${m.pedido_id}`} className="text-madeira-700 hover:underline">#{ped.numero} · {ped.clientes?.nome}</Link></td>
          <td className="px-4 py-3">{resp?.nome ?? "—"}</td>
        </tr>
      );
    });

  return (
    <>
      <Titulo>Prazos</Titulo>
      <p className="mb-6 text-sm text-stone-500">Marcos de todos os pedidos em andamento: atrasados e os próximos 21 dias. Para dar baixa, abra o pedido. Os prazos contam dias úteis (segunda a sexta, sem feriados nacionais).</p>
      <h2 className="mb-1 text-lg font-semibold">Orçamentos a entregar ({orcamentos.length})</h2>
      <p className="mb-3 text-sm text-stone-500">Orçamentos ainda em rascunho. Cada um deve ficar pronto em até {prazoOrc} dias úteis depois do pedido do comercial.</p>
      <div className="mb-8">
        <Tabela cabecalho={["Entregar até", "Situação", "Orçamento", "Pedido do comercial"]} vazio={!orcamentos.length}>
          {orcamentos.map((o) => {
            const cli = o.clientes as unknown as { nome: string } | null;
            return (
              <tr key={o.id}>
                <td className="px-4 py-3">{data(o.ate)}</td>
                <td className="px-4 py-3">{o.faltam < 0 ? <Selo cor="red">{-o.faltam} dia(s) útil(eis) de atraso</Selo> : o.faltam === 0 ? <Selo cor="amber">hoje</Selo> : <span className="text-stone-500">faltam {o.faltam} dia(s) útil(eis)</span>}</td>
                <td className="px-4 py-3"><Link href={`/orcamentos/${o.id}`} className="text-madeira-700 hover:underline">#{o.numero} · {cli?.nome ?? "—"}</Link></td>
                <td className="px-4 py-3">{data(o.pedido)}</td>
              </tr>
            );
          })}
        </Tabela>
      </div>
      <h2 className="mb-3 text-lg font-semibold text-red-700">Atrasados ({atrasados.length})</h2>
      <div className="mb-8">
        <Tabela cabecalho={["Previsto", "Situação", "Marco", "Pedido", "Responsável"]} vazio={!atrasados.length}>{linhas(atrasados, true)}</Tabela>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Próximos 21 dias ({proximos.length})</h2>
      <Tabela cabecalho={["Previsto", "Situação", "Marco", "Pedido", "Responsável"]} vazio={!proximos.length}>{linhas(proximos, false)}</Tabela>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Datas limite de assinatura e entrega ({datasLimite.length})</h2>
      <p className="mb-3 text-sm text-stone-500">DLP: prazo para o cliente assinar o executivo. DLE: data limite de entrega. Vencidas e as dos próximos 21 dias.</p>
      <Tabela cabecalho={["Data", "Aviso", "Pedido", "Responsável"]} vazio={!datasLimite.length}>{linhasAviso(datasLimite)}</Tabela>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-red-700">Parados ({paradas.length})</h2>
      <p className="mb-3 text-sm text-stone-500">Clientes novos com o prazo do atendimento vencido e pastas devolvidas para correção.</p>
      <Tabela cabecalho={["Desde", "O que está parado", "Cliente", "Responsável"]} vazio={!paradas.length}>{linhasAviso(paradas)}</Tabela>
    </>
  );
}
