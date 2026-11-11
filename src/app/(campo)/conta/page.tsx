import Link from "next/link";
import { Cartao, Titulo } from "@/components/ui";
import { perfilAtual } from "@/lib/perfil";
import { inicioDo } from "@/lib/acesso";
import { TrocarSenha } from "./form";

export default async function ContaPage() {
  const perfil = await perfilAtual();
  return (
    <>
      <Titulo sub={perfil?.email}>Minha senha</Titulo>
      <Cartao><TrocarSenha /></Cartao>
      <Link href={inicioDo(perfil?.papel)} className="mt-6 inline-block text-sm text-violeta hover:underline">← Voltar</Link>
    </>
  );
}
