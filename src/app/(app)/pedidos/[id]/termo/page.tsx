import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { data, hojeISO } from "@/lib/format";
import { BotaoImprimir } from "../contrato/botao";

/** Termo de entrega e montagem para o cliente assinar (impresso ou salvo em PDF). */
export default async function TermoEntregaPage({ params }: PageProps<"/pedidos/[id]/termo">) {
  await connection(); // a data de hoje muda: a tela é sempre montada na hora
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: p }, { data: itens }, { data: cfg }, { data: marcos }] = await Promise.all([
    supabase.from("pedidos").select("id, numero, criado_em, cliente_id, checklist_entrega, entrega_recebido_por, entrega_observacoes").eq("id", id).maybeSingle(),
    supabase.from("pedido_itens").select("id, ambiente, descricao, quantidade").eq("pedido_id", id).order("ordem"),
    supabase.from("configuracoes").select("nome_fantasia, razao_social, cnpj, endereco, cidade, uf, telefone, checklist_entrega_itens").single(),
    supabase.from("pedido_marcos").select("tipo, realizado").eq("pedido_id", id).in("tipo", ["entrega", "montagem"]),
  ]);
  if (!p) notFound();
  const { data: cliente } = await supabase.from("clientes").select("nome, cpf_cnpj, endereco, cidade, uf").eq("id", p.cliente_id).maybeSingle();
  const marcados = (p.checklist_entrega ?? {}) as Record<string, boolean>;
  const checklist = String(cfg?.checklist_entrega_itens ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  const dataEntrega = marcos?.find((m) => m.tipo === "montagem")?.realizado ?? marcos?.find((m) => m.tipo === "entrega")?.realizado ?? hojeISO();
  const cidade = cfg?.cidade ? `${cfg.cidade}${cfg.uf ? `/${cfg.uf}` : ""}, ` : "";

  return (
    <div className="papel mx-auto max-w-3xl rounded-2xl bg-superficie p-10 text-sm leading-relaxed print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><BotaoImprimir /></div>
      <div className="mb-6 border-b pb-4 text-center">
        <h1 className="text-xl font-semibold">Termo de entrega e montagem</h1>
        <p className="text-stone-500">Pedido nº {p.numero}/{String(p.criado_em).slice(0, 4)}</p>
      </div>

      <p className="mb-3"><strong>EMPRESA:</strong> {cfg?.razao_social || cfg?.nome_fantasia}{cfg?.cnpj ? `, CNPJ ${cfg.cnpj}` : ""}{cfg?.telefone ? `, telefone ${cfg.telefone}` : ""}.</p>
      <p className="mb-6"><strong>CLIENTE:</strong> {cliente?.nome}{cliente?.cpf_cnpj ? `, CPF/CNPJ ${cliente.cpf_cnpj}` : ""}{cliente?.endereco ? `, ${cliente.endereco}` : ""}{cliente?.cidade ? `, ${cliente.cidade}/${cliente.uf ?? ""}` : ""}.</p>

      <h2 className="mb-2 font-semibold">Móveis entregues</h2>
      <table className="mb-6 w-full">
        <thead className="border-b text-left text-stone-500">
          <tr><th className="py-2">Ambiente</th><th>Descrição</th><th className="text-right">Qtd</th></tr>
        </thead>
        <tbody>
          {(itens ?? []).map((i) => (
            <tr key={i.id} className="border-b border-stone-100">
              <td className="py-1.5">{i.ambiente ?? "Geral"}</td>
              <td>{i.descricao}</td>
              <td className="text-right">{Number(i.quantidade)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {checklist.length > 0 && (
        <>
          <h2 className="mb-2 font-semibold">Conferência</h2>
          <ul className="mb-6 flex flex-col gap-1">
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 items-center justify-center border border-stone-500 text-[11px] leading-none">{marcados[item] ? "✓" : ""}</span>
                {item}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mb-2 font-semibold">Observações</h2>
      <p className="mb-6 min-h-12 border-b border-stone-300 pb-2">{p.entrega_observacoes ?? ""}</p>

      <p className="mb-10">
        Declaro que recebi os móveis acima, montados e em perfeito estado, e que conferi os itens marcados. Eventuais ajustes estão descritos nas observações e serão atendidos pela assistência técnica dentro da garantia.
      </p>
      <p className="mb-14">{cidade}{data(dataEntrega)}.</p>

      <div className="grid grid-cols-2 gap-10 text-center">
        <div className="border-t border-stone-500 pt-2">{p.entrega_recebido_por || cliente?.nome}<br /><span className="text-stone-500">Cliente</span></div>
        <div className="border-t border-stone-500 pt-2">{cfg?.nome_fantasia}<br /><span className="text-stone-500">Responsável pela montagem</span></div>
      </div>
    </div>
  );
}
