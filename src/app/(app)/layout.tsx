import Link from "next/link";
import { Suspense } from "react";
import { Marca } from "@/components/logo";
import { Icone } from "@/components/icones";
import { Menu } from "./menu";
import { Barra } from "./barra";
import { Paleta } from "./paleta";
import { sair } from "../login/actions";
import { perfilAtual } from "@/lib/perfil";
import { ROTULO_PAPEL } from "@/lib/acesso";

function iniciais(nome: string) {
  const p = nome.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase() || "?";
}

async function MenuDoUsuario() {
  const perfil = await perfilAtual();
  const papel = perfil?.papel ?? "vendedor";
  const nome = perfil?.nome || perfil?.email?.split("@")[0] || "Usuário";
  const rodape = (
    <div className="-mx-2 border-t border-white/10 px-2 pt-4">
      <div className="flex items-center gap-3 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold text-stone-900 ring-1 ring-inset ring-white/15">{iniciais(nome)}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-stone-900">{nome}</div>
          <div className="truncate text-[11px] text-stone-500">{ROTULO_PAPEL[papel].split(" (")[0]}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        <Link href="/conta" className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-stone-500 transition hover:bg-white/[0.06] hover:text-stone-900">
          <Icone nome="chave" className="h-3.5 w-3.5" /> Minha senha
        </Link>
        <form action={sair} className="flex-1">
          <button className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-stone-500 transition hover:bg-white/[0.06] hover:text-stone-900">
            <Icone nome="sair" className="h-3.5 w-3.5" /> Sair
          </button>
        </form>
      </div>
    </div>
  );
  return <Menu papel={papel} marca={<Marca />} rodape={rodape} />;
}

/** A busca rápida fica fora do menu lateral para usar as cores claras. */
async function BuscaDoUsuario() {
  const perfil = await perfilAtual();
  return <Paleta papel={perfil?.papel ?? "vendedor"} />;
}

export default function AppLayout({ children, modal }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="lateral sticky top-0 z-30 print:hidden md:h-screen md:w-[264px] md:shrink-0">
        <div className="flex flex-col gap-5 px-4 py-3 max-md:max-h-screen max-md:overflow-y-auto md:h-full md:py-5">
          <Suspense fallback={<Marca />}>
            <MenuDoUsuario />
          </Suspense>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden border-b border-stone-200/80 bg-white/85 backdrop-blur md:block print:hidden">
          <Suspense fallback={<div className="h-14" />}>
            <Barra />
          </Suspense>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-10 print:p-0">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
      {modal}
      <Suspense fallback={null}>
        <BuscaDoUsuario />
      </Suspense>
    </div>
  );
}
