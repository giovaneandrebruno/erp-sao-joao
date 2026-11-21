"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Icone } from "@/components/icones";
import { BotaoExcluir, avisar } from "@/components/acoes";
import { estiloBotao, inputCls } from "@/components/ui";
import {
  CORES_QUADRO, NIVEL, abaixoDe, calcularOrganograma, corDoQuadro, ehVaga, horas, montarArvore, nomeDaPessoa,
  type AtribuicaoOrg, type FuncaoOrg, type No, type PessoaOrg,
} from "@/lib/organograma";
import { alterarQuadro, criarFuncoesRapido, criarQuadro, excluirQuadro, marcarFuncao, posicionarQuadros, type MudancaQuadro } from "./actions";

const GRADE = 24; // tamanho do quadradinho da grade (os quadros "encaixam" nela)
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const encaixar = (v: number) => Math.round(v / GRADE) * GRADE;

type Vista = { x: number; y: number; zoom: number };
type Gesto =
  | { tipo: "fundo"; x: number; y: number; vista: Vista; mexeu: boolean }
  | { tipo: "mover"; id: string; x: number; y: number; px: number; py: number; mexeu: boolean }
  | { tipo: "tamanho"; id: string; x: number; y: number; w: number; h: number }
  | { tipo: "ligar"; id: string };

/**
 * Organograma numa tela quadriculada: cada cargo é um quadro com bordas arredondadas.
 * Arraste o quadro para mudar de lugar, puxe o cantinho para mudar o tamanho,
 * puxe a bolinha de baixo até outro quadro para dizer quem responde a quem.
 * Roda do mouse (ou os botões) aumenta e diminui o zoom; arrastar o fundo anda pela tela.
 */
export function QuadroOrganograma({ pessoas, funcoes, atribuicoes }: { pessoas: PessoaOrg[]; funcoes: FuncaoOrg[]; atribuicoes: AtribuicaoOrg[] }) {
  const [lista, setLista] = useState(pessoas);
  const [funcs, setFuncs] = useState(funcoes);
  const [atribs, setAtribs] = useState(atribuicoes);
  const [vista, setVista] = useState<Vista>({ x: 40, y: 40, zoom: 1 });
  const [sel, setSel] = useState<string | null>(useSearchParams().get("quadro"));
  const [editando, setEditando] = useState<string | null>(null);
  const [ligando, setLigando] = useState<{ de: string; x: number; y: number; alvo: string | null } | null>(null);
  const [andando, setAndando] = useState(false);
  const [, iniciar] = useTransition();
  const tela = useRef<HTMLDivElement>(null);
  const gesto = useRef<Gesto | null>(null);

  // dados novos do servidor (ex.: outra aba alterou) substituem os da tela
  const [anteriores, setAnteriores] = useState({ pessoas, funcoes, atribuicoes });
  if (anteriores.pessoas !== pessoas || anteriores.funcoes !== funcoes || anteriores.atribuicoes !== atribuicoes) {
    setAnteriores({ pessoas, funcoes, atribuicoes });
    setLista(pessoas);
    setFuncs(funcoes);
    setAtribs(atribuicoes);
  }

  const calc = useMemo(() => calcularOrganograma(lista, funcs, atribs), [lista, funcs, atribs]);
  const porId = useMemo(() => new Map(lista.map((p) => [p.id, p])), [lista]);
  const selecionado = sel ? porId.get(sel) ?? null : null;

  /* ─────────── zoom e posição da tela ─────────── */

  const paraMundo = useCallback((cx: number, cy: number, v = vista) => {
    const r = tela.current!.getBoundingClientRect();
    return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom };
  }, [vista]);

  const zoomEm = useCallback((fator: number, cx?: number, cy?: number) => {
    setVista((v) => {
      const r = tela.current?.getBoundingClientRect();
      if (!r) return v;
      const px = cx ?? r.left + r.width / 2;
      const py = cy ?? r.top + r.height / 2;
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * fator));
      const mx = (px - r.left - v.x) / v.zoom;
      const my = (py - r.top - v.y) / v.zoom;
      return { zoom, x: px - r.left - mx * zoom, y: py - r.top - my * zoom };
    });
  }, []);

  const verTudo = useCallback((quais = lista) => {
    const r = tela.current?.getBoundingClientRect();
    if (!r) return;
    if (!quais.length) { setVista({ x: 40, y: 40, zoom: 1 }); return; }
    const x0 = Math.min(...quais.map((p) => p.pos_x)), y0 = Math.min(...quais.map((p) => p.pos_y));
    const x1 = Math.max(...quais.map((p) => p.pos_x + p.largura)), y1 = Math.max(...quais.map((p) => p.pos_y + p.altura));
    const zoom = Math.min(1.2, Math.max(ZOOM_MIN, Math.min((r.width - 80) / (x1 - x0), (r.height - 80) / (y1 - y0))));
    setVista({ zoom, x: (r.width - (x1 - x0) * zoom) / 2 - x0 * zoom, y: (r.height - (y1 - y0) * zoom) / 2 - y0 * zoom });
  }, [lista]);

  // começa mostrando tudo (ou o jeito que a pessoa deixou da última vez)
  useEffect(() => {
    const quadro = requestAnimationFrame(() => {
      pronto.current = true;
      const salvo = localStorage.getItem("organograma-vista");
      if (salvo) { try { setVista(JSON.parse(salvo)); return; } catch { /* ignora */ } }
      verTudo(pessoas);
    });
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pronto = useRef(false);
  useEffect(() => {
    if (pronto.current) localStorage.setItem("organograma-vista", JSON.stringify(vista));
  }, [vista]);

  // roda do mouse = zoom (precisa ser "não passivo" para a página não rolar junto)
  useEffect(() => {
    const el = tela.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      zoomEm(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [zoomEm]);

  /* ─────────── salvar ─────────── */

  const salvar = useCallback((id: string, m: MudancaQuadro, desfazer?: PessoaOrg) => {
    iniciar(async () => {
      const r = await alterarQuadro(id, m);
      if (!r.ok) {
        avisar(r.erro, true);
        if (desfazer) setLista((l) => l.map((p) => (p.id === id ? desfazer : p)));
      }
    });
  }, []);

  const mudarLocal = (id: string, m: Partial<PessoaOrg>) => setLista((l) => l.map((p) => (p.id === id ? { ...p, ...m } : p)));

  const mudar = (id: string, m: MudancaQuadro) => {
    const antes = porId.get(id);
    mudarLocal(id, m as Partial<PessoaOrg>);
    salvar(id, m, antes);
  };

  function definirChefe(id: string, chefe: string | null) {
    if (chefe && (chefe === id || abaixoDe(id, lista).has(chefe))) {
      avisar("Não dá: esse quadro está abaixo dele no organograma.", true);
      return;
    }
    mudar(id, { chefe_id: chefe });
    avisar(chefe ? `${rotuloCurto(porId.get(id)!)} agora responde a ${rotuloCurto(porId.get(chefe)!)}` : "Ligação removida");
  }

  function novoQuadro(abaixo?: PessoaOrg) {
    let pos: { x: number; y: number };
    if (abaixo) {
      const irmaos = lista.filter((p) => p.chefe_id === abaixo.id);
      pos = { x: encaixar(abaixo.pos_x + irmaos.length * (abaixo.largura + GRADE * 2)), y: encaixar(abaixo.pos_y + abaixo.altura + GRADE * 4) };
    } else {
      const r = tela.current!.getBoundingClientRect();
      const c = paraMundo(r.left + r.width / 2, r.top + r.height / 2);
      pos = { x: encaixar(c.x - 120), y: encaixar(c.y - 75) };
    }
    iniciar(async () => {
      const r = await criarQuadro(pos, abaixo?.id ?? null, abaixo?.cor ?? "branco");
      if (!r.ok) { avisar(r.erro, true); return; }
      setLista((l) => [...l, { ...r.dado, horas_semana: Number(r.dado.horas_semana) }]);
      setSel(r.dado.id);
      setEditando(r.dado.id);
    });
  }

  /** Exclui (a confirmação aparece antes, no botão do painel). */
  async function remover(id: string) {
    const p = porId.get(id);
    const erro = await excluirQuadro(id);
    if (erro) return erro;
    setLista((l) => l.filter((x) => x.id !== id).map((x) => (x.chefe_id === id ? { ...x, chefe_id: p?.chefe_id ?? null } : x)));
    setAtribs((a) => a.filter((x) => x.pessoa_id !== id));
    setSel(null);
    setEditando(null);
    return null;
  }

  /** Arruma os quadros em árvore: chefe em cima, quem responde a ele embaixo. */
  function organizar() {
    if (!lista.length) return;
    const largura = (n: No): number => Math.max(n.pessoa.largura, n.filhos.reduce((s, f) => s + largura(f) + GRADE * 2, -GRADE * 2));
    const altura = Math.max(...lista.map((p) => p.altura)) + GRADE * 4;
    const novas = new Map<string, { pos_x: number; pos_y: number }>();
    const por = (n: No, x: number, nivel: number) => {
      const w = largura(n);
      novas.set(n.pessoa.id, { pos_x: encaixar(x + (w - n.pessoa.largura) / 2), pos_y: nivel * altura });
      let cx = x;
      for (const f of n.filhos) { por(f, cx, nivel + 1); cx += largura(f) + GRADE * 2; }
    };
    let x = 0;
    for (const raiz of montarArvore(lista)) { por(raiz, x, 0); x += largura(raiz) + GRADE * 4; }
    const atualizada = lista.map((p) => ({ ...p, ...novas.get(p.id) }));
    setLista(atualizada);
    verTudo(atualizada);
    iniciar(async () => {
      const r = await posicionarQuadros(atualizada.map((p) => ({ id: p.id, pos_x: p.pos_x, pos_y: p.pos_y })));
      if (!r.ok) avisar(r.erro, true);
      else avisar("Organograma organizado");
    });
  }

  /* ─────────── arrastar (fundo, quadro, tamanho, ligação) ─────────── */

  function apertarFundo(e: React.PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    gesto.current = { tipo: "fundo", x: e.clientX, y: e.clientY, vista, mexeu: false };
    setAndando(true);
  }

  function apertarQuadro(e: React.PointerEvent, p: PessoaOrg) {
    if (e.button !== 0) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest("[data-alca]") || (editando === p.id && alvo.closest("input, textarea"))) return;
    e.stopPropagation();
    gesto.current = { tipo: "mover", id: p.id, x: e.clientX, y: e.clientY, px: p.pos_x, py: p.pos_y, mexeu: false };
  }

  function apertarTamanho(e: React.PointerEvent, p: PessoaOrg) {
    e.stopPropagation();
    setSel(p.id);
    gesto.current = { tipo: "tamanho", id: p.id, x: e.clientX, y: e.clientY, w: p.largura, h: p.altura };
  }

  function apertarLigacao(e: React.PointerEvent, p: PessoaOrg) {
    e.stopPropagation();
    setSel(p.id);
    const m = paraMundo(e.clientX, e.clientY);
    gesto.current = { tipo: "ligar", id: p.id };
    setLigando({ de: p.id, x: m.x, y: m.y, alvo: null });
  }

  useEffect(() => {
    const quadroEm = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-quadro]")?.dataset.quadro ?? null;
    const mexer = (e: PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      if (g.tipo === "fundo") {
        if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 3) g.mexeu = true;
        setVista({ ...g.vista, x: g.vista.x + e.clientX - g.x, y: g.vista.y + e.clientY - g.y });
      } else if (g.tipo === "mover") {
        if (!g.mexeu && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 4) return;
        g.mexeu = true;
        const dx = (e.clientX - g.x) / vista.zoom, dy = (e.clientY - g.y) / vista.zoom;
        mudarLocal(g.id, { pos_x: encaixar(g.px + dx), pos_y: encaixar(g.py + dy) });
      } else if (g.tipo === "tamanho") {
        const dx = (e.clientX - g.x) / vista.zoom, dy = (e.clientY - g.y) / vista.zoom;
        mudarLocal(g.id, { largura: Math.max(144, encaixar(g.w + dx)), altura: Math.max(96, encaixar(g.h + dy)) });
      } else if (g.tipo === "ligar") {
        const m = paraMundo(e.clientX, e.clientY);
        const alvo = quadroEm(e.clientX, e.clientY);
        setLigando((l) => (l ? { ...l, x: m.x, y: m.y, alvo: alvo !== g.id ? alvo : null } : l));
      }
    };
    const soltar = (e: PointerEvent) => {
      const g = gesto.current;
      gesto.current = null;
      setAndando(false);
      if (!g) return;
      if (g.tipo === "fundo") {
        if (!g.mexeu) { setSel(null); setEditando(null); }
      } else if (g.tipo === "mover") {
        const p = lista.find((x) => x.id === g.id);
        if (!p) return;
        if (g.mexeu) {
          if (p.pos_x !== g.px || p.pos_y !== g.py) salvar(p.id, { pos_x: p.pos_x, pos_y: p.pos_y });
        } else if (sel === p.id) {
          // segundo clique no quadro já selecionado: escrever
          setEditando(p.id);
          // escreve no campo onde clicou (o cursor vai para o fim do texto)
          const campos = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`[data-quadro="${p.id}"] input, [data-quadro="${p.id}"] textarea`)];
          const campo = campos.find((c) => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; }) ?? campos[0];
          setTimeout(() => { campo?.focus(); const fim = campo?.value.length ?? 0; campo?.setSelectionRange(fim, fim); }, 0);
        } else {
          setSel(p.id);
          if (editando !== p.id) setEditando(null);
        }
      } else if (g.tipo === "tamanho") {
        const p = lista.find((x) => x.id === g.id);
        if (p && (p.largura !== g.w || p.altura !== g.h)) salvar(p.id, { largura: p.largura, altura: p.altura });
      } else if (g.tipo === "ligar") {
        const alvo = quadroEm(e.clientX, e.clientY);
        setLigando(null);
        // puxou do chefe até quem responde a ele
        if (alvo && alvo !== g.id) definirChefe(alvo, g.id);
      }
    };
    window.addEventListener("pointermove", mexer);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    return () => {
      window.removeEventListener("pointermove", mexer);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
    };
  });

  // teclado: Esc sai da edição, + e − mudam o zoom
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const digitando = (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") { setEditando(null); (document.activeElement as HTMLElement | null)?.blur(); return; }
      if (digitando) return;
      if (e.key === "+" || e.key === "=") zoomEm(1.2);
      if (e.key === "-") zoomEm(1 / 1.2);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  /* ─────────── desenho ─────────── */

  const linhas = lista
    .filter((p) => p.chefe_id && porId.has(p.chefe_id))
    .map((p) => {
      const c = porId.get(p.chefe_id!)!;
      const x1 = c.pos_x + c.largura / 2, y1 = c.pos_y + c.altura;
      const x2 = p.pos_x + p.largura / 2, y2 = p.pos_y;
      const meio = y2 > y1 + 24 ? y1 + (y2 - y1) / 2 : y1 + 24;
      return { id: p.id, d: y2 > y1 + 24 ? `M${x1} ${y1} V${meio} H${x2} V${y2}` : `M${x1} ${y1} C${x1} ${y1 + 80} ${x2} ${y2 - 80} ${x2} ${y2}` };
    });
  const deLigacao = ligando ? porId.get(ligando.de) : null;
  const passo = GRADE * vista.zoom;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => novoQuadro()} className={estiloBotao.primario}>
            <Icone nome="mais" className="h-4 w-4" /> Novo quadro
          </button>
          {selecionado && (
            <button type="button" onClick={() => novoQuadro(selecionado)} className={estiloBotao.secundario}>
              <Icone nome="mais" className="h-4 w-4" /> Quadro abaixo deste
            </button>
          )}
          <button type="button" onClick={organizar} className={estiloBotao.secundario} title="Arruma os quadros em árvore: chefe em cima, equipe embaixo">Organizar</button>
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-stone-200 bg-white p-1 shadow-[0_1px_2px_rgb(26_26_26/0.04)]">
            <BotaoZoom rotulo="Diminuir" onClick={() => zoomEm(1 / 1.2)}>−</BotaoZoom>
            <button type="button" onClick={() => setVista((v) => ({ ...v, zoom: 1 }))} className="w-14 rounded-md py-1 text-center font-mono text-xs text-stone-600 hover:bg-stone-100" title="Voltar para 100%">
              {Math.round(vista.zoom * 100)}%
            </button>
            <BotaoZoom rotulo="Aumentar" onClick={() => zoomEm(1.2)}>+</BotaoZoom>
            <button type="button" onClick={() => verTudo()} className="rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100">Ver tudo</button>
          </div>
        </div>

        <div
          ref={tela}
          onPointerDown={apertarFundo}
          className={`relative h-[calc(100vh-300px)] min-h-[480px] touch-none select-none overflow-hidden rounded-2xl border border-stone-200 bg-white ${andando ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            backgroundImage: `linear-gradient(to right, #ececec 1px, transparent 1px), linear-gradient(to bottom, #ececec 1px, transparent 1px), linear-gradient(to right, #dcdcdc 1px, transparent 1px), linear-gradient(to bottom, #dcdcdc 1px, transparent 1px)`,
            backgroundSize: `${passo}px ${passo}px, ${passo}px ${passo}px, ${passo * 5}px ${passo * 5}px, ${passo * 5}px ${passo * 5}px`,
            backgroundPosition: `${vista.x}px ${vista.y}px`,
          }}
        >
          <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.zoom})` }}>
            <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1">
              {linhas.map((l) => (
                <path key={l.id} d={l.d} fill="none" stroke={sel === l.id ? "#e37f33" : "#a3a3a3"} strokeWidth={2} strokeLinejoin="round" />
              ))}
              {ligando && deLigacao && (
                <path d={`M${deLigacao.pos_x + deLigacao.largura / 2} ${deLigacao.pos_y + deLigacao.altura} L${ligando.x} ${ligando.y}`} fill="none" stroke="#e37f33" strokeWidth={2} strokeDasharray="6 5" />
              )}
            </svg>

            {lista.map((p) => (
              <CaixaQuadro
                key={p.id}
                p={p}
                carga={calc.cargas.get(p.id)!}
                selecionado={sel === p.id}
                editando={editando === p.id}
                alvo={ligando?.alvo === p.id}
                aoApertar={(e) => apertarQuadro(e, p)}
                aoDuploClique={() => { setSel(p.id); setEditando(p.id); }}
                aoTamanho={(e) => apertarTamanho(e, p)}
                aoLigar={(e) => apertarLigacao(e, p)}
                aoEscrever={(m) => mudarLocal(p.id, m)}
                aoSair={(campo) => salvar(p.id, { [campo]: (porId.get(p.id) as PessoaOrg)[campo] } as MudancaQuadro)}
              />
            ))}
          </div>

          {!lista.length && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-sm rounded-2xl border border-dashed border-stone-300 bg-white/90 p-6 text-center text-sm text-stone-500">
                <div className="mb-1 font-semibold text-stone-800">O organograma está vazio</div>
                Clique em <b>Novo quadro</b> para colocar o primeiro cargo. Depois arraste, mude a cor e escreva dentro dele.
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Clique no quadro para escolher e arrastar. Clique de novo (ou dois cliques) para escrever dentro. Puxe a bolinha de baixo até outro quadro para ligar quem responde a quem.
          Roda do mouse aumenta e diminui; arraste o fundo para andar pela tela.
        </p>
      </div>

      {selecionado && (
        <Painel
          key={selecionado.id}
          p={selecionado}
          lista={lista}
          funcoes={funcs}
          atribs={atribs}
          calc={calc}
          aoMudar={(m) => mudar(selecionado.id, m)}
          aoChefe={(c) => definirChefe(selecionado.id, c)}
          aoExcluir={() => remover(selecionado.id)}
          aoFechar={() => { setSel(null); setEditando(null); }}
          aoMarcar={(funcaoId, faz) => {
            setAtribs((a) => (faz ? [...a, { funcao_id: funcaoId, pessoa_id: selecionado.id }] : a.filter((x) => !(x.funcao_id === funcaoId && x.pessoa_id === selecionado.id))));
            iniciar(async () => { const r = await marcarFuncao(selecionado.id, funcaoId, faz); if (!r.ok) avisar(r.erro, true); });
          }}
          aoCriarFuncoes={(linhas) =>
            iniciar(async () => {
              const r = await criarFuncoesRapido(linhas, selecionado.id, selecionado.setor);
              if (!r.ok) { avisar(r.erro, true); return; }
              setFuncs((f) => [...f, ...r.dado.map((x) => ({ ...x, horas_semana: Number(x.horas_semana), setor: selecionado.setor, descricao: null }))]);
              setAtribs((a) => [...a, ...r.dado.map((x) => ({ funcao_id: x.id, pessoa_id: selecionado.id }))]);
            })
          }
        />
      )}
    </div>
  );
}

const rotuloCurto = (p: PessoaOrg) => (ehVaga(p) ? p.cargo : `${p.nome} (${p.cargo})`);

function BotaoZoom({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={rotulo} aria-label={rotulo} className="flex h-7 w-7 items-center justify-center rounded-md text-base font-semibold text-stone-700 hover:bg-stone-100">
      {children}
    </button>
  );
}

/* ─────────── um quadro ─────────── */

type Carga = ReturnType<typeof calcularOrganograma>["cargas"] extends Map<string, infer C> ? C : never;

function CaixaQuadro({
  p, carga, selecionado, editando, alvo, aoApertar, aoDuploClique, aoTamanho, aoLigar, aoEscrever, aoSair,
}: {
  p: PessoaOrg;
  carga: Carga;
  selecionado: boolean;
  editando: boolean;
  alvo: boolean;
  aoApertar: (e: React.PointerEvent) => void;
  aoDuploClique: () => void;
  aoTamanho: (e: React.PointerEvent) => void;
  aoLigar: (e: React.PointerEvent) => void;
  aoEscrever: (m: Partial<PessoaOrg>) => void;
  aoSair: (campo: "cargo" | "nome" | "texto") => void;
}) {
  const cor = corDoQuadro(p.cor);
  const vaga = ehVaga(p);
  const nivel = NIVEL[carga.nivel];
  const campo = `w-full bg-transparent outline-none placeholder:text-stone-400 ${editando ? "cursor-text" : "pointer-events-none"}`;
  return (
    <div
      data-quadro={p.id}
      onPointerDown={aoApertar}
      onDoubleClick={aoDuploClique}
      className={`group absolute flex flex-col overflow-hidden rounded-xl border-2 shadow-[0_1px_3px_rgb(26_26_26/0.08)] transition-shadow ${vaga ? "border-dashed" : ""} ${editando ? "cursor-default" : "cursor-move"} ${selecionado ? "shadow-[0_8px_24px_-8px_rgb(26_26_26/0.35)] ring-4 ring-madeira-300/50" : ""} ${alvo ? "ring-4 ring-madeira-500" : ""}`}
      style={{ left: p.pos_x, top: p.pos_y, width: p.largura, height: p.altura, borderColor: cor.hex, background: `color-mix(in srgb, ${cor.hex} 10%, white)` }}
    >
      <div className="h-1.5 shrink-0" style={{ background: cor.hex }} />
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 px-3 pb-2 pt-2">
        <input
          value={p.cargo}
          readOnly={!editando}
          tabIndex={editando ? 0 : -1}
          onChange={(e) => aoEscrever({ cargo: e.target.value })}
          onBlur={() => aoSair("cargo")}
          placeholder="Cargo"
          className={`${campo} text-[15px] font-semibold text-stone-900`}
        />
        <input
          value={p.nome ?? ""}
          readOnly={!editando}
          tabIndex={editando ? 0 : -1}
          onChange={(e) => aoEscrever({ nome: e.target.value })}
          onBlur={() => aoSair("nome")}
          placeholder="Vaga em aberto (escreva o nome)"
          className={`${campo} text-sm ${vaga ? "italic text-madeira-700" : "text-stone-700"}`}
        />
        <textarea
          value={p.texto ?? ""}
          readOnly={!editando}
          tabIndex={editando ? 0 : -1}
          onChange={(e) => aoEscrever({ texto: e.target.value })}
          onBlur={() => aoSair("texto")}
          placeholder={editando ? "Escreva aqui o que quiser…" : ""}
          className={`${campo} mt-1 min-h-0 flex-1 resize-none text-xs leading-relaxed text-stone-600`}
        />
        <div className="mt-1 shrink-0">
          {vaga ? (
            <div className="text-[11px] font-medium text-madeira-700">
              Contratar{carga.funcoes.length ? ` · ${carga.funcoes.length} ${carga.funcoes.length === 1 ? "função esperando" : "funções esperando"}` : ""}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                <span>{carga.funcoes.length} {carga.funcoes.length === 1 ? "função" : "funções"} · {horas(carga.horas)} de {horas(carga.capacidade)}</span>
                <span className={`font-semibold ${carga.nivel === "sobrecarregada" ? "text-rosa" : carga.nivel === "limite" ? "text-amber-600" : "text-stone-600"}`}>
                  {carga.pct === null ? "" : `${Math.round(carga.pct)}%`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200/80">
                <div className={`h-full rounded-full ${nivel.barra}`} style={{ width: `${Math.min(carga.pct ?? 0, 100)}%` }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* bolinha para ligar a quem responde a este quadro */}
      <span
        data-alca
        onPointerDown={aoLigar}
        title="Puxe até o quadro de quem responde a este"
        className={`absolute bottom-0 left-1/2 flex h-4 w-4 -translate-x-1/2 translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 bg-white transition ${selecionado ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        style={{ borderColor: cor.hex }}
      />
      {/* cantinho para mudar o tamanho */}
      <span
        data-alca
        onPointerDown={aoTamanho}
        title="Puxe para mudar o tamanho"
        className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 cursor-nwse-resize transition ${selecionado ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        style={{ background: `linear-gradient(135deg, transparent 50%, ${cor.hex} 50%)`, borderBottomRightRadius: 8 }}
      />
    </div>
  );
}

/* ─────────── painel do quadro escolhido ─────────── */

function Painel({
  p, lista, funcoes, atribs, calc, aoMudar, aoChefe, aoExcluir, aoFechar, aoMarcar, aoCriarFuncoes,
}: {
  p: PessoaOrg;
  lista: PessoaOrg[];
  funcoes: FuncaoOrg[];
  atribs: AtribuicaoOrg[];
  calc: ReturnType<typeof calcularOrganograma>;
  aoMudar: (m: MudancaQuadro) => void;
  aoChefe: (chefe: string | null) => void;
  aoExcluir: () => Promise<string | null>;
  aoFechar: () => void;
  aoMarcar: (funcaoId: string, faz: boolean) => void;
  aoCriarFuncoes: (linhas: string) => void;
}) {
  const [nova, setNova] = useState("");
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState(p.setor ?? "");
  const [capacidade, setCapacidade] = useState(String(p.horas_semana).replace(".", ","));
  const carga = calc.cargas.get(p.id)!;
  const fora = abaixoDe(p.id, lista);
  const podeSerChefe = lista.filter((x) => x.id !== p.id && !fora.has(x.id)).sort((a, b) => rotuloCurto(a).localeCompare(rotuloCurto(b), "pt-BR"));
  const minhas = new Set(atribs.filter((a) => a.pessoa_id === p.id).map((a) => a.funcao_id));
  const termo = busca.trim().toLowerCase();
  const visiveis = funcoes
    .filter((f) => !termo || f.nome.toLowerCase().includes(termo) || (f.setor ?? "").toLowerCase().includes(termo))
    .sort((a, b) => Number(minhas.has(b.id)) - Number(minhas.has(a.id)) || a.nome.localeCompare(b.nome, "pt-BR"));
  const setores = [...new Set(lista.map((x) => x.setor).filter(Boolean))] as string[];
  const nivel = NIVEL[carga.nivel];

  return (
    <aside className="vidro w-full shrink-0 self-start rounded-2xl p-4 lg:sticky lg:top-4 lg:w-80">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-stone-900">{p.cargo}</div>
          <div className="truncate text-xs text-stone-500">{nomeDaPessoa(p)}</div>
        </div>
        <button type="button" onClick={aoFechar} aria-label="Fechar" className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800">
          <Icone nome="fechar" className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1.5 text-xs font-medium text-stone-600">Cor do quadro</div>
      <div className="mb-4 grid grid-cols-8 gap-1.5">
        {CORES_QUADRO.map((c) => (
          <button
            key={c.id}
            type="button"
            title={c.nome}
            aria-label={c.nome}
            onClick={() => aoMudar({ cor: c.id })}
            className={`h-7 w-full rounded-md border-2 transition hover:scale-110 ${p.cor === c.id ? "ring-2 ring-stone-900 ring-offset-1" : ""}`}
            style={{ borderColor: c.hex, background: c.id === "branco" ? "#ffffff" : c.hex }}
          />
        ))}
      </div>

      <div className="grid gap-3 text-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-stone-600">Responde a</span>
          <select value={p.chefe_id ?? ""} onChange={(e) => aoChefe(e.target.value || null)} className={inputCls}>
            <option value="">Ninguém (topo do organograma)</option>
            {podeSerChefe.map((x) => <option key={x.id} value={x.id}>{rotuloCurto(x)}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-stone-600">Setor</span>
            <input list="setores-organograma" value={setor} onChange={(e) => setSetor(e.target.value)} onBlur={() => setor !== (p.setor ?? "") && aoMudar({ setor })} placeholder="Ex.: Produção" className={inputCls} />
            <datalist id="setores-organograma">{setores.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-stone-600">Horas por semana</span>
            <input
              inputMode="decimal"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              onBlur={() => { const n = Number(capacidade.replace(",", ".")); if (Number.isFinite(n) && n !== Number(p.horas_semana)) aoMudar({ horas_semana: n }); }}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-stone-700">Carga de trabalho</span>
          <span className={`font-semibold ${carga.nivel === "sobrecarregada" ? "text-rosa" : carga.nivel === "limite" ? "text-amber-600" : "text-stone-700"}`}>{nivel.rotulo}</span>
        </div>
        {carga.nivel === "vaga" ? (
          <p className="mt-1 text-xs text-stone-500">Ninguém neste cargo ainda. Escreva o nome no quadro quando contratar.</p>
        ) : (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
              <div className={`h-full rounded-full ${nivel.barra}`} style={{ width: `${Math.min(carga.pct ?? 0, 100)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-stone-500">
              {horas(carga.horas)} de {horas(carga.capacidade)} por semana{carga.pct !== null ? ` (${Math.round(carga.pct)}%)` : ""} em {carga.funcoes.length} {carga.funcoes.length === 1 ? "função" : "funções"}.
            </p>
          </>
        )}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-stone-600">Funções deste quadro</span>
          <span className="text-[11px] text-stone-400">{minhas.size} marcada{minhas.size === 1 ? "" : "s"}</span>
        </div>
        {funcoes.length > 6 && <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar função" className={`${inputCls} mb-2 w-full !py-1.5`} />}
        <div className="max-h-60 overflow-y-auto rounded-lg border border-stone-200 bg-white">
          {visiveis.length ? visiveis.map((f) => {
            const outros = calc.genteDe(f.id).filter((x) => x.id !== p.id);
            return (
              <label key={f.id} className="flex cursor-pointer items-start gap-2 border-b border-stone-100 px-2.5 py-2 text-sm last:border-0 hover:bg-stone-50">
                <input type="checkbox" checked={minhas.has(f.id)} onChange={(e) => aoMarcar(f.id, e.target.checked)} className="mt-0.5 accent-[#e37f33]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-stone-800">{f.nome}</span>
                  <span className="block text-[11px] text-stone-500">
                    {horas(Number(f.horas_semana))}/semana{outros.length ? ` · com ${outros.map((o) => nomeDaPessoa(o)).join(", ")}` : ""}
                  </span>
                </span>
              </label>
            );
          }) : <p className="p-3 text-center text-xs text-stone-400">{funcoes.length ? "Nenhuma função com esse nome." : "Nenhuma função cadastrada ainda."}</p>}
        </div>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => { e.preventDefault(); if (nova.trim()) { aoCriarFuncoes(nova); setNova(""); } }}
        >
          <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nova função - 10h" className={`${inputCls} min-w-0 flex-1 !py-1.5`} />
          <button className={`${estiloBotao.secundario} !px-3 !py-1.5`}>Adicionar</button>
        </form>
        <p className="mt-1 text-[11px] text-stone-400">Escreva o nome e, se quiser, as horas por semana no fim (ex.: &quot;Fazer orçamentos - 12h&quot;).</p>
      </div>

      <div className="mt-4">
        <BotaoExcluir
          rotulo="Excluir quadro"
          acao={aoExcluir}
          titulo="Excluir este quadro?"
          detalhe={<><strong>{rotuloCurto(p)}</strong>. Quem responde a ele passa a responder a quem está acima. As funções continuam cadastradas.</>}
          aviso="Quadro excluído"
        />
      </div>
    </aside>
  );
}
