import Link from "next/link";
import { Cartao, estiloBotao } from "@/components/ui";
import { appConfigurado, type Conexao } from "@/lib/redes";
import { dataHora } from "@/lib/format";

export const PERIODOS = [7, 30, 90] as const;
export type Periodo = (typeof PERIODOS)[number];

export function lerDias(v: unknown): Periodo {
  return v === "7" ? 7 : v === "90" ? 90 : 30;
}

/** Os últimos `dias` dias até ontem, no fuso de São Paulo (AAAA-MM-DD). */
export function diasDoPeriodo(dias: number, terminaHoje = false) {
  const lista: string[] = [];
  for (let i = dias - (terminaHoje ? 1 : 0); i >= (terminaHoje ? 0 : 1); i--) {
    lista.push(new Date(Date.now() - i * 86400000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
  }
  return lista;
}

export const rotuloDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function porDia(mapa: Record<string, number> | null | undefined, dias: string[]) {
  return dias.map((d) => mapa?.[d] ?? 0);
}

export const soma = (v: number[]) => v.reduce((a, b) => a + b, 0);

/** Variação percentual (nulo quando não há base). */
export function variacao(atual: number | undefined, antes: number | undefined) {
  if (!antes || atual === undefined) return null;
  return ((atual - antes) / antes) * 100;
}

/** Botões 7, 30 e 90 dias. */
export function EscolherPeriodo({ dias, base, extra = {} }: { dias: Periodo; base: string; extra?: Record<string, string> }) {
  const pilula = (ativo: boolean) => `rounded-full px-3 py-1.5 transition ${ativo ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-white"}`;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      {PERIODOS.map((n) => {
        const p = new URLSearchParams(extra);
        if (n !== 30) p.set("dias", String(n));
        const q = p.toString();
        return <Link key={n} href={q ? `${base}?${q}` : base} className={pilula(dias === n)}>Últimos {n} dias</Link>;
      })}
    </div>
  );
}

/** Quando o Instagram e o Facebook ainda não estão ligados ao sistema. */
export function SemConexao({ conexao }: { conexao: Conexao | null }) {
  const pronto = appConfigurado();
  const religar = Boolean(conexao && !conexao.token);
  return (
    <Cartao className="mb-6">
      <h2 className="text-[15px] font-semibold text-stone-900">{religar ? "Ligue o Instagram e o Facebook de novo" : "Ligar o Instagram e o Facebook"}</h2>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">
        {religar
          ? "A ligação com a Meta parou de valer. Clique no botão e entre de novo com o Facebook que administra a página."
          : "Os números do Instagram e do Facebook e as mensagens que o pessoal manda aparecem aqui depois de ligar as contas. O Instagram precisa ser conta comercial e estar ligado à página do Facebook."}
      </p>
      {pronto ? (
        <a href="/redes/conectar" className={`${estiloBotao.primario} mt-4`}>Conectar com o Facebook</a>
      ) : (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Falta só o cadastro do aplicativo na Meta. Assim que ele estiver pronto, o botão de conectar aparece aqui.</p>
      )}
    </Cartao>
  );
}

/** Linha com a conta ligada, quem ligou e quando. */
export function ContaLigada({ conexao }: { conexao: Conexao }) {
  return (
    <p className="mb-4 text-xs text-stone-500">
      {conexao.ig_usuario ? <>Instagram <b className="font-medium text-stone-700">@{conexao.ig_usuario}</b> · </> : null}
      Facebook <b className="font-medium text-stone-700">{conexao.page_nome}</b> · ligado em {dataHora(conexao.conectado_em)}
      {conexao.conectado_por_nome ? ` por ${conexao.conectado_por_nome}` : ""}
    </p>
  );
}

export function ErroDaMeta({ mensagem }: { mensagem: string }) {
  return (
    <Cartao className="mb-6">
      <h2 className="text-[15px] font-semibold text-stone-900">A Meta não respondeu</h2>
      <p className="mt-1 text-sm text-stone-600">Tente de novo em alguns minutos. Se continuar, ligue as contas de novo na Visão geral.</p>
      <p className="mt-2 font-mono text-xs text-stone-400">{mensagem}</p>
    </Cartao>
  );
}

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function diaDaSemana(iso: string) {
  return new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay();
}

export function haQuanto(iso: string) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 60) return `há ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

/** Itens com data dentro dos últimos `dias` dias. */
export function recentes<T extends { em: string }>(itens: T[], dias: number) {
  const desde = Date.now() - dias * 86400000;
  return itens.filter((p) => Date.parse(p.em) >= desde);
}
