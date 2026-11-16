import { JanelaRota } from "@/components/janela";
import NovoProdutoPage from "../../../estoque/novo/page";

/** Aberta a partir de outra tela: aparece numa janela por cima, com o fundo escurecido. */
export default function Janela() {
  return (
    <JanelaRota largura="lg">
      <NovoProdutoPage />
    </JanelaRota>
  );
}
