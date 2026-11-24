/**
 * Cadastro de funcionários: situações, tipos de arquivo e de atestado, pasta no Storage e contas de datas e horas.
 * Os arquivos ficam na pasta privada "funcionarios" do Storage (só o administrador abre), em <id>/.
 */
export { LIMITE_DOCUMENTO as LIMITE_ARQUIVO, tamanhoLegivel } from "@/lib/documentos";

export const BUCKET_FUNCIONARIOS = "funcionarios";

export const SITUACOES_FUNCIONARIO = {
  ativo: "Trabalhando",
  ferias: "De férias",
  afastado: "Afastado",
  desligado: "Desligado (saiu da empresa)",
} as const;
export type SituacaoFuncionario = keyof typeof SITUACOES_FUNCIONARIO;
export const COR_SITUACAO_FUNCIONARIO = { ativo: "green", ferias: "blue", afastado: "amber", desligado: "stone" } as const;
export const ROTULO_CURTO_FUNCIONARIO: Record<SituacaoFuncionario, string> = { ativo: "Trabalhando", ferias: "Férias", afastado: "Afastado", desligado: "Desligado" };

export const TIPOS_CONTRATO = ["CLT", "Experiência (CLT)", "Temporário", "Aprendiz", "Estágio", "PJ / MEI", "Autônomo / diarista", "Sócio"];
export const ESCOLARIDADES = ["Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo", "Pós-graduação"];
export const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const PARENTESCOS = ["Cônjuge", "Mãe", "Pai", "Filho(a)", "Irmão(ã)", "Outro parente", "Amigo(a)"];

/** Tipos de arquivo da pasta do funcionário. A ordem é a que aparece na lista de escolha. */
export const TIPOS_ARQUIVO_FUNCIONARIO = {
  documento_pessoal: "Documento pessoal (RG, CPF, CNH)",
  ctps: "Carteira de trabalho",
  contrato: "Contrato de trabalho",
  comprovante_residencia: "Comprovante de residência",
  exame: "Exame médico (admissional, periódico, demissional)",
  certificado: "Certificado / curso / NR",
  holerite: "Holerite / recibo de pagamento",
  ferias: "Férias",
  ponto: "Relatório do relógio ponto",
  epi: "Entrega de EPI / uniforme",
  advertencia: "Advertência / suspensão",
  rescisao: "Rescisão",
  foto: "Foto",
  outro: "Outro",
} as const;
export type TipoArquivoFuncionario = keyof typeof TIPOS_ARQUIVO_FUNCIONARIO;
export const ehTipoArquivoFuncionario = (v: unknown): v is TipoArquivoFuncionario => typeof v === "string" && Object.hasOwn(TIPOS_ARQUIVO_FUNCIONARIO, v);

/** Arquivos que todo funcionário deveria ter na pasta. */
export const ARQUIVOS_ESSENCIAIS: TipoArquivoFuncionario[] = ["documento_pessoal", "ctps", "contrato", "exame"];

export const TIPOS_ATESTADO = {
  atestado_medico: "Atestado médico",
  odontologico: "Atestado odontológico",
  acompanhante: "Acompanhamento de familiar",
  comparecimento: "Declaração de comparecimento (horas)",
  afastamento_inss: "Afastamento pelo INSS",
  licenca: "Licença (maternidade, paternidade, casamento, luto)",
  outro: "Outro",
} as const;
export type TipoAtestado = keyof typeof TIPOS_ATESTADO;
export const ehTipoAtestado = (v: unknown): v is TipoAtestado => typeof v === "string" && Object.hasOwn(TIPOS_ATESTADO, v);

export const pastaDoFuncionario = (id: string) => `${id}/`;

/** Nome seguro para o caminho no Storage (sem acentos, espaços ou símbolos). */
export function caminhoDoArquivo(funcionarioId: string, nomeArquivo: string, subpasta = "arquivos") {
  const limpo = nomeArquivo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "arquivo";
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${pastaDoFuncionario(funcionarioId)}${subpasta}/${Date.now()}-${aleatorio}-${limpo}`;
}

/* ─────────────────────────────── datas ─────────────────────────────── */

const DIA_MS = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

/** Hoje no horário de Brasília, em AAAA-MM-DD. */
export const hojeSP = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Dias corridos do atestado, contando o primeiro e o último. */
export const diasDoAtestado = (inicio: string, fim: string) => Math.max(1, Math.round((utc(fim) - utc(inicio)) / DIA_MS) + 1);

/** "3 anos e 2 meses", "8 meses", "15 dias": tempo de casa entre a admissão e hoje (ou a saída). */
export function tempoDeCasa(admissao: string | null | undefined, ate?: string | null) {
  if (!admissao) return null;
  const [a1, m1, d1] = admissao.slice(0, 10).split("-").map(Number);
  const [a2, m2, d2] = (ate ?? hojeSP()).slice(0, 10).split("-").map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (meses < 0) return null;
  if (meses === 0) {
    const dias = Math.round((utc(ate ?? hojeSP()) - utc(admissao)) / DIA_MS);
    return dias <= 1 ? "começou agora" : `${dias} dias`;
  }
  const anos = Math.floor(meses / 12);
  meses %= 12;
  const pa = anos ? `${anos} ${anos === 1 ? "ano" : "anos"}` : "";
  const pm = meses ? `${meses} ${meses === 1 ? "mês" : "meses"}` : "";
  return [pa, pm].filter(Boolean).join(" e ");
}

/** Dias até o próximo aniversário (0 = hoje). */
export function diasAteAniversario(nascimento: string | null | undefined, hoje = hojeSP()) {
  if (!nascimento) return null;
  const [ano] = hoje.split("-").map(Number);
  const mmdd = nascimento.slice(5, 10);
  let alvo = utc(`${ano}-${mmdd}`);
  if (alvo < utc(hoje)) alvo = utc(`${ano + 1}-${mmdd}`);
  return Math.round((alvo - utc(hoje)) / DIA_MS);
}

/** Primeiro e último dia do mês "AAAA-MM". */
export function limitesDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const fim = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(fim).padStart(2, "0")}`, dias: fim };
}

export const mesValido = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

export function somarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function nomeDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const nome = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${a}`;
}

export const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const diaDaSemana = (iso: string) => new Date(utc(iso)).getUTCDay();

/** Quantos dias do atestado caem dentro do período. */
export function diasNoPeriodo(inicio: string, fim: string, de: string, ate: string) {
  const i = Math.max(utc(inicio), utc(de));
  const f = Math.min(utc(fim), utc(ate));
  return f < i ? 0 : Math.round((f - i) / DIA_MS) + 1;
}

export function somarDias(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
