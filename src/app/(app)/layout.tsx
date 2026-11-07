import { Suspense } from "react";
import { Marca } from "@/components/logo";
import { Menu } from "./menu";
import { sair } from "../login/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="print:hidden bg-grafite md:w-60 md:shrink-0">
        <div className="flex flex-col gap-6 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <Marca claro />
          <Suspense fallback={null}><Menu /></Suspense>
          <form action={sair} className="md:mt-auto">
            <button className="px-3 text-sm text-stone-400 hover:text-white">Sair</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
