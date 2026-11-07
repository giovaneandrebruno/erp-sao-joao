import { Marca } from "@/components/logo";
import { FormLogin } from "./form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-grafite p-6">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-6"><Marca /></div>
        <p className="mb-4 text-sm text-stone-500">Gestão da marcenaria e da loja. Entre com seu usuário.</p>
        <FormLogin />
      </div>
    </main>
  );
}
