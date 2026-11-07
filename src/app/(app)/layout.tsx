import { Suspense } from "react";
import { Menu } from "./menu";
import { sair } from "../login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="print:hidden flex flex-col gap-4 bg-stone-800 p-4 md:w-56 md:shrink-0">
        <div className="text-lg font-semibold text-white">ERP São João</div>
        <Suspense fallback={null}><Menu /></Suspense>
        <form action={sair} className="md:mt-auto">
          <button className="text-sm text-stone-400 hover:text-white">Sair</button>
        </form>
      </aside>
      <main className="flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
