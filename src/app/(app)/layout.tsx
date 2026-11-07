import { Suspense } from "react";
import { Marca } from "@/components/logo";
import { Menu } from "./menu";
import { sair } from "../login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="print:hidden border-white/[0.06] md:w-64 md:shrink-0 md:border-r">
        <div className="flex flex-col gap-8 px-5 py-6 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <Marca />
          <Suspense fallback={null}><Menu /></Suspense>
          <form action={sair} className="md:mt-auto">
            <button className="flex items-center gap-2 px-3 text-sm text-stone-500 transition hover:text-stone-900">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-400" /> Sair
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-6 py-8 md:px-12 md:py-10 print:p-0">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
