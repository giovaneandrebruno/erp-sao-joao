import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROTULOS2, data, linkMapa, linkWhats } from "@/lib/format";
import { concluirServico } from "../../actions";
import { Checkin, EnviarFotos } from "./visita";

type Cli = { nome: string; telefone: string | null; endereco: string | null; cidade: string | null; uf: string | null };

export default async function ServicoPage({ params }: PageProps<"/campo/[tipo]/[id]">) {
  const { tipo, id } = await params;
  if (tipo !== "marco" && tipo !== "chamado") notFound();
  const supabase = await createClient();

  let titulo = "";
  let quando: string | null = null;
  let cliente: Cli | null = null;
  let detalhe: string | null = null;
  let itens: { ambiente: string | null; descricao: string; quantidade: number }[] = [];
  let concluido = false;

  if (tipo === "marco") {
    const { data: m } = await supabase
      .from("pedido_marcos")
      .select("id, tipo, previsto, realizado, observacoes, pedido_id, pedidos(numero, observacoes, clientes(nome, telefone, endereco, cidade, uf))")
      .eq("id", id)
      .maybeSingle();
    if (!m) notFound();
    const p = m.pedidos as unknown as { numero: number; observacoes: string | null; clientes: Cli };
    titulo = `${ROTULOS2.marco[m.tipo as keyof typeof ROTULOS2.marco]} · pedido #${p.numero}`;
    quando = m.previsto;
    cliente = p.clientes;
    detalhe = [m.observacoes, p.observacoes].filter(Boolean).join("\n") || null;
    concluido = Boolean(m.realizado);
    const { data: its } = await supabase.from("pedido_itens").select("ambiente, descricao, quantidade").eq("pedido_id", m.pedido_id).order("ordem");
    itens = its ?? [];
  } else {
    const { data: c } = await supabase
      .from("chamados")
      .select("id, numero, descricao, status, data_agendada, em_garantia, prioridade, clientes(nome, telefone, endereco, cidade, uf)")
      .eq("id", id)
      .maybeSingle();
    if (!c) notFound();
    titulo = `Assistência #${c.numero}${c.em_garantia ? " · na garantia" : ""}`;
    quando = c.data_agendada;
    cliente = c.clientes as unknown as Cli;
    detalhe = c.descricao;
    concluido = c.status === "resolvido";
  }

  const { data: visitas } = await supabase
    .from("visitas")
    .select("id, checkin_em, checkout_em, fotos, observacoes, latitude, longitude")
    .eq(tipo === "marco" ? "marco_id" : "chamado_id", id)
    .order("checkin_em", { ascending: false });
  const aberta = visitas?.find((v) => !v.checkout_em) ?? null;
  const todasFotos = (visitas ?? []).flatMap((v) => v.fotos ?? []);
  const { data: assinadas } = todasFotos.length ? await supabase.storage.from("fotos").createSignedUrls(todasFotos, 3600) : { data: [] };

  const whats = linkWhats(cliente?.telefone);
  const mapa = linkMapa(cliente?.endereco, cliente?.cidade, cliente?.uf);
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <>
      <Link href="/campo" className="mb-4 inline-block text-sm text-stone-500">‹ Voltar</Link>
      <div className="mb-6">
        <p className="text-sm text-violeta">{titulo}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{cliente?.nome}</h1>
        <p className="text-sm text-stone-500">Previsto para {data(quando)}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2">
        {mapa ? <a href={mapa} target="_blank" rel="noreferrer" className="vidro rounded-2xl p-4 text-center text-sm font-medium text-stone-800">🗺️ Como chegar</a> : <span className="vidro rounded-2xl p-4 text-center text-sm text-stone-400">Sem endereço</span>}
        {whats ? <a href={whats} target="_blank" rel="noreferrer" className="vidro rounded-2xl p-4 text-center text-sm font-medium text-neon">💬 WhatsApp</a> : <span className="vidro rounded-2xl p-4 text-center text-sm text-stone-400">Sem telefone</span>}
      </div>

      {(cliente?.endereco || detalhe) && (
        <div className="vidro mb-6 space-y-2 rounded-2xl p-5 text-sm">
          {cliente?.endereco && <p className="text-stone-700">{[cliente.endereco, cliente.cidade, cliente.uf].filter(Boolean).join(", ")}</p>}
          {detalhe && <p className="whitespace-pre-line text-stone-500">{detalhe}</p>}
        </div>
      )}

      {itens.length > 0 && (
        <div className="vidro mb-6 rounded-2xl p-5">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">O que vai ser instalado</h2>
          <ul className="divide-y divide-stone-100 text-sm">
            {itens.map((i, n) => (
              <li key={n} className="flex justify-between gap-3 py-2">
                <span><span className="text-stone-400">{i.ambiente ? `${i.ambiente} · ` : ""}</span>{i.descricao}</span>
                <span className="font-mono text-stone-500">{Number(i.quantidade)}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {concluido ? (
        <p className="mb-6 rounded-2xl bg-neon/10 p-4 text-center text-sm font-medium text-neon">✓ Serviço concluído</p>
      ) : !aberta ? (
        <div className="mb-6"><Checkin tipo={tipo} id={id} /></div>
      ) : (
        <div className="mb-6 space-y-3">
          <p className="text-center text-xs text-stone-500">Chegada registrada às {hora(aberta.checkin_em)}</p>
          <EnviarFotos tipo={tipo} id={id} visitaId={aberta.id} />
          <form action={concluirServico.bind(null, tipo, id, aberta.id)} className="vidro space-y-3 rounded-2xl p-4">
            <textarea name="observacoes" rows={3} placeholder={tipo === "chamado" ? "O que foi feito?" : "Observações (faltou peça, cliente ausente…)"} className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm" />
            <button className="w-full rounded-2xl bg-neon py-4 text-base font-semibold text-white">✓ Concluir serviço</button>
          </form>
        </div>
      )}

      {(assinadas?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Fotos</h2>
          <div className="grid grid-cols-3 gap-2">
            {assinadas!.map((f) => f.signedUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={f.path} href={f.signedUrl} target="_blank" rel="noreferrer"><img src={f.signedUrl} alt="" className="aspect-square w-full rounded-xl object-cover" /></a>
            ))}
          </div>
        </div>
      )}

      {(visitas?.length ?? 0) > 0 && (
        <div className="text-xs text-stone-500">
          {visitas!.map((v) => (
            <p key={v.id}>
              {data(v.checkin_em)} · chegada {hora(v.checkin_em)}{v.checkout_em ? ` · saída ${hora(v.checkout_em)}` : ""}{v.observacoes ? ` · ${v.observacoes}` : ""}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
