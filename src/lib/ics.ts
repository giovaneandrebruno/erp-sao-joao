/**
 * Leitor de agendas no formato iCal (.ics), como o "endereço secreto" do Google Agenda.
 * Feito à mão, sem bibliotecas: lê os eventos, repete os eventos recorrentes (RRULE)
 * e devolve tudo no horário de São Paulo, só dentro do período pedido.
 */

const FUSO = "America/Sao_Paulo";
const DIA_MS = 86_400_000;
const DIAS_SEMANA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export type EventoExterno = {
  data: string; // AAAA-MM-DD no fuso de São Paulo
  hora: string | null; // HH:MM, ou null quando é o dia todo
  titulo: string;
  local: string | null;
};

type Prop = { nome: string; params: Record<string, string>; valor: string };
type Momento = { naive: number; tz: string | null; diaTodo: boolean }; // naive = Date.UTC dos números do relógio local

/* ---------- leitura das linhas ---------- */

function linhas(texto: string) {
  return texto.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function lerProp(linha: string): Prop | null {
  let aspas = false;
  let i = 0;
  for (; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') aspas = !aspas;
    else if (c === ":" && !aspas) break;
  }
  if (i >= linha.length) return null;
  const [nome, ...ps] = linha.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of ps) {
    const k = p.indexOf("=");
    if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, "");
  }
  return { nome: nome.toUpperCase(), params, valor: linha.slice(i + 1) };
}

function desescapar(v: string) {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

/* ---------- fusos ---------- */

const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(tz: string) {
  let f = formatadores.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    formatadores.set(tz, f);
  }
  return f;
}

function fusoValido(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    formatador(tz);
    return tz;
  } catch {
    return FUSO; // nomes de fuso desconhecidos: considera o horário de Brasília
  }
}

/** Números do relógio de um fuso para um instante, como Date.UTC "ingênuo". */
function relogio(instante: number, tz: string) {
  const p = Object.fromEntries(formatador(tz).formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
}

/** Instante real (UTC) de um horário de relógio num fuso. */
function paraInstante(m: Momento) {
  if (!m.tz || m.tz === "UTC") return m.naive;
  let t = m.naive - (relogio(m.naive, m.tz) - m.naive);
  t = m.naive - (relogio(t, m.tz) - t);
  return t;
}

function lerMomento(p: Prop): Momento | null {
  const v = p.valor.trim();
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (d || p.params.VALUE === "DATE") {
    const x = d ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!x) return null;
    return { naive: Date.UTC(+x[1], +x[2] - 1, +x[3]), tz: null, diaTodo: true };
  }
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!t) return null;
  const naive = Date.UTC(+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +(t[6] ?? 0));
  return { naive, tz: t[7] ? "UTC" : fusoValido(p.params.TZID) ?? FUSO, diaTodo: false };
}

const iso = (naive: number) => new Date(naive).toISOString().slice(0, 10);

/* ---------- repetição (RRULE) ---------- */

type Regra = { freq: string; intervalo: number; count?: number; until?: string; byday: { n: number; dia: number }[]; bymonthday: number[]; bymonth: number[] };

function lerRegra(v: string): Regra | null {
  const r = Object.fromEntries(v.split(";").map((x) => x.split("=")).map(([k, val]) => [k?.toUpperCase(), val ?? ""]));
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(r.FREQ)) return null;
  return {
    freq: r.FREQ,
    intervalo: Math.max(1, Number(r.INTERVAL) || 1),
    count: r.COUNT ? Number(r.COUNT) : undefined,
    until: r.UNTIL,
    byday: (r.BYDAY ? r.BYDAY.split(",") : [])
      .map((x: string) => /^([+-]?\d+)?([A-Z]{2})$/.exec(x.trim()))
      .filter((x): x is RegExpExecArray => x !== null)
      .map((x) => ({ n: Number(x[1] ?? 0), dia: DIAS_SEMANA.indexOf(x[2]) }))
      .filter((x) => x.dia >= 0),
    bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(",").map(Number).filter(Boolean) : [],
    bymonth: r.BYMONTH ? r.BYMONTH.split(",").map(Number).filter(Boolean) : [],
  };
}

const diasNoMes = (a: number, m: number) => new Date(Date.UTC(a, m + 1, 0)).getUTCDate();

/** Dias (naive à meia-noite) de um mês que batem com a regra. */
function diasDoMes(a: number, m: number, regra: Regra, diaPadrao: number) {
  const total = diasNoMes(a, m);
  const dias = new Set<number>();
  if (regra.byday.length) {
    for (const { n, dia } of regra.byday) {
      const lista: number[] = [];
      for (let d = 1; d <= total; d++) if (new Date(Date.UTC(a, m, d)).getUTCDay() === dia) lista.push(d);
      if (n === 0) lista.forEach((d) => dias.add(d));
      else {
        const d = n > 0 ? lista[n - 1] : lista[lista.length + n];
        if (d) dias.add(d);
      }
    }
    if (regra.bymonthday.length) for (const d of [...dias]) if (!regra.bymonthday.some((x) => (x > 0 ? x : total + 1 + x) === d)) dias.delete(d);
  } else if (regra.bymonthday.length) {
    for (const x of regra.bymonthday) {
      const d = x > 0 ? x : total + 1 + x;
      if (d >= 1 && d <= total) dias.add(d);
    }
  } else if (diaPadrao <= total) dias.add(diaPadrao);
  return [...dias].sort((x, y) => x - y).map((d) => Date.UTC(a, m, d));
}

/** Gera os inícios (naive) de cada repetição, em ordem, até passar de `limite`. */
function* repeticoes(inicio: number, regra: Regra, limite: number) {
  const dia0 = Math.floor(inicio / DIA_MS) * DIA_MS;
  const hora = inicio - dia0;
  const d0 = new Date(dia0);
  const a0 = d0.getUTCFullYear(), m0 = d0.getUTCMonth(), dd0 = d0.getUTCDate(), ds0 = d0.getUTCDay();
  const diasSemana = regra.byday.map((b) => b.dia);

  for (let k = 0; k < 5000; k++) {
    let candidatos: number[] = [];
    if (regra.freq === "DAILY") {
      const d = dia0 + k * regra.intervalo * DIA_MS;
      if (!diasSemana.length || diasSemana.includes(new Date(d).getUTCDay())) candidatos = [d];
      if (regra.bymonth.length && !regra.bymonth.includes(new Date(d).getUTCMonth() + 1)) candidatos = [];
    } else if (regra.freq === "WEEKLY") {
      const segunda = dia0 - ((ds0 + 6) % 7) * DIA_MS + k * regra.intervalo * 7 * DIA_MS;
      const ds = diasSemana.length ? diasSemana : [ds0];
      candidatos = ds.map((x) => segunda + ((x + 6) % 7) * DIA_MS).sort((x, y) => x - y);
    } else if (regra.freq === "MONTHLY") {
      const t = m0 + k * regra.intervalo;
      const a = a0 + Math.floor(t / 12), m = t % 12;
      if (!regra.bymonth.length || regra.bymonth.includes(m + 1)) candidatos = diasDoMes(a, m, regra, dd0);
    } else {
      const a = a0 + k * regra.intervalo;
      const meses = regra.bymonth.length ? regra.bymonth.map((x) => x - 1) : [m0];
      for (const m of meses) {
        const r = regra.byday.length || regra.bymonthday.length ? regra : { ...regra, byday: [], bymonthday: [] };
        candidatos.push(...diasDoMes(a, m, r, dd0));
      }
    }
    for (const c of candidatos) {
      const t = c + hora;
      if (t < inicio) continue;
      if (t > limite) return;
      yield t;
    }
  }
}

/* ---------- leitura dos eventos ---------- */

type Bruto = { uid: string; props: Prop[] };

function eventosBrutos(texto: string): Bruto[] {
  const lista: Bruto[] = [];
  let atual: Prop[] | null = null;
  let profundidade = 0;
  for (const l of linhas(texto)) {
    if (/^BEGIN:VEVENT$/i.test(l)) { atual = []; profundidade = 0; continue; }
    if (!atual) continue;
    if (/^BEGIN:/i.test(l)) { profundidade++; continue; } // ex.: VALARM dentro do evento
    if (/^END:VEVENT$/i.test(l)) {
      lista.push({ uid: atual.find((p) => p.nome === "UID")?.valor ?? "", props: atual });
      atual = null;
      continue;
    }
    if (/^END:/i.test(l)) { profundidade--; continue; }
    if (profundidade > 0) continue;
    const p = lerProp(l);
    if (p) atual.push(p);
  }
  return lista;
}

/** Eventos de um arquivo .ics que caem entre `inicio` e `fim` (AAAA-MM-DD, inclusive). */
export function lerAgenda(texto: string, inicio: string, fim: string): EventoExterno[] {
  const brutos = eventosBrutos(texto);
  const iniMs = Date.parse(`${inicio}T00:00:00Z`);
  const fimMs = Date.parse(`${fim}T00:00:00Z`) + DIA_MS - 1;
  const limiteNaive = fimMs + 2 * DIA_MS; // folga para fusos

  // repetições trocadas ou canceladas uma a uma (RECURRENCE-ID)
  const trocadas = new Set<string>();
  for (const b of brutos) {
    const rid = b.props.find((p) => p.nome === "RECURRENCE-ID");
    const m = rid && lerMomento(rid);
    if (m) trocadas.add(`${b.uid}|${m.diaTodo ? iso(m.naive) : paraInstante(m)}`);
  }

  const saida: EventoExterno[] = [];
  const emitir = (ini: Momento, duracao: number, titulo: string, local: string | null) => {
    if (ini.diaTodo) {
      const dias = Math.min(62, Math.max(1, Math.round(duracao / DIA_MS)));
      for (let i = 0; i < dias; i++) {
        const d = ini.naive + i * DIA_MS;
        if (d >= iniMs && d <= fimMs) saida.push({ data: iso(d), hora: null, titulo, local });
      }
      return;
    }
    const sp = relogio(paraInstante(ini), FUSO);
    if (sp < iniMs || sp > fimMs) return;
    const x = new Date(sp);
    saida.push({ data: iso(sp), hora: `${String(x.getUTCHours()).padStart(2, "0")}:${String(x.getUTCMinutes()).padStart(2, "0")}`, titulo, local });
  };

  for (const b of brutos) {
    const prop = (n: string) => b.props.find((p) => p.nome === n);
    if (prop("STATUS")?.valor.toUpperCase() === "CANCELLED") continue;
    const dtstart = prop("DTSTART");
    const ini = dtstart && lerMomento(dtstart);
    if (!ini) continue;
    const titulo = desescapar(prop("SUMMARY")?.valor ?? "") || "(sem título)";
    const local = prop("LOCATION") ? desescapar(prop("LOCATION")!.valor) || null : null;

    const dtend = prop("DTEND");
    const fimEv = dtend && lerMomento(dtend);
    const durProp = prop("DURATION")?.valor;
    let duracao = fimEv ? fimEv.naive - ini.naive : ini.diaTodo ? DIA_MS : 0;
    if (!fimEv && durProp) {
      const d = /P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(durProp);
      if (d) duracao = ((+(d[1] ?? 0) * 7 + +(d[2] ?? 0)) * 24 + +(d[3] ?? 0)) * 3_600_000 + +(d[4] ?? 0) * 60_000;
    }

    const rrule = prop("RRULE");
    const regra = rrule && !prop("RECURRENCE-ID") ? lerRegra(rrule.valor) : null;
    if (!regra) {
      emitir(ini, duracao, titulo, local);
      continue;
    }

    const exdatas = new Set<string>();
    for (const p of b.props.filter((x) => x.nome === "EXDATE")) {
      for (const v of p.valor.split(",")) {
        const m = lerMomento({ ...p, valor: v });
        if (m) exdatas.add(String(m.diaTodo ? iso(m.naive) : paraInstante(m)));
      }
    }
    let ate: Momento | null = null;
    if (regra.until) ate = lerMomento({ nome: "UNTIL", params: {}, valor: regra.until });
    const ateMs = ate ? (ate.diaTodo ? ate.naive + DIA_MS - 1 : paraInstante(ate)) : Infinity;

    let contagem = 0;
    for (const t of repeticoes(ini.naive, regra, limiteNaive)) {
      const m: Momento = { ...ini, naive: t };
      const instante = ini.diaTodo ? t : paraInstante(m);
      if (instante > ateMs) break;
      contagem++;
      if (regra.count && contagem > regra.count) break;
      const chave = ini.diaTodo ? iso(t) : String(instante);
      if (exdatas.has(chave) || trocadas.has(`${b.uid}|${chave}`)) continue;
      if (t + duracao + 2 * DIA_MS < iniMs) continue;
      emitir(m, duracao, titulo, local);
    }
  }

  return saida.sort((a, b) => (a.data + (a.hora ?? "")).localeCompare(b.data + (b.hora ?? "")));
}

/** Só aceita o endereço secreto do Google Agenda (evita o servidor buscar endereços quaisquer). */
export function linkGoogleValido(url: string) {
  try {
    const u = new URL(url.trim().replace(/^webcal:\/\//i, "https://"));
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "calendar.google.com") return null;
    if (!u.pathname.startsWith("/calendar/ical/") || !u.pathname.endsWith(".ics")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Baixa o .ics. Devolve null se o Google não responder ou o link não for uma agenda. */
export async function baixarAgenda(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { accept: "text/calendar" } });
    if (!r.ok) return null;
    const t = await r.text();
    return t.includes("BEGIN:VCALENDAR") ? t : null;
  } catch {
    return null;
  }
}
