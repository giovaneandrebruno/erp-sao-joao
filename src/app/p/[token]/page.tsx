import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROTULOS2, brl, data, hojeISO } from "@/lib/format";
import { Aceite } from "./aceite";

export const metadata: Metadata = { title: "Proposta", robots: { index: false, follow: false } };

type Proposta = {
  numero: number;
  status: string;
  validade: string | null;
  criado_em: string;
  observacoes: string | null;
  prazo_entrega_dias: number | null;
  forma_pagamento: keyof typeof ROTULOS2.formaPagamento;
  parcelas: number;
  condicoes_pagamento: string | null;
  subtotal: number;
  desconto: number;
  total: number;
  aceite_em: string | null;
  aceite_nome: string | null;
  cliente: string;
  itens: { ambiente: string | null; descricao: string; quantidade: number; preco_unitario: number }[];
  empresa: { nome: string; telefone: string | null; email: string | null; cidade: string | null; uf: string | null };
};

export default async function PropostaPublica({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const { data: bruto } = await supabase.rpc("proposta_publica", { p_token: token });
  const p = bruto as Proposta | null;
  if (!p) notFound();

  const ambientes = new Map<string, Proposta["itens"]>();
  for (const i of p.itens) ambientes.set(i.ambiente ?? "Itens", [...(ambientes.get(i.ambiente ?? "Itens") ?? []), i]);
  const vencida = Boolean(p.validade && p.validade < hojeISO());
  const podeAceitar = !p.aceite_em && !vencida && (p.status === "rascunho" || p.status === "enviado");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:py-16">
      <header className="mb-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marinho text-lg font-semibold text-white">{p.empresa.nome.slice(0, 1)}</div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-stone-900">{p.empresa.nome}</div>
            <div className="text-xs text-stone-500">{[p.empresa.cidade, p.empresa.uf].filter(Boolean).join(" / ")}</div>
          </div>
        </div>
        <div className="text-right text-xs text-stone-500">
          Proposta nº {p.numero}<br />{data(p.criado_em)}
        </div>
      </header>

      <section className="borda-gradiente relative mb-8 overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violeta/15 blur-3xl" />
        <p className="text-sm text-stone-500">Proposta preparada para</p>
        <h1 className="mb-6 text-3xl font-semibold tracking-tight text-stone-900">{p.cliente}</h1>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">Investimento</p>
        <p className="texto-gradiente break-words font-mono text-4xl font-semibold tracking-tighter sm:text-5xl">{brl(p.total)}</p>
        <p className="mt-2 text-sm text-stone-500">
          {ROTULOS2.formaPagamento[p.forma_pagamento]}{p.parcelas > 1 ? ` em ${p.parcelas}×` : ""}
          {p.prazo_entrega_dias ? ` · entrega em ${p.prazo_entrega_dias} dias` : ""}
          {p.validade ? ` · válida até ${data(p.validade)}` : ""}
        </p>
      </section>

      <section className="mb-8 space-y-4">
        {[...ambientes.entries()].map(([amb, itens]) => (
          <div key={amb} className="vidro rounded-2xl p-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold text-stone-900">{amb}</h2>
              <span className="font-mono text-sm text-stone-500">{brl(itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0))}</span>
            </div>
            <ul className="divide-y divide-stone-100 text-sm">
              {itens.map((i, n) => (
                <li key={n} className="flex justify-between gap-4 py-2">
                  <span className="text-stone-700">{Number(i.quantidade) !== 1 && <span className="text-stone-400">{Number(i.quantidade)}× </span>}{i.descricao}</span>
                  <span className="whitespace-nowrap font-mono text-stone-500">{brl(i.quantidade * i.preco_unitario)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {Number(p.desconto) > 0 && (
          <div className="flex justify-between px-6 text-sm text-stone-600">
            <span>Subtotal {brl(p.subtotal)} · desconto</span><span className="font-mono">−{brl(p.desconto)}</span>
          </div>
        )}
      </section>

      {(p.condicoes_pagamento || p.observacoes) && (
        <section className="vidro mb-8 space-y-3 rounded-2xl p-6 text-sm">
          {p.condicoes_pagamento && <div><h3 className="mb-1 font-semibold">Condições de pagamento</h3><p className="whitespace-pre-line text-stone-600">{p.condicoes_pagamento}</p></div>}
          {p.observacoes && <div><h3 className="mb-1 font-semibold">Observações</h3><p className="whitespace-pre-line text-stone-600">{p.observacoes}</p></div>}
        </section>
      )}

      {p.aceite_em ? (
        <p className="rounded-2xl bg-neon/10 p-6 text-center text-sm font-medium text-neon">✓ Proposta aceita por {p.aceite_nome} em {data(p.aceite_em)}. Em breve entraremos em contato.</p>
      ) : vencida ? (
        <p className="vidro rounded-2xl p-6 text-center text-sm text-stone-500">Esta proposta venceu. Fale com a gente para atualizarmos os valores.</p>
      ) : podeAceitar ? (
        <Aceite token={token} />
      ) : null}

      <footer className="mt-12 text-center text-xs text-stone-400">
        {[p.empresa.telefone, p.empresa.email].filter(Boolean).join(" · ")}
      </footer>
    </main>
  );
}
