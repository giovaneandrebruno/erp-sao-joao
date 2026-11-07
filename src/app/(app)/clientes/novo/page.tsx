import { Cartao, Titulo } from "@/components/ui";
import { FormCliente } from "../form";

export default function NovoClientePage() {
  return (
    <>
      <Titulo>Novo cliente</Titulo>
      <Cartao><FormCliente /></Cartao>
    </>
  );
}
