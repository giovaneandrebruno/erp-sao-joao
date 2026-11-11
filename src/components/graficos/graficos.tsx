"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SERIE, TINTA } from "./cores";
import { curto, formatar, type Formato } from "./formato";

export type { Formato };

/** Marcas "redondas" do eixo (1, 2, 2,5, 5 × 10^n). */
function escala(min: number, max: number, alvo = 4) {
  if (max === min) max = min + 1;
  const bruto = (max - min) / alvo;
  const p = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= bruto) ?? 10 * p;
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) marcas.push(Math.round(v * 1e6) / 1e6);
  return { ini, fim, marcas };
}

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  const esquerda = x > largura * 0.6;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 min-w-36 rounded-xl bg-stone-900 px-3 py-2 text-xs text-white shadow-xl"
      style={{ top: Math.max(0, y), left: esquerda ? undefined : x + 14, right: esquerda ? largura - x + 14 : undefined }}
    >
      {children}
    </div>
  );
}

function LinhaDica({ cor, nome, valor, tracejado }: { cor: string; nome: string; valor: string; tracejado?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-white/75">
        <span className={`inline-block h-2 w-2 rounded-full ${tracejado ? "ring-1 ring-white/70" : ""}`} style={{ background: tracejado ? "transparent" : cor }} />
        {nome}
      </span>
      <span className="font-mono tabular-nums">{valor}</span>
    </div>
  );
}

export type Serie = { nome: string; valores: (number | null)[]; cor?: string };
export type PrevisaoGrafico = { rotulos: string[]; valores: number[]; baixo: number[]; alto: number[]; nome?: string };

const M = { topo: 12, dir: 8, base: 26, esq: 64 };

/**
 * Colunas por período (uma ou duas séries lado a lado), com linha de tendência
 * opcional e meses de previsão tracejados com faixa de incerteza.
 */
export function Colunas({
  rotulos,
  series,
  tendencia,
  previsao,
  formato = "brl",
  altura = 240,
  destaque,
  links,
  rotular = "ultimo",
  alvoUltimo,
}: {
  rotulos: string[];
  series: Serie[];
  tendencia?: Serie;
  previsao?: PrevisaoGrafico;
  formato?: Formato;
  altura?: number;
  destaque?: number;
  links?: string[];
  rotular?: "ultimo" | "maior" | "nenhum";
  /** Previsão do último período (mês em andamento): contorno tracejado atrás da coluna. */
  alvoUltimo?: { valor: number; baixo: number; alto: number };
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const router = useRouter();
  const n = rotulos.length + (previsao?.rotulos.length ?? 0);
  const todos = [...rotulos, ...(previsao?.rotulos ?? [])];
  const valores = [
    ...series.flatMap((s) => s.valores),
    ...(tendencia?.valores ?? []),
    ...(previsao ? [...previsao.alto, ...previsao.baixo] : []),
    ...(alvoUltimo ? [alvoUltimo.valor] : []),
  ].filter((v): v is number => v !== null && Number.isFinite(v));
  const { ini, fim, marcas } = escala(Math.min(0, ...valores), Math.max(0, ...valores));
  const W = Math.max(largura, 200);
  const H = altura;
  const iw = W - M.esq - M.dir;
  const ih = H - M.topo - M.base;
  const y = (v: number) => M.topo + ih - ((v - ini) / (fim - ini || 1)) * ih;
  const banda = iw / Math.max(n, 1);
  const grupo = Math.min(banda * 0.72, series.length * 24 + (series.length - 1) * 2);
  const barra = (grupo - (series.length - 1) * 2) / series.length;
  const xBanda = (i: number) => M.esq + i * banda;
  const cx = (i: number) => xBanda(i) + banda / 2;
  const zero = y(0);
  const passoRotulo = Math.ceil(n / Math.max(1, Math.floor(iw / 44)));

  const coluna = (x: number, v: number, w: number) => {
    const topo = y(Math.max(v, 0));
    const fundo = y(Math.min(v, 0));
    const h = Math.max(fundo - topo, v ? 1 : 0);
    const r = Math.min(4, w / 2, h);
    if (v >= 0)
      return `M${x},${fundo} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + w - r} Q${x + w},${topo} ${x + w},${topo + r} V${fundo} Z`;
    return `M${x},${topo} V${fundo - r} Q${x},${fundo} ${x + r},${fundo} H${x + w - r} Q${x + w},${fundo} ${x + w},${fundo - r} V${topo} Z`;
  };

  const idxRotulo = (() => {
    if (rotular === "nenhum" || !series[0]) return -1;
    const v = series[0].valores;
    if (rotular === "ultimo") return v.length - 1;
    let m = 0;
    v.forEach((x, i) => { if ((x ?? 0) > (v[m] ?? 0)) m = i; });
    return m;
  })();

  const linha = (vals: (number | null)[]) => {
    let d = "";
    vals.forEach((v, i) => {
      if (v === null) return;
      d += `${d && vals[i - 1] !== null ? "L" : "M"}${cx(i)},${y(v)} `;
    });
    return d;
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: H }} onMouseLeave={() => setFoco(null)}>
      {largura > 0 && (
        <svg width={W} height={H} className="overflow-visible" role="img" aria-label={`Gráfico de colunas: ${series.map((s) => s.nome).join(", ")}`}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={M.esq} x2={W - M.dir} y1={y(m)} y2={y(m)} stroke={m === 0 ? TINTA.base : TINTA.grade} strokeWidth={1} />
              <text x={M.esq - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill={TINTA.fraca} className="tabular-nums">{curto(m, formato)}</text>
            </g>
          ))}
          {foco !== null && <rect x={xBanda(foco)} y={M.topo} width={banda} height={ih} fill={TINTA.grade} opacity={0.7} rx={6} />}
          {previsao && (
            <path
              d={`M${cx(rotulos.length - 1)},${y(alvoUltimo?.valor ?? series[0]?.valores[rotulos.length - 1] ?? 0)} ${previsao.alto.map((v, i) => `L${cx(rotulos.length + i)},${y(v)}`).join(" ")} ${[...previsao.baixo].reverse().map((v, i) => `L${cx(rotulos.length + previsao.baixo.length - 1 - i)},${y(v)}`).join(" ")} Z`}
              fill={SERIE[0]}
              opacity={0.1}
            />
          )}
          {series.map((s, si) =>
            s.valores.map((v, i) =>
              v === null ? null : (
                <path
                  key={`${si}-${i}`}
                  d={coluna(cx(i) - grupo / 2 + si * (barra + 2), v, barra)}
                  fill={s.cor ?? SERIE[si]}
                  opacity={destaque === undefined || destaque === i || foco === i ? 1 : 0.55}
                />
              ),
            ),
          )}
          {alvoUltimo && (
            <rect
              x={cx(rotulos.length - 1) - grupo / 2 + 0.75}
              y={y(alvoUltimo.valor) + 0.75}
              width={barra - 1.5}
              height={Math.max(0, zero - y(alvoUltimo.valor) - 0.75)}
              rx={3}
              fill="none"
              stroke={SERIE[0]}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}
          {previsao?.valores.map((v, i) => {
            const x = cx(rotulos.length + i) - barra / 2;
            const topo = y(v);
            return (
              <rect key={`p${i}`} x={x + 0.75} y={topo + 0.75} width={barra - 1.5} height={Math.max(0, zero - topo - 0.75)} rx={3} fill="none" stroke={SERIE[0]} strokeWidth={1.5} strokeDasharray="4 3" />
            );
          })}
          {tendencia && <path d={linha(tendencia.valores)} fill="none" stroke={TINTA.forte} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />}
          {idxRotulo >= 0 && series[0].valores[idxRotulo] !== null && (
            <text x={cx(idxRotulo) - (series.length > 1 ? grupo / 2 - barra / 2 : 0)} y={y(Math.max(0, series[0].valores[idxRotulo] ?? 0)) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={TINTA.forte} stroke={TINTA.superficie} strokeWidth={3} paintOrder="stroke">
              {curto(series[0].valores[idxRotulo] ?? 0, formato)}
            </text>
          )}
          {todos.map((r, i) =>
            (n - 1 - i) % passoRotulo === 0 ? (
              <text key={r + i} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={i === destaque ? TINTA.forte : TINTA.fraca} fontWeight={i === destaque ? 600 : 400}>
                {r}
              </text>
            ) : null,
          )}
          {todos.map((r, i) => (
            <rect
              key={`h${i}`}
              x={xBanda(i)}
              y={0}
              width={banda}
              height={H}
              fill="transparent"
              style={{ cursor: links?.[i] ? "pointer" : "default" }}
              onMouseEnter={() => setFoco(i)}
              onTouchStart={() => setFoco(i)}
              onClick={() => links?.[i] && router.push(links[i])}
            />
          ))}
        </svg>
      )}
      {foco !== null && largura > 0 && (
        <Dica x={cx(foco)} y={M.topo} largura={W}>
          <div className="mb-1 font-semibold">{todos[foco]}{foco >= rotulos.length ? " · previsão" : ""}</div>
          {foco < rotulos.length ? (
            <>
              {series.map((s, si) => <LinhaDica key={s.nome} cor={s.cor ?? SERIE[si]} nome={s.nome} valor={formatar(s.valores[foco], formato)} />)}
              {tendencia && tendencia.valores[foco] !== null && <LinhaDica cor={TINTA.forte} nome={tendencia.nome} valor={formatar(tendencia.valores[foco], formato)} />}
              {alvoUltimo && foco === rotulos.length - 1 && (
                <>
                  <LinhaDica cor={SERIE[0]} tracejado nome="Previsão do mês" valor={formatar(alvoUltimo.valor, formato)} />
                  <div className="mt-1 text-white/60">faixa provável {formatar(alvoUltimo.baixo, formato)} a {formatar(alvoUltimo.alto, formato)}</div>
                </>
              )}
            </>
          ) : previsao ? (
            <>
              <LinhaDica cor={SERIE[0]} tracejado nome={previsao.nome ?? "Previsto"} valor={formatar(previsao.valores[foco - rotulos.length], formato)} />
              <div className="mt-1 text-white/60">faixa provável {formatar(previsao.baixo[foco - rotulos.length], formato)} a {formatar(previsao.alto[foco - rotulos.length], formato)}</div>
            </>
          ) : null}
        </Dica>
      )}
    </div>
  );
}

/**
 * Linha (uma ou mais séries) com área suave opcional, linha de referência e
 * projeção tracejada com faixa. Cruz de leitura ao passar o mouse.
 */
export function Linhas({
  rotulos,
  series,
  previsao,
  formato = "brl",
  altura = 220,
  area = false,
  referencia,
}: {
  rotulos: string[];
  series: Serie[];
  previsao?: PrevisaoGrafico;
  formato?: Formato;
  altura?: number;
  area?: boolean;
  referencia?: { valor: number; rotulo: string };
}) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const todos = [...rotulos, ...(previsao?.rotulos ?? [])];
  const n = todos.length;
  const valores = [
    ...series.flatMap((s) => s.valores),
    ...(previsao ? [...previsao.alto, ...previsao.baixo] : []),
    ...(referencia ? [referencia.valor] : []),
  ].filter((v): v is number => v !== null && Number.isFinite(v));
  const { ini, fim, marcas } = escala(Math.min(0, ...valores), Math.max(0, ...valores));
  const W = Math.max(largura, 200);
  const H = altura;
  const iw = W - M.esq - M.dir - 8;
  const ih = H - M.topo - M.base;
  const x = (i: number) => M.esq + 4 + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v: number) => M.topo + ih - ((v - ini) / (fim - ini || 1)) * ih;
  const passoRotulo = Math.ceil(n / Math.max(1, Math.floor(iw / 44)));

  const caminho = (vals: (number | null)[], desloc = 0) => {
    let d = "";
    vals.forEach((v, i) => {
      if (v === null) return;
      d += `${d && vals[i - 1] !== null ? "L" : "M"}${x(i + desloc)},${y(v)} `;
    });
    return d;
  };
  const ultimo = (vals: (number | null)[]) => {
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i] !== null) return i;
    return -1;
  };

  const mover = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left + M.esq;
    const i = Math.round(((px - M.esq - 4) / (iw || 1)) * (n - 1));
    setFoco(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: H }} onMouseLeave={() => setFoco(null)}>
      {largura > 0 && (
        <svg width={W} height={H} className="overflow-visible" role="img" aria-label={`Gráfico de linha: ${series.map((s) => s.nome).join(", ")}`}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={M.esq} x2={W - M.dir} y1={y(m)} y2={y(m)} stroke={m === 0 ? TINTA.base : TINTA.grade} strokeWidth={1} />
              <text x={M.esq - 8} y={y(m)} dy="0.32em" textAnchor="end" fontSize={11} fill={TINTA.fraca} className="tabular-nums">{curto(m, formato)}</text>
            </g>
          ))}
          {referencia && (
            <g>
              <line x1={M.esq} x2={W - M.dir} y1={y(referencia.valor)} y2={y(referencia.valor)} stroke={TINTA.media} strokeWidth={1} />
              <text x={M.esq + 6} y={y(referencia.valor) - 5} fontSize={11} fill={TINTA.media} stroke={TINTA.superficie} strokeWidth={3} paintOrder="stroke">{referencia.rotulo}</text>
            </g>
          )}
          {previsao && series[0] && (
            <>
              <path
                d={`M${x(rotulos.length - 1)},${y(series[0].valores[rotulos.length - 1] ?? 0)} ${previsao.alto.map((v, i) => `L${x(rotulos.length + i)},${y(v)}`).join(" ")} ${[...previsao.baixo].reverse().map((v, i) => `L${x(rotulos.length + previsao.baixo.length - 1 - i)},${y(v)}`).join(" ")} Z`}
                fill={series[0].cor ?? SERIE[0]}
                opacity={0.1}
              />
              <path
                d={caminho([series[0].valores[rotulos.length - 1], ...previsao.valores], rotulos.length - 1)}
                fill="none"
                stroke={series[0].cor ?? SERIE[0]}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            </>
          )}
          {series.map((s, si) => {
            const cor = s.cor ?? SERIE[si];
            const d = caminho(s.valores);
            const u = ultimo(s.valores);
            const p = s.valores.findIndex((v) => v !== null);
            return (
              <g key={s.nome}>
                {area && u >= 0 && <path d={`${d} L${x(u)},${y(Math.max(ini, 0))} L${x(p)},${y(Math.max(ini, 0))} Z`} fill={cor} opacity={0.1} />}
                <path d={d} fill="none" stroke={cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {u >= 0 && <circle cx={x(u)} cy={y(s.valores[u] ?? 0)} r={4} fill={cor} stroke={TINTA.superficie} strokeWidth={2} />}
              </g>
            );
          })}
          {todos.map((r, i) =>
            (n - 1 - i) % passoRotulo === 0 ? (
              <text key={r + i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill={TINTA.fraca}>{r}</text>
            ) : null,
          )}
          {foco !== null && (
            <g>
              <line x1={x(foco)} x2={x(foco)} y1={M.topo} y2={M.topo + ih} stroke={TINTA.base} strokeWidth={1} />
              {series.map((s, si) => {
                const v = foco < s.valores.length ? s.valores[foco] : null;
                return v === null ? null : <circle key={s.nome} cx={x(foco)} cy={y(v)} r={5} fill={s.cor ?? SERIE[si]} stroke={TINTA.superficie} strokeWidth={2} />;
              })}
              {previsao && foco >= rotulos.length && (
                <circle cx={x(foco)} cy={y(previsao.valores[foco - rotulos.length])} r={5} fill={TINTA.superficie} stroke={series[0]?.cor ?? SERIE[0]} strokeWidth={2} />
              )}
            </g>
          )}
          <rect x={M.esq} y={0} width={iw + 8} height={H} fill="transparent" onPointerMove={mover} onPointerDown={mover} />
        </svg>
      )}
      {foco !== null && largura > 0 && (
        <Dica x={x(foco)} y={M.topo} largura={W}>
          <div className="mb-1 font-semibold">{todos[foco]}{foco >= rotulos.length ? " · projeção" : ""}</div>
          {series.map((s, si) => (foco < s.valores.length ? <LinhaDica key={s.nome} cor={s.cor ?? SERIE[si]} nome={s.nome} valor={formatar(s.valores[foco], formato)} /> : null))}
          {previsao && foco >= rotulos.length && (
            <>
              <LinhaDica cor={SERIE[0]} tracejado nome={previsao.nome ?? "Projeção"} valor={formatar(previsao.valores[foco - rotulos.length], formato)} />
              <div className="mt-1 text-white/60">faixa provável {formatar(previsao.baixo[foco - rotulos.length], formato)} a {formatar(previsao.alto[foco - rotulos.length], formato)}</div>
            </>
          )}
        </Dica>
      )}
    </div>
  );
}

/** Minilinha dos últimos meses para os cartões de indicador. O último ponto fica em destaque. */
export function Minilinha({ valores, cor = SERIE[0], rotulos, formato = "brl" }: { valores: number[]; cor?: string; rotulos?: string[]; formato?: Formato }) {
  const [foco, setFoco] = useState<number | null>(null);
  if (valores.length < 2) return null;
  const W = 120;
  const H = 32;
  const min = Math.min(...valores, 0);
  const max = Math.max(...valores, 1);
  const x = (i: number) => 4 + (i / (valores.length - 1)) * (W - 8);
  const y = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
  const d = valores.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const u = valores.length - 1;
  return (
    <div className="relative" onMouseLeave={() => setFoco(null)}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução nos últimos meses">
        <path d={d} fill="none" stroke={TINTA.base} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(u)} cy={y(valores[u])} r={4} fill={cor} stroke={TINTA.superficie} strokeWidth={2} />
        {foco !== null && <circle cx={x(foco)} cy={y(valores[foco])} r={4} fill={TINTA.forte} stroke={TINTA.superficie} strokeWidth={2} />}
        {valores.map((_, i) => (
          <rect key={i} x={x(i) - W / valores.length / 2} y={0} width={W / valores.length} height={H} fill="transparent" onMouseEnter={() => setFoco(i)} />
        ))}
      </svg>
      {foco !== null && (
        <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 whitespace-nowrap rounded-lg bg-stone-900 px-2 py-1 text-[11px] text-white shadow-lg">
          {rotulos?.[foco] ? `${rotulos[foco]}: ` : ""}{formatar(valores[foco], formato)}
        </div>
      )}
    </div>
  );
}
