import { Suspense } from "react";
import { Marca } from "@/components/logo";
import { Menu } from "./menu";
import { sair } from "../login/actions";
import { perfilAtual } from "@/lib/perfil";

const sairBotao = (
  <form action={sair} className="md:mt-auto">
    <button className="flex items-center gap-2 px-3 text-sm text-stone-500 transition hover:text-stone-900">
      <span className="h-1.5 w-1.5 rounded-full bg-stone-400" /> Sair
    </button>
  </form>
);

async function MenuDoUsuario() {
  const perfil = await perfilAtual();
  return <Menu papel={perfil?.papel ?? "vendedor"} marca={<Marca />} rodape={sairBotao} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="lateral print:hidden md:w-64 md:shrink-0">
        <div className="flex flex-col gap-6 px-5 py-4 md:sticky md:top-0 md:h-screen md:gap-8 md:overflow-y-auto md:py-6">
          <Suspense fallback={<Marca />}><MenuDoUsuario /></Suspense>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-12 md:py-10 print:p-0">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
