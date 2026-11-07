import { Logo } from "@/components/logo";
import { FormLogin } from "./form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-violeta/20 to-ciano/15 blur-3xl" />
      <div className="vidro relative w-full max-w-sm rounded-3xl p-10">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="rounded-[12px] shadow-[0_0_40px_-2px_rgb(124_92_255/0.9)]"><Logo tamanho={48} /></div>
          <div>
            <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-stone-900">Emob <span className="rounded-md bg-gradient-to-r from-violeta to-ciano px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">Pro</span></h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">São João Móveis</p>
          </div>
        </div>
        <FormLogin />
      </div>
    </main>
  );
}
