import Link from "next/link";
import { JanelaBotao } from "@/components/janela";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Titulo, inputCls } from "@/components/ui";
import { ROTULOS2, brl, data, hojeISO } from "@/lib/format";
import { DEPENDE_DE, DIAS_GARANTIA, TIPOS_ASSISTENCIA } from "@/lib/processo";
import { abrirChamado, atualizarChamado } from "./actions";

const COR = { aberto: "red", agendado: "blue", em_atendimento: "amber", resolvido: "green" } as const;

export default async function AssistenciaPage({ searchParams }: PageProps<"/assistencia">) {
  const { resolvidos } = await searchParams;
  const supabase = await createClient();
  let consulta = supabase
    .from("chamados")
    .select("*, clientes(nome, telefone), pedidos(numero)")
    .order("status")
    .order("data_agendada", { nullsFirst: true });
  if (!resolvidos) consulta = consulta.neq("status", "resolvido");
  const [{ data: chamados }, { data: clientes }, { data: pedidos }, { data: montadores }] = await Promise.all([
    consulta,
    supabase.from("clientes").select("id, nome").order("nome"),
    supabase.from("pedidos_resumo").select("id, numero, cliente_nome").order("numero", { ascending: false }).limit(100),
    supabase.from("parceiros").select("id, nome").eq("tipo", "montador").eq("ativo", true).order("nome"),
  ]);
  // garantia de 1 ano contada da montagem (ou vistoria) feita no pedido
  const idsPedidos = [...new Set((chamados ?? []).map((c) => c.pedido_id).filter(Boolean))] as string[];
  const { data: marcosFeitos } = idsPedidos.length
    ? await supabase.from("pedido_marcos").select("pedido_id, realizado").in("pedido_id", idsPedidos).in("tipo", ["montagem", "vistoria"]).not("realizado", "is", null)
    : { data: [] };
  const fimGarantia = new Map<string, string>();
  for (const m of marcosFeitos ?? []) {
    const d = new Date(`${m.realizado}T12:00:00`);
    d.setDate(d.getDate() + DIAS_GARANTIA);
    const fim = d.toISOString().slice(0, 10);
    if (!fimGarantia.has(m.pedido_id) || fim > fimGarantia.get(m.pedido_id)!) fimGarantia.set(m.pedido_id, fim);
  }
  const hoje = hojeISO();
  const camposTipo = (c?: { tipo?: string | null; depende_de?: string | null; taxa_visita?: number | null; diarias?: number | null; valor_diaria?: number | null }) => (
    <>
      <Campo rotulo="Tipo" className="md:col-span-2">
        <select name="tipo" defaultValue={c?.tipo ?? "garantia"} className={inputCls}>
          {Object.entries(TIPOS_ASSISTENCIA).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Depende de" className="md:col-span-2">
        <select name="depende_de" defaultValue={c?.depende_de ?? ""} className={inputCls}>
          <option value="">—</option>
          {Object.entries(DEPENDE_DE).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Taxa de visita (R$)" className="md:col-span-2"><input name="taxa_visita" inputMode="decimal" defaultValue={c?.taxa_visita ?? ""} placeholder="deslocamento" className={inputCls} /></Campo>
      <Campo rotulo="Diárias (mau uso, mín. 1)" className="md:col-span-2"><input name="diarias" inputMode="decimal" defaultValue={c?.diarias ?? ""} className={inputCls} /></Campo>
      <Campo rotulo="Valor da diária (R$)" className="md:col-span-2"><input name="valor_diaria" inputMode="decimal" defaultValue={c?.valor_diaria ?? ""} className={inputCls} /></Campo>
    </>
  );

  const novoChamado = (
    <JanelaBotao rotulo="Abrir chamado" titulo="Abrir chamado" descricao="Registre o problema e, se já souber, a data da visita e o montador.">
      <form action={abrirChamado} className="grid gap-3 md:grid-cols-6">
        <Campo rotulo="Cliente *" className="md:col-span-2">
          <select name="cliente_id" required defaultValue="" className={inputCls}>
            <option value="" disabled>Selecione...</option>
            {clientes?.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Pedido" className="md:col-span-2">
          <select name="pedido_id" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {pedidos?.map((p) => <option key={p.id} value={p.id}>#{p.numero} · {p.cliente_nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Prioridade" className="md:col-span-1">
          <select name="prioridade" defaultValue="normal" className={inputCls}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option></select>
        </Campo>
        <div className="md:col-span-1" />
        {camposTipo()}
        <p className="text-xs text-stone-500 md:col-span-6">Avise o cliente que a visita tem custo de deslocamento e verificação. Defeito de fabricação dentro de 1 ano: a peça é pedida à fábrica sem custo. Mau uso ou fora da garantia: orçamento das peças ou das diárias de serviço (mínimo 1 diária).</p>
        <Campo rotulo="O que aconteceu *" className="md:col-span-6"><textarea name="descricao" required rows={2} placeholder="Porta do armário desalinhada, corrediça travando..." className={inputCls} /></Campo>
        <Campo rotulo="Data da visita" className="md:col-span-2"><input type="date" name="data_agendada" className={inputCls} /></Campo>
        <Campo rotulo="Montador" className="md:col-span-2">
          <select name="responsavel_id" defaultValue="" className={inputCls}>
            <option value="">—</option>
            {montadores?.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </Campo>
        <div className="flex items-end md:col-span-2"><Botao type="submit">Abrir chamado</Botao></div>
      </form>
    </JanelaBotao>
  );

  return (
    <>
      <Titulo acao={<div className="flex items-center gap-4"><Link href={resolvidos ? "/assistencia" : "/assistencia?resolvidos=1"} className="text-sm text-madeira-700 hover:underline">{resolvidos ? "Ocultar resolvidos" : "Mostrar resolvidos"}</Link>{novoChamado}</div>}>
        Assistência técnica
      </Titulo>

      <div className="mb-8 flex flex-col gap-3">
        {chamados?.map((c) => {
          const cli = c.clientes as unknown as { nome: string; telefone: string | null };
          const ped = c.pedidos as unknown as { numero: number } | null;
          return (
            <Cartao key={c.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-semibold">#{c.numero} · {cli.nome}</span>
                <Selo cor={COR[c.status as keyof typeof COR]}>{ROTULOS2.statusChamado[c.status as keyof typeof COR]}</Selo>
                {c.prioridade === "alta" && <Selo cor="red">prioridade alta</Selo>}
                {c.tipo === "mau_uso" ? <Selo>mau uso (cobrado)</Selo> : <Selo cor="green">garantia de fábrica</Selo>}
                {c.depende_de && <Selo cor={c.depende_de === "fabrica" ? "amber" : "blue"}>{DEPENDE_DE[c.depende_de as keyof typeof DEPENDE_DE]}</Selo>}
                {c.pedido_id && fimGarantia.has(c.pedido_id) && (fimGarantia.get(c.pedido_id)! < hoje
                  ? <Selo cor="red">fora de 1 ano (venceu {data(fimGarantia.get(c.pedido_id))})</Selo>
                  : <span className="text-xs text-stone-500">garantia até {data(fimGarantia.get(c.pedido_id))}</span>)}
                {(Number(c.taxa_visita ?? 0) > 0 || Number(c.diarias ?? 0) > 0) && (
                  <span className="text-xs text-stone-600">
                    {Number(c.taxa_visita ?? 0) > 0 && `visita ${brl(c.taxa_visita)}`}
                    {c.tipo === "mau_uso" && Number(c.diarias ?? 0) > 0 && ` · ${Number(c.diarias)} diária(s) de ${brl(c.valor_diaria)} = ${brl(Number(c.diarias) * Number(c.valor_diaria ?? 0))}`}
                    {c.tipo === "mau_uso" && ` · total ${brl(Number(c.taxa_visita ?? 0) + Number(c.diarias ?? 0) * Number(c.valor_diaria ?? 0))}`}
                  </span>
                )}
                {ped && <Link href={`/pedidos/${c.pedido_id}`} className="text-xs text-madeira-700 hover:underline">pedido #{ped.numero}</Link>}
                <span className="text-xs text-stone-400">aberto em {data(c.criado_em)}</span>
              </div>
              <p className="mb-3 text-sm">{c.descricao}</p>
              <form action={atualizarChamado.bind(null, c.id)} className="grid gap-3 md:grid-cols-12">
                <Campo rotulo="Status" className="md:col-span-2">
                  <select name="status" defaultValue={c.status} className={inputCls}>
                    {Object.entries(ROTULOS2.statusChamado).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Visita" className="md:col-span-2"><input type="date" name="data_agendada" defaultValue={c.data_agendada ?? ""} className={inputCls} /></Campo>
                <Campo rotulo="Montador" className="md:col-span-2">
                  <select name="responsavel_id" defaultValue={c.responsavel_id ?? ""} className={inputCls}>
                    <option value="">—</option>
                    {montadores?.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Solução / observações" className="md:col-span-6"><input name="solucao" defaultValue={c.solucao ?? ""} className={inputCls} /></Campo>
                {camposTipo(c)}
                <div className="flex items-end md:col-span-2"><Botao type="submit" variante="secundario">Salvar</Botao></div>
              </form>
            </Cartao>
          );
        })}
        {!chamados?.length && <Cartao><p className="text-sm text-stone-400">Nenhum chamado em aberto.</p></Cartao>}
      </div>

    </>
  );
}
