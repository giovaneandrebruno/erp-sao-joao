import { Cartao, inputCls, estiloBotao } from "@/components/ui";
import { JanelaBotao } from "@/components/janela";
import { dataHora } from "@/lib/format";
import { BRIEFING, type RespostasBriefing } from "@/lib/briefing";
import { salvarBriefing } from "./pasta-actions";

export type BriefingDoCliente = {
  respostas: RespostasBriefing; preenchido_por_nome: string | null; alterado_por_nome: string | null; criado_em: string; atualizado_em: string;
} | null;

/** Briefing: as perguntas da ficha de atendimento, preenchidas quando o cliente chega. */
export function Briefing({ clienteId, nome, briefing, colunas = 3, titulo = "Briefing do cliente" }: { clienteId: string; nome: string; briefing: BriefingDoCliente; colunas?: 2 | 3; titulo?: string }) {
  const r = briefing?.respostas ?? {};
  const respondidas = Object.values(r).filter(Boolean).length;
  const total = BRIEFING.reduce((t, s) => t + s.perguntas.length, 0);
  return (
    <Cartao className="h-full">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">{titulo}</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {briefing
              ? `${respondidas} de ${total} perguntas respondidas · ${briefing.alterado_por_nome ? `alterado por ${briefing.alterado_por_nome}` : `preenchido por ${briefing.preenchido_por_nome ?? "equipe"}`} em ${dataHora(briefing.atualizado_em)}`
              : "Preencha no primeiro atendimento: o que o cliente quer, estilo, cores, materiais, prazo e orçamento. Nome, endereço e contato já estão no cadastro."}
          </p>
        </div>
        <JanelaBotao rotulo={briefing ? "Alterar briefing" : "Preencher briefing"} titulo="Briefing do cliente" descricao={nome} variante={briefing ? "secundario" : "primario"} icone={briefing ? null : "mais"} largura="lg" aviso="Briefing salvo">
          <form action={salvarBriefing.bind(null, clienteId)} className="grid gap-6">
            {BRIEFING.map((s, i) => (
              <fieldset key={s.titulo} className="grid gap-3">
                <legend className="mb-1 text-sm font-semibold text-stone-800">{i + 2}. {s.titulo}</legend>
                {s.perguntas.map((p) => (
                  <label key={p.campo} className="flex flex-col gap-1.5 text-sm">
                    <span className="text-xs font-medium text-stone-600">{p.pergunta}</span>
                    <textarea name={p.campo} rows={2} defaultValue={r[p.campo] ?? ""} placeholder={p.exemplo} className={inputCls} />
                  </label>
                ))}
              </fieldset>
            ))}
            <p className="text-xs text-stone-500">Anexos (plantas, fotos de inspiração, medidas): quando o cliente fechar, coloque na Pasta do cliente.</p>
            <button className={`${estiloBotao.primario} justify-self-end`}>Salvar briefing</button>
          </form>
        </JanelaBotao>
      </div>
      {briefing ? (
        <div className={`grid gap-x-6 gap-y-5 sm:grid-cols-2 ${colunas === 3 ? "lg:grid-cols-3" : ""}`}>
          {BRIEFING.map((s) => (
            <div key={s.titulo}>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{s.titulo}</h4>
              <dl className="grid gap-2 text-sm">
                {s.perguntas.map((p) => (
                  <div key={p.campo}>
                    <dt className="text-xs text-stone-500">{p.pergunta}</dt>
                    <dd className="whitespace-pre-line text-stone-800">{r[p.campo] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">Briefing ainda não preenchido.</p>
      )}
    </Cartao>
  );
}
