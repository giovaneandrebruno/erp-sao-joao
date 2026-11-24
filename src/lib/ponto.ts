/**
 * Relógio ponto: lê as marcações de uma planilha .xlsx exportada pelo relógio (ou pelo programa dele)
 * e faz as contas de horas. Tudo feito aqui no código, sem serviço de fora.
 *
 * Aceita os jeitos mais comuns de planilha:
 *  - uma linha por dia, com colunas de entrada/saída (Entrada 1, Saída 1, Entrada 2...);
 *  - uma linha por batida, com a data e a hora (juntas ou em colunas separadas);
 *  - relatório por pessoa, com "Funcionário: NOME" ou "Matrícula: 12" numa linha acima dos dias.
 */
import type { Aba } from "@/lib/planilha";

export type DiaLido = { pessoa: string | null; chave: string | null; dia: string; marcacoes: string[] };

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const RE_DATA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/;
const RE_HORA = /\b([01]?\d|2[0-3])[:hH]([0-5]\d)(?::[0-5]\d)?\b/g;

const CAB_DATA = /^(data|dia|date)\b/;
const CAB_PESSOA = /(nome|funcionario|colaborador|empregado|servidor)/;
const CAB_CHAVE = /(matricula|codigo|cod\b|cod\.|^id$|^n[ºo°]?$|pis|cpf|cracha|registro)/;
const CAB_HORA = /(entrada|saida|batida|marcac|hora|^e\s?\d|^s\s?\d|^ent|^sai|intervalo|almoco|retorno|registro de ponto|ponto)/;
const CAB_NAO_HORA = /(total|extra|falta|saldo|trabalhad|normais|atraso|banco|debito|credito|abono|noturn|previst|jornada|carga|horario|dsr|adicional)/;

/** Data em AAAA-MM-DD, ou null. */
export function lerData(v: string): string | null {
  const m = v.match(RE_DATA);
  if (!m) return null;
  let d: number, mes: number, a: number;
  if (m[4]) { a = Number(m[4]); mes = Number(m[5]); d = Number(m[6]); }
  else { d = Number(m[1]); mes = Number(m[2]); a = Number(m[3]); if (a < 100) a += 2000; }
  if (mes < 1 || mes > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Todas as horas (HH:MM) escritas na célula. Hora do Excel em número (0,3125 = 07:30) também vale. */
export function lerHoras(v: string, comoNumero = false): string[] {
  const t = v.trim();
  if (!t) return [];
  if (comoNumero && /^0?\.\d+$|^0$/.test(t)) {
    const min = Math.round(Number(t) * 1440);
    if (min > 0 && min < 1440) return [`${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`];
    return [];
  }
  const sóData = t.replace(RE_DATA, " ");
  return [...sóData.matchAll(RE_HORA)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
}

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Minutos trabalhados no dia: soma de cada par entrada → saída. Marcação sem par fica de fora. */
export function minutosDoDia(marcacoes: string[]) {
  const ord = [...marcacoes].sort();
  let total = 0;
  for (let i = 0; i + 1 < ord.length; i += 2) total += Math.max(0, minutos(ord[i + 1]) - minutos(ord[i]));
  return total;
}

/** 525 → "8h45". */
export function horasLegiveis(min: number | null | undefined) {
  if (min == null) return "—";
  const sinal = min < 0 ? "−" : "";
  const m = Math.abs(Math.round(min));
  return `${sinal}${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}

/** Marcações digitadas à mão: "07:30 11:30 13:00 17:18" ou "7h30, 11h30…". */
export function marcacoesDoTexto(t: string) {
  return [...new Set(lerHoras(t))].sort();
}

const pareceCabecalho = (linha: string[]) => {
  // "Data de emissão: 01/12" é título do relatório, não cabeçalho
  const cels = linha.map(sem).filter((c) => c && !/:\s*\S/.test(c) && !RE_DATA.test(c));
  return cels.some((c) => CAB_DATA.test(c)) && cels.some((c) => CAB_HORA.test(c) || CAB_PESSOA.test(c));
};

/** Lê "Funcionário: JOÃO DA SILVA" ou "Matrícula: 12" de uma linha de título do relatório (o rótulo precisa ter dois-pontos). */
function lerTituloDePessoa(linha: string[]) {
  let pessoa: string | null = null;
  let chave: string | null = null;
  for (let i = 0; i < linha.length; i++) {
    const m = (linha[i] ?? "").match(/^\s*([^:]{2,30}):\s*(.*)$/);
    if (!m) continue;
    const rotulo = sem(m[1]);
    const valor = m[2].trim() || (linha.slice(i + 1).find((x) => x?.trim()) ?? "").trim();
    if (!valor) continue;
    if (CAB_CHAVE.test(rotulo)) chave = valor;
    else if (CAB_PESSOA.test(rotulo)) pessoa = valor.replace(/^\d+\s*[-–]\s*/, "").trim() || null;
  }
  return { pessoa, chave };
}

/** Lê todas as abas da planilha e junta as marcações por pessoa e dia. */
export function lerPonto(abas: Aba[]): DiaLido[] {
  const mapa = new Map<string, DiaLido>();
  const juntar = (pessoa: string | null, chave: string | null, dia: string, horas: string[]) => {
    if (!horas.length) return;
    const k = `${sem(pessoa ?? "")}|${chave ?? ""}|${dia}`;
    const atual = mapa.get(k) ?? { pessoa, chave, dia, marcacoes: [] };
    atual.marcacoes = [...new Set([...atual.marcacoes, ...horas])].sort();
    mapa.set(k, atual);
  };

  for (const aba of abas) {
    let colData = -1;
    let colPessoa = -1;
    let colChave = -1;
    let colsHora: number[] = [];
    let pessoaTitulo: string | null = null;
    let chaveTitulo: string | null = null;

    for (const linha of aba.linhas) {
      if (!linha.some((c) => c)) continue;
      if (pareceCabecalho(linha)) {
        const cels = linha.map(sem);
        const comData = cels.findIndex((c) => /^(data|date)\b/.test(c));
        colData = comData >= 0 ? comData : cels.findIndex((c) => CAB_DATA.test(c));
        colPessoa = cels.findIndex((c) => CAB_PESSOA.test(c) && !CAB_CHAVE.test(c));
        colChave = cels.findIndex((c) => CAB_CHAVE.test(c) && !CAB_HORA.test(c));
        colsHora = cels.map((c, i) => (i !== colData && CAB_HORA.test(c) && !CAB_NAO_HORA.test(c) ? i : -1)).filter((i) => i >= 0);
        continue;
      }
      const dataNaLinha = colData >= 0 ? lerData(linha[colData] ?? "") : null;
      if (!dataNaLinha) {
        // linha de título do relatório ("Funcionário: ...")
        const t = lerTituloDePessoa(linha);
        if (t.pessoa || t.chave) { pessoaTitulo = t.pessoa; chaveTitulo = t.chave; }
        continue;
      }
      const pessoa = (colPessoa >= 0 ? linha[colPessoa]?.trim() : "") || pessoaTitulo;
      const chave = (colChave >= 0 ? linha[colChave]?.trim() : "") || chaveTitulo;
      const horas: string[] = lerHoras(linha[colData] ?? "");
      const colunas = colsHora.length ? colsHora : linha.map((_, i) => i).filter((i) => i !== colData && i !== colPessoa && i !== colChave);
      for (const i of colunas) horas.push(...lerHoras(linha[i] ?? "", colsHora.length > 0));
      juntar(pessoa || null, chave || null, dataNaLinha, horas);
    }
  }
  return [...mapa.values()].sort((a, b) => (a.pessoa ?? "").localeCompare(b.pessoa ?? "") || a.dia.localeCompare(b.dia));
}

/* ─────────────────────────────── quem é quem ─────────────────────────────── */

export type FuncionarioParaPonto = { id: string; nome: string; apelido: string | null; matricula: string | null; cpf: string | null; pis: string | null };

const digitos = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");
const semZeros = (v: string) => v.replace(/^0+/, "");

/** Acha o funcionário pela matrícula, CPF ou PIS da planilha; se não tiver, pelo nome. */
export function acharFuncionario(lido: { pessoa: string | null; chave: string | null }, lista: FuncionarioParaPonto[]): string | null {
  if (lido.chave) {
    const ch = semZeros(digitos(lido.chave)) || sem(lido.chave);
    const f = lista.find((x) =>
      (x.matricula && (semZeros(digitos(x.matricula)) || sem(x.matricula)) === ch) ||
      (x.cpf && semZeros(digitos(x.cpf)) === ch) ||
      (x.pis && semZeros(digitos(x.pis)) === ch));
    if (f) return f.id;
  }
  if (lido.pessoa) {
    const p = sem(lido.pessoa).replace(/\s+/g, " ");
    const exato = lista.find((x) => sem(x.nome).replace(/\s+/g, " ") === p || (x.apelido && sem(x.apelido) === p));
    if (exato) return exato.id;
    // nome cortado pelo relógio ("JOAO DA SILVA SA") ou só nome e sobrenome
    const partes = p.split(" ");
    const candidatos = lista.filter((x) => {
      const n = sem(x.nome).replace(/\s+/g, " ");
      if (n.startsWith(p) || p.startsWith(n)) return true;
      const np = n.split(" ");
      return partes.length >= 2 && np[0] === partes[0] && np[np.length - 1] === partes[partes.length - 1];
    });
    if (candidatos.length === 1) return candidatos[0].id;
  }
  return null;
}
