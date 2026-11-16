import { Logo } from "@/components/logo";
import { FormLogin } from "./form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-indigo-lateral p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgb(47_111_224/0.35),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.03)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-10 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)]">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="rounded-[12px] shadow-lg"><Logo tamanho={48} /></div>
          <div>
            <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-stone-900">Emob <span className="rounded-md bg-marinho px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">Pro</span></h1>
            <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500">São João Móveis</p>
          </div>
        </div>
        <FormLogin />
      </div>
    </main>
  );
}
