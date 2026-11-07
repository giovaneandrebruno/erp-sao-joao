import { FormLogin } from "./form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">ERP São João</h1>
        <p className="mb-6 text-sm text-stone-500">Marcenaria e São João Móveis</p>
        <FormLogin />
      </div>
    </main>
  );
}
