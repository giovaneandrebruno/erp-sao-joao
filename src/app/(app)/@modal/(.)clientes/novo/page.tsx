import { JanelaRota } from "@/components/janela";
import NovoClientePage from "../../../clientes/novo/page";

/** Aberta a partir de outra tela: aparece numa janela por cima, com o fundo escurecido. */
export default function Janela(props: PageProps<"/clientes/novo">) {
  return (
    <JanelaRota largura="lg">
      <NovoClientePage {...props} />
    </JanelaRota>
  );
}
