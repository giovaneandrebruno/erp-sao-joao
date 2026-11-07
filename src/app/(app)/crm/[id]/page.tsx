import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Botao, Campo, Cartao, Selo, Titulo, inputCls } from "@/components/ui";
import { ROTULOS2, data } from "@/lib/format";
import { adicionarNota, atualizarNegociacao, gerarOrcamento } from "../actions";
import { CamposNegociacao } from "../campos";

export default async function NegociacaoPage({ params }: PageProps<"/crm/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: n }, { data: notas }, { data: parceiros }] = await Promise.all([
    supabase.from("negociacoes").select("*, clientes(id, nome, telefone, email)").eq("id", id).maybeSingle(),
    supabase.from("negociacao_notas").select("*").eq("negociacao_id", id).order("criado_em", { ascending: false }),
    supabase.from("parceiros").select("id, nome, tipo").eq("ativo", true).order("nome"),
  ]);
  if (!n) notFound();
  const cli = n.clientes as unknown as { id: string; nome: string; telefone: string | null; email: string | null };

  return (
    <>
      <Titulo
        acao={
          <form action={gerarOrcamento.bind(null, id)}>
            <Botao>{n.orcamento_id ? "Abrir orçamento" : "Fazer orçamento"}</Botao>
          </form>
        }
      >
        {cli.nome} <Selo cor={n.etapa === "ganho" ? "green" : n.etapa === "perdido" ? "red" : "blue"}>{ROTULOS2.etapaNegociacao[n.etapa as keyof typeof ROTULOS2.etapaNegociacao]}</Selo>
      </Titulo>
      <p className="mb-6 text-sm text-stone-600">
        <Link href={`/clientes/${cli.id}`} className="text-madeira-700 hover:underline">ver cadastro</Link>
        {cli.telefone && <> · {cli.telefone} · <a className="text-green-700 hover:underline" target="_blank" rel="noreferrer" href={`https://wa.me/55${cli.telefone.replace(/\D/g, "")}`}>abrir WhatsApp</a></>}
        {cli.email && <> · {cli.email}</>}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao className="lg:col-span-2">
          <form action={atualizarNegociacao.bind(null, id)} className="grid gap-4 md:grid-cols-6">
            <Campo rotulo="O que o cliente quer" className="md:col-span-4"><input name="titulo" defaultValue={n.titulo} className={inputCls} /></Campo>
            <Campo rotulo="Etapa" className="md:col-span-2">
              <select name="etapa" defaultValue={n.etapa} className={inputCls}>
                {Object.entries(ROTULOS2.etapaNegociacao).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
              </select>
            </Campo>
            <CamposNegociacao n={n} parceiros={parceiros ?? []} />
            <Campo rotulo="Motivo da perda (se perdido)" className="md:col-span-6"><input name="motivo_perda" defaultValue={n.motivo_perda ?? ""} placeholder="Preço, prazo, fechou com concorrente..." className={inputCls} /></Campo>
            <div className="md:col-span-6"><Botao type="submit">Salvar</Botao></div>
          </form>
        </Cartao>

        <Cartao>
          <h2 className="mb-3 font-semibold">Histórico</h2>
          <form action={adicionarNota.bind(null, id)} className="mb-4 flex flex-col gap-2">
            <textarea name="texto" rows={2} placeholder="Ex.: cliente pediu para refazer com MDF amadeirado" className={inputCls} />
            <Botao type="submit" variante="secundario">Anotar</Botao>
          </form>
          <ul className="flex flex-col gap-3 text-sm">
            {notas?.map((nota) => (
              <li key={nota.id} className="border-l-2 border-madeira-300 pl-3">
                <div className="text-xs text-stone-400">{data(nota.criado_em)}</div>
                <div className="whitespace-pre-line">{nota.texto}</div>
              </li>
            ))}
            {!notas?.length && <li className="text-stone-400">Nenhuma anotação ainda.</li>}
          </ul>
        </Cartao>
      </div>
    </>
  );
}
