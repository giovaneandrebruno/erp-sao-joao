"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icone, type NomeDoIcone } from "./icones";
import { estiloBotao } from "./ui";

type Largura = "sm" | "md" | "lg" | "xl";
const LARGURA: Record<Largura, string> = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-3xl", xl: "max-w-5xl" };

function Cabecalho({ titulo, descricao, fechar }: { titulo?: ReactNode; descricao?: ReactNode; fechar: () => void }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${titulo ? "border-b border-stone-200 px-6 py-4" : "absolute right-3 top-3 z-10"}`}>
      {titulo && (
        <div>
          <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-stone-500">{descricao}</p>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <kbd className="hidden rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-400 sm:inline">esc</kbd>
        <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-800">
          <Icone nome="fechar" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Janela aberta por um link (ex.: "Novo cliente"): a tela aparece por cima da atual,
 * com o fundo escurecido. Fechar volta para a tela de antes. Ao salvar, o sistema
 * navega para outro endereço e a janela some sozinha.
 */
export function JanelaRota({ children, largura = "lg" }: { children: ReactNode; largura?: Largura }) {
  const router = useRouter();
  const caminho = usePathname();
  const [inicial] = useState(caminho);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") router.back(); };
    window.addEventListener("keydown", tecla);
    caixa.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
    return () => window.removeEventListener("keydown", tecla);
  }, [router]);

  if (caminho !== inicial) return null;

  return (
    <div
      className="janela-fundo fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh] print:hidden"
      onMouseDown={(e) => { if (e.target === e.currentTarget) router.back(); }}
    >
      <div ref={caixa} role="dialog" aria-modal="true" className={`janela-caixa relative mb-10 w-full ${LARGURA[largura]} rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgb(8_16_30/0.55)] ring-1 ring-stone-900/5`}>
        <Cabecalho fechar={() => router.back()} />
        <div className="dentro-janela px-6 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Botão que abre um formulário numa janela por cima da tela, com o fundo escurecido.
 * Ao enviar o formulário, a janela fecha e a lista da tela é atualizada.
 */
export function JanelaBotao({
  rotulo,
  titulo,
  descricao,
  children,
  variante = "primario",
  icone = "mais",
  largura = "lg",
  abrirAoCarregar = false,
  className,
}: {
  rotulo: ReactNode;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  variante?: "primario" | "secundario" | "link";
  icone?: NomeDoIcone | null;
  largura?: Largura;
  abrirAoCarregar?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const abrir = () => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea")?.focus();
  };
  const fechar = () => ref.current?.close();

  useEffect(() => {
    if (abrirAoCarregar) abrir();
  }, [abrirAoCarregar]);

  const cls =
    variante === "link"
      ? "inline-flex items-center gap-1.5 text-sm font-medium text-madeira-700 hover:underline"
      : estiloBotao[variante];

  return (
    <>
      <button type="button" onClick={abrir} className={`${cls} ${className ?? ""}`}>
        {icone && <Icone nome={icone} className="h-4 w-4" />}
        {rotulo}
      </button>
      <dialog
        ref={ref}
        className={`janela mx-auto mb-auto mt-[8vh] w-[calc(100%-2rem)] ${LARGURA[largura]} overflow-visible rounded-2xl bg-white p-0 text-left text-stone-800 shadow-[0_30px_80px_-20px_rgb(8_16_30/0.55)] backdrop:bg-transparent`}
        onMouseDown={(e) => { if (e.target === ref.current) fechar(); }}
        onSubmit={(e) => {
          // formulários que mostram uma resposta (ex.: "usuário criado") deixam a janela aberta
          if (e.defaultPrevented || (e.target as HTMLElement).closest("[data-manter-aberta]")) return;
          // espera o formulário ser enviado antes de fechar
          setTimeout(fechar, 0);
        }}
      >
        <Cabecalho titulo={titulo} descricao={descricao} fechar={fechar} />
        <div className="dentro-janela max-h-[75vh] overflow-y-auto px-6 py-5">{children}</div>
      </dialog>
    </>
  );
}
