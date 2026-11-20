import { Titulo } from "@/components/ui";
import { exigirAdmin } from "@/lib/perfil";
import { ConferirExtrato } from "./conferir";

/** Conferência do caixa: lê o extrato do banco (.xlsx) e dá baixa nas contas que já caíram. */
export default async function ExtratoPage() {
  await exigirAdmin();
  return (
    <>
      <Titulo sub="Envie o extrato do banco e marque como pago, de uma vez, o que já entrou ou saiu da conta.">Conferir com o extrato</Titulo>
      <ConferirExtrato />
    </>
  );
}
