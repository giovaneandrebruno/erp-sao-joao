import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Titulo, inputCls } from "@/components/ui";
import { ROTULOS2, data } from "@/lib/format";
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

  return (
    <>
      <Titulo acao={<Link href={resolvidos ? "/assistencia" : "/assistencia?resolvidos=1"} className="text-sm text-madeira-700 hover:underline">{resolvidos ? "Ocultar resolvidos" : "Mostrar resolvidos"}</Link>}>
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
                {c.em_garantia ? <Selo cor="green">garantia</Selo> : <Selo>cobrado</Selo>}
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
                <Campo rotulo="Solução / observações" className="md:col-span-5"><input name="solucao" defaultValue={c.solucao ?? ""} className={inputCls} /></Campo>
                <div className="flex items-end md:col-span-1"><Botao type="submit" variante="secundario">Salvar</Botao></div>
              </form>
            </Cartao>
          );
        })}
        {!chamados?.length && <Cartao><p className="text-sm text-stone-400">Nenhum chamado em aberto.</p></Cartao>}
      </div>

      <Cartao>
        <h2 className="mb-3 font-semibold">Abrir chamado</h2>
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
          <label className="flex items-end gap-2 pb-2 text-sm md:col-span-1"><input type="checkbox" name="em_garantia" defaultChecked /> Em garantia</label>
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
      </Cartao>
    </>
  );
}
