/** Reuniões da diretoria (atas) e as ações combinadas em cada uma. */
export const TIPOS_REUNIAO = { pre: "Pré-reunião", reuniao: "Reunião", pos: "Pós-reunião" } as const;
export type TipoReuniao = keyof typeof TIPOS_REUNIAO;
export const ehTipoReuniao = (v: unknown): v is TipoReuniao => typeof v === "string" && Object.hasOwn(TIPOS_REUNIAO, v);

/** novo = combinada nesta reunião · pendente = veio de reunião anterior sem resolver · ok = resolvida */
export const SITUACOES_ACAO = { novo: ["Novo", "blue"], pendente: ["Pendente", "amber"], ok: ["OK", "green"] } as const;
export type SituacaoAcao = keyof typeof SITUACOES_ACAO;
export const ehSituacaoAcao = (v: unknown): v is SituacaoAcao => typeof v === "string" && Object.hasOwn(SITUACOES_ACAO, v);

export type Reuniao = {
  id: string; numero: number; data: string; tipo: TipoReuniao; assunto: string | null; participantes: string | null;
  local: string | null; inicio: string | null; termino: string | null; anotacoes: string | null; criado_por_nome: string | null;
};
export type Acao = {
  id: string; reuniao_id: string; descricao: string; responsavel: string | null; prazo: string | null;
  situacao: SituacaoAcao; concluida_em: string | null; observacao: string | null; criado_em: string;
};

/** "20ª" */
export const ordinal = (n: number) => `${n}ª`;

/** Responsáveis separados por vírgula, "e" ou barra: "Douglas, Andreina" → ["Douglas", "Andreina"]. */
export function pessoasDoTexto(t: string | null | undefined) {
  return (t ?? "").split(/\s*(?:,|;|\/|\be\b|\n)\s*/i).map((s) => s.trim()).filter(Boolean);
}
