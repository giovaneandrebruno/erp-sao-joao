import { Logo } from "@/components/logo";
import { sair } from "../login/actions";

export default function SemAcessoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="vidro max-w-sm rounded-3xl p-10 text-center">
        <div className="mb-4 flex justify-center"><Logo tamanho={44} /></div>
        <h1 className="text-xl font-semibold text-stone-900">Acesso ainda não liberado</h1>
        <p className="mt-2 text-sm text-stone-500">Peça ao administrador para definir o seu perfil em Equipe e parceiros.</p>
        <form action={sair} className="mt-6"><button className="text-sm text-violeta hover:underline">Sair</button></form>
      </div>
    </main>
  );
}
