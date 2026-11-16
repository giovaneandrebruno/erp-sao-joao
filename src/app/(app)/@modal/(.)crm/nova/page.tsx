import { JanelaRota } from "@/components/janela";
import NovaNegociacaoPage from "../../../crm/nova/page";

/** Aberta a partir de outra tela: aparece numa janela por cima, com o fundo escurecido. */
export default function Janela(props: PageProps<"/crm/nova">) {
  return (
    <JanelaRota largura="lg">
      <NovaNegociacaoPage {...props} />
    </JanelaRota>
  );
}
