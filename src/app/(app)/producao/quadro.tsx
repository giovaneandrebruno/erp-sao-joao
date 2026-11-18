"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_PCP, progresso, statusPcp, vizinho, type Ordem } from "@/lib/pcp";
import { PrazoSelo, SeloStatus } from "./componentes";
import { definirStatus } from "./actions";

type Arrasto = { id: string; x: number; y: number; dx: number; dy: number; largura: number; alvo: string | null };

/**
 * Quadro de produção estilo kanban: arraste o cartão do cliente para outra
 * coluna e a etapa (STATUS) muda sozinha no sistema.
 * No computador, clique e arraste. No celular, segure o cartão e arraste.
 */
export function QuadroArrastavel({ ordens, hoje, concluidas }: { ordens: Ordem[]; hoje: string; concluidas: number }) {
  const router = useRouter();
  const [lista, setLista] = useState(ordens);
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [salvando, iniciar] = useTransition();
  const inicio = useRef<{ id: string; x: number; y: number; tipo: string; el: HTMLElement; timer?: number; ativo: boolean } | null>(null);
  const arrastou = useRef(false);

  // quando a tela recarrega com dados novos do servidor, usa os dados novos
  const [anteriores, setAnteriores] = useState(ordens);
  if (ordens !== anteriores) {
    setAnteriores(ordens);
    setLista(ordens);
  }
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 3500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const colunaEm = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-coluna]");
    return el?.dataset.coluna ?? null;
  };

  function mover(id: string, para: string) {
    const o = lista.find((x) => x.id === id);
    if (!o || o.status_pcp === para) return;
    const de = o.status_pcp;
    setLista((l) => l.map((x) => (x.id === id ? { ...x, status_pcp: para } : x)));
    iniciar(async () => {
      const r = await definirStatus(id, para);
      if (!r.ok) {
        setLista((l) => l.map((x) => (x.id === id ? { ...x, status_pcp: de } : x)));
        setAviso({ texto: `Não foi possível mudar a etapa: ${r.erro}`, erro: true });
        return;
      }
      setAviso({ texto: `${o.cliente_nome}: ${de} → ${para} (${statusPcp(para).nome})` });
      router.refresh();
    });
  }

  function comecar(e: React.PointerEvent<HTMLElement>, id: string) {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button, form")) return;
    const el = e.currentTarget;
    arrastou.current = false;
    inicio.current = { id, x: e.clientX, y: e.clientY, tipo: e.pointerType, el, ativo: false };
    if (e.pointerType !== "mouse") {
      // no celular: segurar um instante para pegar o cartão (assim a tela ainda rola normalmente)
      inicio.current.timer = window.setTimeout(() => ativar(e.clientX, e.clientY), 300);
    }
  }

  function ativar(x: number, y: number) {
    const i = inicio.current;
    if (!i || i.ativo) return;
    i.ativo = true;
    arrastou.current = true;
    const r = i.el.getBoundingClientRect();
    navigator.vibrate?.(15);
    setArrasto({ id: i.id, x, y, dx: i.x - r.left, dy: i.y - r.top, largura: r.width, alvo: colunaEm(x, y) });
  }

  useEffect(() => {
    const mexer = (e: PointerEvent) => {
      const i = inicio.current;
      if (!i) return;
      const dist = Math.hypot(e.clientX - i.x, e.clientY - i.y);
      if (!i.ativo) {
        if (i.tipo === "mouse" && dist > 6) ativar(e.clientX, e.clientY);
        else if (i.tipo !== "mouse" && dist > 10) { window.clearTimeout(i.timer); inicio.current = null; }
        return;
      }
      e.preventDefault();
      setArrasto((a) => (a ? { ...a, x: e.clientX, y: e.clientY, alvo: colunaEm(e.clientX, e.clientY) } : a));
      // rola o quadro sozinho quando o cartão chega perto da borda
      const quadro = document.getElementById("quadro-producao");
      if (quadro) {
        const r = quadro.getBoundingClientRect();
        if (e.clientX > r.right - 60) quadro.scrollLeft += 14;
        else if (e.clientX < r.left + 60) quadro.scrollLeft -= 14;
      }
    };
    const soltar = (e: PointerEvent) => {
      const i = inicio.current;
      inicio.current = null;
      if (!i) return;
      window.clearTimeout(i.timer);
      if (!i.ativo) return;
      const alvo = colunaEm(e.clientX, e.clientY);
      setArrasto(null);
      if (alvo) mover(i.id, alvo);
    };
    const cancelar = () => {
      if (inicio.current) window.clearTimeout(inicio.current.timer);
      inicio.current = null;
      setArrasto(null);
    };
    const travarToque = (e: TouchEvent) => { if (inicio.current?.ativo) e.preventDefault(); };
    window.addEventListener("pointermove", mexer, { passive: false });
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", cancelar);
    window.addEventListener("touchmove", travarToque, { passive: false });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") cancelar(); };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointermove", mexer);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", cancelar);
      window.removeEventListener("touchmove", travarToque);
      window.removeEventListener("keydown", esc);
    };
  });

  const ativas = lista.filter((o) => o.status_pcp !== "FIN");
  const movidas = lista.length - ativas.length;
  const sendoArrastada = arrasto ? lista.find((o) => o.id === arrasto.id) : null;

  return (
    <>
      <p className="mb-3 text-xs text-stone-500">
        Arraste o cartão para outra coluna para mudar a etapa. No celular, segure o cartão antes de arrastar.
        {salvando && <span className="ml-2 font-medium text-azul">Salvando…</span>}
      </p>
      <div id="quadro-producao" className={`flex gap-3 overflow-x-auto pb-4 ${arrasto ? "cursor-grabbing select-none" : ""}`}>
        {STATUS_PCP.map((s) => {
          const fin = s.sigla === "FIN";
          const daEtapa = fin ? [] : ativas.filter((o) => o.status_pcp === s.sigla);
          const vazia = daEtapa.length === 0;
          const alvo = arrasto?.alvo === s.sigla && sendoArrastada?.status_pcp !== s.sigla;
          return (
            <div
              key={s.sigla}
              data-coluna={s.sigla}
              className={`flex shrink-0 flex-col rounded-xl p-2 transition-colors ${vazia ? "w-36" : "w-72"} ${alvo ? "bg-azul/10 ring-2 ring-azul" : "bg-stone-200/50"}`}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <SeloStatus sigla={s.sigla} />
                <span className="truncate text-xs font-semibold text-stone-600" title={s.nome}>{s.nome}</span>
                <span className="ml-auto text-xs text-stone-400">{fin ? concluidas + movidas : daEtapa.length}</span>
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {fin && (
                  <Link href="/producao?ver=concluidos" className="rounded-lg border border-dashed border-stone-300 p-3 text-center text-xs text-stone-500 hover:bg-white">
                    Solte aqui para finalizar.<br />Ver as concluídas →
                  </Link>
                )}
                {daEtapa.map((o) => (
                  <CartaoOs
                    key={o.id}
                    o={o}
                    hoje={hoje}
                    fantasma={arrasto?.id === o.id}
                    aoApertar={(e) => comecar(e, o.id)}
                    aoClicar={(e) => { if (arrastou.current) { e.preventDefault(); arrastou.current = false; } }}
                    mover={(para) => mover(o.id, para)}
                  />
                ))}
                {vazia && !fin && <div className="rounded-lg border border-dashed border-stone-300 p-3 text-center text-[11px] text-stone-400">Solte aqui</div>}
              </div>
            </div>
          );
        })}
      </div>

      {arrasto && sendoArrastada && (
        <div
          className="pointer-events-none fixed z-50 rotate-2 opacity-95 shadow-[0_20px_40px_-12px_rgb(26_26_26/0.45)]"
          style={{ left: arrasto.x - arrasto.dx, top: arrasto.y - arrasto.dy, width: arrasto.largura }}
        >
          <CartaoOs o={sendoArrastada} hoje={hoje} />
        </div>
      )}

      {aviso && (
        <div role="status" className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${aviso.erro ? "bg-rosa" : "bg-marinho"}`}>
          {aviso.texto}
        </div>
      )}
    </>
  );
}

function CartaoOs({
  o,
  hoje,
  fantasma,
  aoApertar,
  aoClicar,
  mover,
}: {
  o: Ordem;
  hoje: string;
  fantasma?: boolean;
  aoApertar?: (e: React.PointerEvent<HTMLElement>) => void;
  aoClicar?: (e: React.MouseEvent) => void;
  mover?: (para: string) => void;
}) {
  const s = statusPcp(o.status_pcp);
  const prog = progresso(o, hoje);
  const ant = vizinho(o.status_pcp, -1);
  const prox = vizinho(o.status_pcp, 1);
  return (
    <div
      onPointerDown={aoApertar}
      onContextMenu={(e) => { if (aoApertar) e.preventDefault(); }}
      className={`rounded-lg border border-stone-200 border-l-4 bg-white p-3 text-sm shadow-[0_1px_2px_rgb(26_26_26/0.04)] transition hover:shadow-[0_8px_20px_-12px_rgb(26_26_26/0.35)] ${aoApertar ? "cursor-grab [-webkit-touch-callout:none]" : ""} ${fantasma ? "opacity-30" : ""}`}
      style={{ borderLeftColor: s.cor }}
    >
      <Link href={`/producao/${o.id}`} onClick={aoClicar} draggable={false} className="block select-none">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold leading-snug text-stone-900">{o.cliente_nome}</span>
          {o.os && <span className="shrink-0 rounded bg-stone-100 px-1.5 font-mono text-[11px] text-stone-600">OS {o.os}</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-stone-500">
          {o.posicao && <span className="font-medium text-stone-700">{o.posicao}</span>}
          {o.consultor && <span>Consultor: {o.consultor}</span>}
          {o.responsavel && <span>Resp.: {o.responsavel}</span>}
        </div>
        <div className="mt-2"><PrazoSelo ordem={o} hoje={hoje} /></div>
        {o.pendencias && <p className="mt-2 line-clamp-2 text-xs text-rosa">{o.pendencias}</p>}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100" title={`${prog.feitos} de ${prog.total} etapas concluídas`}>
          <div className="h-full bg-neon" style={{ width: `${(prog.feitos / prog.total) * 100}%` }} />
        </div>
      </Link>
      {mover && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <button type="button" disabled={!ant} onClick={() => ant && mover(ant)} title={ant ? `Voltar para ${ant}` : ""} className="rounded px-2 py-0.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30">← {ant ?? ""}</button>
          <button type="button" disabled={!prox} onClick={() => prox && mover(prox)} title={prox ? `Avançar para ${prox}` : ""} className="rounded px-2 py-0.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30">{prox ?? ""} →</button>
        </div>
      )}
    </div>
  );
}
