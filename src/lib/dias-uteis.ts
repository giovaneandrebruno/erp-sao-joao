/**
 * Dias úteis: segunda a sexta, sem os feriados nacionais (fixos, Carnaval, Sexta-feira Santa e Corpus Christi).
 * É a mesma conta das funções do banco public.eh_dia_util e public.somar_dias_uteis.
 * Datas sempre em texto AAAA-MM-DD.
 */
const DIA_MS = 864e5;
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Domingo de Páscoa (algoritmo de Meeus). */
export function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(Date.UTC(ano, mes - 1, dia));
}

const FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
const moveis = new Map<number, string[]>();
function feriadosMoveis(ano: number) {
  let l = moveis.get(ano);
  if (!l) {
    const p = utc(pascoa(ano));
    l = [-48, -47, -2, 60].map((n) => iso(p + n * DIA_MS));
    moveis.set(ano, l);
  }
  return l;
}

export function ehFeriado(dia: string) {
  return FIXOS.includes(dia.slice(5, 10)) || feriadosMoveis(Number(dia.slice(0, 4))).includes(dia);
}

export function ehDiaUtil(dia: string) {
  const s = new Date(utc(dia)).getUTCDay();
  return s !== 0 && s !== 6 && !ehFeriado(dia);
}

/** Soma N dias úteis (N = 0: a própria data, ou o próximo dia útil se cair em folga). */
export function somarDiasUteis(dia: string, n: number) {
  let t = utc(dia);
  let falta = Math.max(0, Math.round(n));
  if (falta === 0) {
    while (!ehDiaUtil(iso(t))) t += DIA_MS;
    return iso(t);
  }
  while (falta > 0) {
    t += DIA_MS;
    if (ehDiaUtil(iso(t))) falta--;
  }
  return iso(t);
}

/**
 * Quantos dias úteis de "de" até "ate" (sem contar o dia "de").
 * Negativo quando "ate" vem antes (ex.: -3 = três dias úteis de atraso).
 */
export function diasUteisEntre(de: string, ate: string) {
  if (de === ate) return 0;
  const sinal = ate > de ? 1 : -1;
  let t = utc(de);
  const fim = utc(ate);
  let n = 0;
  while (sinal > 0 ? t < fim : t > fim) {
    t += sinal * DIA_MS;
    // no atraso, conta os dias úteis que já passaram desde o prazo (o próprio prazo não conta)
    if (ehDiaUtil(iso(sinal > 0 ? t : t + DIA_MS))) n++;
  }
  return sinal * n;
}

/** Dias úteis de um período, inclusive as duas pontas. */
export function diasUteisDoPeriodo(inicio: string, fim: string) {
  const l: string[] = [];
  for (let t = utc(inicio); t <= utc(fim); t += DIA_MS) if (ehDiaUtil(iso(t))) l.push(iso(t));
  return l;
}
