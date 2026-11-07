import { Suspense } from "react";
import { Marca } from "@/components/logo";
import { sair } from "../login/actions";

export default function CampoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="lateral sticky top-0 z-10 flex items-center justify-between px-5 py-4 print:hidden">
        <Marca />
        <form action={sair}><button className="text-sm text-stone-500 hover:text-stone-900">Sair</button></form>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">
        <Suspense fallback={<p className="text-sm text-stone-400">Carregando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
