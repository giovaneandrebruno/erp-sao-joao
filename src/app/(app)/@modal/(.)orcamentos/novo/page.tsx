import { JanelaRota } from "@/components/janela";
import NovoOrcamentoPage from "../../../orcamentos/novo/page";

/** Aberta a partir de outra tela: aparece numa janela por cima, com o fundo escurecido. */
export default function Janela(props: PageProps<"/orcamentos/novo">) {
  return (
    <JanelaRota largura="lg">
      <NovoOrcamentoPage {...props} />
    </JanelaRota>
  );
}
