import { JanelaRota } from "@/components/janela";
import NovoClientePage from "../../../clientes/novo/page";

/** Aberta a partir de outra tela: aparece numa janela por cima, com o fundo escurecido. */
export default function Janela() {
  return (
    <JanelaRota largura="md">
      <NovoClientePage />
    </JanelaRota>
  );
}
