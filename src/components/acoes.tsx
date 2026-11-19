"use client";

import { Suspense, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icone } from "./icones";

/* ------------------------------------------------------------------ */
/* Aviso rápido no canto da tela ("Salvo", "Excluído"...)              */
/* ------------------------------------------------------------------ */

const EVENTO_AVISO = "sj:aviso";
type Aviso = { id: number; texto: string; erro?: boolean };

/** Mostra um aviso rápido no canto da tela. */
export function avisar(texto: string, erro = false) {
  window.dispatchEvent(new CustomEvent<Omit<Aviso, "id">>(EVENTO_AVISO, { detail: { texto, erro } }));
}

/** Lugar onde os avisos aparecem. Fica uma vez só, no layout. */
export function Avisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  useEffect(() => {
    let n = 0;
    const chegou = (e: Event) => {
      const a = { ...(e as CustomEvent<Omit<Aviso, "id">>).detail, id: ++n };
      setAvisos((l) => [...l.slice(-2), a]);
      window.setTimeout(() => setAvisos((l) => l.filter((x) => x.id !== a.id)), a.erro ? 6000 : 3000);
    };
    window.addEventListener(EVENTO_AVISO, chegou);
    return () => window.removeEventListener(EVENTO_AVISO, chegou);
  }, []);
  if (!avisos.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-2 print:hidden" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className="aviso-entra pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl bg-[#3d3d3d] px-4 py-3 text-sm text-white shadow-[0_12px_30px_-10px_rgb(26_26_26/0.5)]">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${a.erro ? "bg-rosa" : "bg-neon"}`}>
            <Icone nome={a.erro ? "alerta" : "certo"} className="h-3 w-3" />
          </span>
          {a.texto}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Excluir com confirmação                                             */
/* ------------------------------------------------------------------ */

/**
 * Lixeira que pergunta "Tem certeza?" antes de excluir.
 * A ação devolve uma mensagem quando não dá para excluir (ex.: cliente com pedidos).
 */
export function BotaoExcluir({
  acao,
  titulo,
  detalhe,
  aviso = "Excluído",
  rotulo,
  depois,
}: {
  acao: () => Promise<string | null | void>;
  titulo: string;
  detalhe?: ReactNode;
  aviso?: string;
  /** Com rótulo, vira um botão com texto (ex.: "Excluir cliente") em vez da lixeira. */
  rotulo?: string;
  /** Tela para onde ir depois de excluir (ex.: a lista, quando se exclui da ficha). */
  depois?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, iniciar] = useTransition();
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    cancelar.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto]);

  const confirmar = () =>
    iniciar(async () => {
      try {
        const msg = await acao();
        if (msg) { setErro(msg); return; }
        setAberto(false);
        avisar(aviso);
        if (depois) router.push(depois);
      } catch {
        setErro("Não foi possível excluir. Tente de novo.");
      }
    });

  return (
    <>
      {rotulo ? (
        <button type="button" onClick={() => { setErro(null); setAberto(true); }} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-rosa/40 hover:text-rosa">
          <Icone nome="lixeira" className="h-4 w-4" /> {rotulo}
        </button>
      ) : (
        <button type="button" title="Excluir" aria-label="Excluir" onClick={() => { setErro(null); setAberto(true); }} className={`${ESTILO_ICONE} hover:border-rosa/40 hover:text-rosa`}>
          <Icone nome="lixeira" className="h-4 w-4" />
        </button>
      )}
      {aberto && (
        <div className="janela-fundo fixed inset-0 z-[65] flex items-start justify-center p-4 pt-[22vh] text-left print:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget && !excluindo) setAberto(false); }}>
          <div role="alertdialog" aria-modal="true" aria-label={titulo} className="janela-caixa w-full max-w-sm whitespace-normal rounded-2xl bg-white p-6 text-center shadow-[0_30px_80px_-20px_rgb(26_26_26/0.55)] ring-1 ring-stone-900/5">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rosa/10 text-rosa">
              <Icone nome={erro ? "alerta" : "lixeira"} className="h-6 w-6" />
            </span>
            <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
            {detalhe && <p className="mt-2 text-sm text-stone-600">{detalhe}</p>}
            {erro ? (
              <p className="mt-3 rounded-lg bg-rosa/10 p-3 text-sm text-rosa ring-1 ring-rosa/30">{erro}</p>
            ) : (
              <p className="mt-1 text-xs text-stone-400">Isso não pode ser desfeito.</p>
            )}
            <div className="mt-5 flex justify-center gap-2">
              <button ref={cancelar} type="button" onClick={() => setAberto(false)} disabled={excluindo} className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50">
                {erro ? "Fechar" : "Cancelar"}
              </button>
              {!erro && (
                <button type="button" onClick={confirmar} disabled={excluindo} className="rounded-full bg-rosa px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">
                  {excluindo ? "Excluindo…" : "Sim, excluir"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Editar numa janela, direto da lista                                 */
/* ------------------------------------------------------------------ */

const ESTILO_ICONE =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:border-madeira-300 hover:text-madeira-700";

/** Lápis da linha: abre a janela de edição daquele registro (?editar=id). */
export function LinkEditar(props: { id: string; param?: string }) {
  return (
    <Suspense fallback={<span className={ESTILO_ICONE}><Icone nome="lapis" className="h-4 w-4" /></span>}>
      <LinkEditarComFiltros {...props} />
    </Suspense>
  );
}

function LinkEditarComFiltros({ id, param = "editar" }: { id: string; param?: string }) {
  const sp = useSearchParams();
  const caminho = usePathname();
  const p = new URLSearchParams(sp.toString());
  p.set(param, id);
  return (
    <Link href={`${caminho}?${p.toString()}`} scroll={false} replace title="Alterar" aria-label="Alterar" className={ESTILO_ICONE}>
      <Icone nome="lapis" className="h-4 w-4" />
    </Link>
  );
}

/** "Cancelar" dentro de um formulário que está numa janela: só fecha a janela. */
export function BotaoCancelar() {
  return (
    <button type="button" onClick={(e) => e.currentTarget.closest("dialog")?.close()} className="rounded-full border border-stone-200 bg-white px-5 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50">
      Cancelar
    </button>
  );
}

/** Grupo de botões no fim da linha da tabela (lápis e lixeira). */
export function AcoesLinha({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1.5">{children}</div>;
}

const LARGURA = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-3xl", xl: "max-w-5xl" } as const;

/**
 * Janela de edição que abre quando o endereço tem ?editar=id.
 * Fechar (esc, X, clique fora ou salvar) tira o ?editar do endereço.
 */
export function JanelaEditar(props: Parameters<typeof JanelaEditarDentro>[0]) {
  return (
    <Suspense fallback={null}>
      <JanelaEditarDentro {...props} />
    </Suspense>
  );
}

function JanelaEditarDentro({
  titulo,
  descricao,
  children,
  param = "editar",
  aviso = "Alterações salvas",
  largura = "lg",
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  param?: string;
  aviso?: string;
  largura?: keyof typeof LARGURA;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const caminho = usePathname();
  const sp = useSearchParams();

  const limpar = () => {
    const p = new URLSearchParams(sp.toString());
    p.delete(param);
    const q = p.toString();
    router.replace(q ? `${caminho}?${q}` : caminho, { scroll: false });
  };
  const fechar = () => ref.current?.close();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={limpar}
      className={`janela mx-auto mb-auto mt-[8vh] w-[calc(100%-2rem)] ${LARGURA[largura]} overflow-visible rounded-2xl bg-white p-0 text-left text-stone-800 shadow-[0_30px_80px_-20px_rgb(26_26_26/0.55)] backdrop:bg-transparent`}
      onMouseDown={(e) => { if (e.target === ref.current) fechar(); }}
      onSubmit={(e) => {
        if (e.defaultPrevented) return;
        setTimeout(() => { fechar(); avisar(aviso); }, 0);
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-stone-500">{descricao}</p>}
        </div>
        <div className="flex items-center gap-2">
          <kbd className="hidden rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-400 sm:inline">esc</kbd>
          <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-800">
            <Icone nome="fechar" className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="dentro-janela max-h-[75vh] overflow-y-auto px-6 py-5">
        {children}
      </div>
    </dialog>
  );
}
