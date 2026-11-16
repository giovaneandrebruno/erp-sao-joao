/**
 * Controle de produção (PCP) no formato da planilha da fábrica:
 * legenda de STATUS por sigla, colunas divididas em Comercial, Administrativo
 * e Operacional, e a conta "data da venda + prazo a cumprir = entrega limite".
 */

export const STATUS_PCP = [
  { sigla: "VR", nome: "Venda realizada", cor: "#FFCC99", fase: "Comercial" },
  { sigla: "MD", nome: "Memorial descritivo", cor: "#FF950E", fase: "Comercial" },
  { sigla: "OC", nome: "Obra em construção", cor: "#99CCFF", fase: "Comercial" },
  { sigla: "MF", nome: "Medição final", cor: "#33CCCC", fase: "Comercial" },
  { sigla: "AP", nome: "Ajustes projeto", cor: "#D99694", fase: "Projeto" },
  { sigla: "DET", nome: "Detalhamento", cor: "#D99694", fase: "Projeto" },
  { sigla: "PC", nome: "Plano de corte", cor: "#D99694", fase: "Fábrica" },
  { sigla: "CO", nome: "Corte e usinagem", cor: "#FFFF00", fase: "Fábrica" },
  { sigla: "PM", nome: "Pré-montagem", cor: "#C0C0C0", fase: "Fábrica" },
  { sigla: "EM", nome: "Entrega/montagem", cor: "#666699", fase: "Obra" },
  { sigla: "CL", nome: "Check-list", cor: "#99CCFF", fase: "Obra" },
  { sigla: "FIN", nome: "Finalizado", cor: "#33CCCC", fase: "Encerrado" },
  { sigla: "IP", nome: "Itens pendentes", cor: "#FFCC99", fase: "Obra" },
  { sigla: "PP", nome: "Projeto parado", cor: "#FF0000", fase: "Parado" },
] as const;

export type SiglaStatus = (typeof STATUS_PCP)[number]["sigla"];
export const SIGLAS = STATUS_PCP.map((s) => s.sigla) as SiglaStatus[];

export function statusPcp(sigla: string | null | undefined) {
  return STATUS_PCP.find((s) => s.sigla === sigla) ?? STATUS_PCP[0];
}

/** Caminho normal de uma OS. "Itens pendentes" e "Projeto parado" ficam fora da sequência. */
export const FLUXO: SiglaStatus[] = ["VR", "MD", "OC", "MF", "AP", "DET", "PC", "CO", "PM", "EM", "CL", "FIN"];

export function vizinho(sigla: string, direcao: 1 | -1): SiglaStatus | null {
  if (sigla === "IP") return direcao === 1 ? "FIN" : "EM";
  if (sigla === "PP") return null;
  const i = FLUXO.indexOf(sigla as SiglaStatus);
  if (i < 0) return null;
  return FLUXO[i + direcao] ?? null;
}

/** Posições usadas na planilha (a coluna POSIÇÃO). */
export const POSICOES = ["AGUARDANDO", "ANDAMENTO", "AGUARDANDO ENTREGA", "AGUARDANDO OBRA", "PENDENCIAS", "PARADO", "FINALIZADO"];

/** Cor de texto que dá leitura sobre o fundo da sigla. */
export function textoSobre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1f2b42" : "#ffffff";
}

// ------------------------------------------------------------------ colunas

export type Grupo = "Comercial" | "Administrativo" | "Operacional";
export type TipoCampo = "texto" | "marco" | "pessoa" | "data" | "longo";
export type Campo = { chave: string; rotulo: string; grupo: Grupo; tipo: TipoCampo; dica?: string };

/** Todas as colunas da planilha, na mesma ordem. */
export const CAMPOS: Campo[] = [
  { chave: "os", rotulo: "Ordem de serviço (OS)", grupo: "Comercial", tipo: "texto" },
  { chave: "cliente_nome", rotulo: "Cliente", grupo: "Comercial", tipo: "texto" },
  { chave: "consultor", rotulo: "Consultor", grupo: "Comercial", tipo: "pessoa" },
  { chave: "arquiteto", rotulo: "Arquiteto", grupo: "Comercial", tipo: "pessoa" },
  { chave: "data_venda", rotulo: "Data venda", grupo: "Comercial", tipo: "data" },
  { chave: "ambientes", rotulo: "Número ambientes totais", grupo: "Comercial", tipo: "texto" },
  { chave: "memorial", rotulo: "Memorial descritivo realizado", grupo: "Comercial", tipo: "marco" },
  { chave: "medicao", rotulo: "Medição realizada", grupo: "Comercial", tipo: "marco" },
  { chave: "prazo_texto", rotulo: "Prazos a cumprir", grupo: "Comercial", tipo: "texto" },
  { chave: "status_pcp", rotulo: "Status", grupo: "Administrativo", tipo: "texto" },
  { chave: "posicao", rotulo: "Posição", grupo: "Administrativo", tipo: "texto" },
  { chave: "inicio_ajustes", rotulo: "Início ajustes", grupo: "Administrativo", tipo: "marco" },
  { chave: "limite_ajustes", rotulo: "Data limite ajustes", grupo: "Administrativo", tipo: "marco" },
  { chave: "inicio_detalhamento", rotulo: "Início detalhamento", grupo: "Administrativo", tipo: "marco" },
  { chave: "resp_detalhamento", rotulo: "Responsável detalhamento", grupo: "Administrativo", tipo: "pessoa" },
  { chave: "limite_detalhamento", rotulo: "Data limite detalhamento", grupo: "Administrativo", tipo: "marco" },
  { chave: "envio_consultor", rotulo: "Envio projeto consultor", grupo: "Administrativo", tipo: "marco" },
  { chave: "aprovacao_cliente", rotulo: "Aprovação do projeto cliente", grupo: "Administrativo", tipo: "marco" },
  { chave: "compra_materia_prima", rotulo: "Compra matéria-prima", grupo: "Administrativo", tipo: "marco" },
  { chave: "liberacao_corte", rotulo: "Data liberação plano de corte", grupo: "Administrativo", tipo: "marco" },
  { chave: "inicio_pre_montagem", rotulo: "Início pré-montagem", grupo: "Operacional", tipo: "marco" },
  { chave: "resp_fabricacao", rotulo: "Responsável", grupo: "Operacional", tipo: "pessoa", dica: "Quem fabrica e pré-monta" },
  { chave: "limite_fabricacao", rotulo: "Data limite fabricação e pré-montagem", grupo: "Operacional", tipo: "marco" },
  { chave: "agendamento_entrega", rotulo: "Agendamento entrega", grupo: "Operacional", tipo: "marco" },
  { chave: "previsao_nf", rotulo: "Previsão faturamento NF", grupo: "Operacional", tipo: "marco" },
  { chave: "inicio_montagem", rotulo: "Início montagem", grupo: "Operacional", tipo: "marco" },
  { chave: "montador", rotulo: "Montador", grupo: "Operacional", tipo: "pessoa" },
  { chave: "termino_montagem", rotulo: "Término de montagem máximo", grupo: "Operacional", tipo: "marco" },
  { chave: "check_list", rotulo: "Check list", grupo: "Operacional", tipo: "marco" },
  { chave: "pendencias", rotulo: "Pendência montagem / observação", grupo: "Operacional", tipo: "longo" },
  { chave: "telefone", rotulo: "Telefone para contato", grupo: "Operacional", tipo: "texto" },
  { chave: "endereco", rotulo: "Endereço", grupo: "Operacional", tipo: "texto" },
];

export const GRUPOS: Grupo[] = ["Comercial", "Administrativo", "Operacional"];

/** Etapas (marcos) que o formulário e a ficha mostram como linha do tempo. */
export const MARCOS = CAMPOS.filter((c) => c.tipo === "marco");

// ------------------------------------------------------------------ valores

export type Ordem = Record<string, string | number | null> & { id: string; status_pcp: string };

export type EstadoMarco = "feito" | "data" | "pendente" | "duvida" | "nao_se_aplica" | "vazio" | "texto";

/** Lê o valor de uma etapa como na planilha: "OK", uma data, "?", "-", "PENDENTE" ou um texto. */
export function lerMarco(valor: unknown): { estado: EstadoMarco; data?: string; texto: string } {
  const t = String(valor ?? "").trim();
  if (!t) return { estado: "vazio", texto: "" };
  const d = dataDoTexto(t);
  const maiusc = t.toUpperCase();
  if (maiusc === "-" || maiusc === "N/A") return { estado: "nao_se_aplica", texto: t };
  if (/\bOK\b/.test(maiusc) || maiusc === "O") return { estado: "feito", data: d ?? undefined, texto: t };
  if (maiusc.includes("PENDENTE")) return { estado: "pendente", data: d ?? undefined, texto: t };
  if (maiusc.includes("?")) return { estado: "duvida", data: d ?? undefined, texto: t };
  if (d) return { estado: "data", data: d, texto: t };
  return { estado: "texto", texto: t };
}

/** "25/06/2025" ou "2025-06-25" → "2025-06-25". */
export function dataDoTexto(t: string): string | null {
  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(deIso: string, ateIso: string) {
  return Math.round((Date.parse(`${ateIso}T12:00:00Z`) - Date.parse(`${deIso}T12:00:00Z`)) / 86_400_000);
}

/** Prazo da OS em relação a hoje. */
export function situacaoPrazo(o: { status_pcp: string; entrega_limite?: unknown }, hoje: string) {
  const limite = typeof o.entrega_limite === "string" ? o.entrega_limite : null;
  if (o.status_pcp === "FIN") return { tipo: "concluida" as const, limite, dias: null };
  if (!limite) return { tipo: "sem_prazo" as const, limite, dias: null };
  const dias = diasEntre(hoje, limite);
  if (dias < 0) return { tipo: "atrasada" as const, limite, dias };
  if (dias <= 7) return { tipo: "proxima" as const, limite, dias };
  return { tipo: "no_prazo" as const, limite, dias };
}

export function textoDias(dias: number) {
  if (dias === 0) return "vence hoje";
  if (dias > 0) return `faltam ${dias} dia${dias === 1 ? "" : "s"}`;
  return `${-dias} dia${dias === -1 ? "" : "s"} de atraso`;
}

/** Quantas etapas da OS já estão marcadas como feitas (OK ou data passada). */
export function progresso(o: Record<string, unknown>, hoje: string) {
  let feitos = 0;
  for (const m of MARCOS) {
    const l = lerMarco(o[m.chave]);
    if (l.estado === "feito" || l.estado === "nao_se_aplica" || (l.estado === "data" && l.data && l.data <= hoje)) feitos++;
  }
  return { feitos, total: MARCOS.length };
}
