import { Campo, inputCls } from "@/components/ui";

type Pessoa = { id: string; nome: string; tipo: string };
type Neg = { origem?: string | null; valor_estimado?: number | null; vendedor_id?: string | null; arquiteto_id?: string | null; proxima_acao?: string | null; proxima_acao_data?: string | null };

export const ORIGENS = ["Indicação", "Arquiteto", "Instagram", "Facebook", "Google", "Site", "Loja (visita)", "WhatsApp", "Cliente antigo", "Outro"];

export function CamposNegociacao({ n = {}, parceiros }: { n?: Neg; parceiros: Pessoa[] }) {
  return (
    <>
      <Campo rotulo="Origem" className="md:col-span-2">
        <input name="origem" list="origens" defaultValue={n.origem ?? ""} className={inputCls} />
        <datalist id="origens">{ORIGENS.map((o) => <option key={o} value={o} />)}</datalist>
      </Campo>
      <Campo rotulo="Valor estimado (R$)" className="md:col-span-2">
        <input name="valor_estimado" inputMode="decimal" defaultValue={n.valor_estimado ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Vendedor" className="md:col-span-2">
        <select name="vendedor_id" defaultValue={n.vendedor_id ?? ""} className={inputCls}>
          <option value="">—</option>
          {parceiros.filter((p) => p.tipo === "vendedor").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Arquiteto / indicação (RT)" className="md:col-span-2">
        <select name="arquiteto_id" defaultValue={n.arquiteto_id ?? ""} className={inputCls}>
          <option value="">—</option>
          {parceiros.filter((p) => p.tipo === "arquiteto").map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Próxima ação" className="md:col-span-3">
        <input name="proxima_acao" placeholder="Ligar, agendar medição, enviar proposta..." defaultValue={n.proxima_acao ?? ""} className={inputCls} />
      </Campo>
      <Campo rotulo="Data da próxima ação" className="md:col-span-1">
        <input name="proxima_acao_data" type="date" defaultValue={n.proxima_acao_data ?? ""} className={inputCls} />
      </Campo>
    </>
  );
}
