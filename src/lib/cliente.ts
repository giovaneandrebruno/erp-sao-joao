/** Regras do cadastro de clientes: CPF/CNPJ, telefone, CEP e endereço. Tudo feito aqui, sem serviço de fora. */

/** Situação do cliente. "cliente" é o valor gravado para quem está ativo. */
export const SITUACOES = {
  lead: "Lead (ainda não comprou)",
  cliente: "Ativo (cliente comprando)",
  ocioso: "Ocioso (já comprou, mas está parado)",
  inativo: "Inativo (não compra mais)",
} as const;
export type Situacao = keyof typeof SITUACOES;
export const COR_SITUACAO = { lead: "blue", cliente: "green", ocioso: "amber", inativo: "stone" } as const;
export const ROTULO_CURTO_SITUACAO: Record<Situacao, string> = { lead: "Lead", cliente: "Ativo", ocioso: "Ocioso", inativo: "Inativo" };

export const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const digitos = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

export function cpfValido(v: string) {
  const d = digitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function cnpjValido(v: string) {
  const d = digitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((t, p, i) => t + Number(d[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Mensagem de erro do CPF/CNPJ, ou null se está certo (ou em branco). */
export function erroDocumento(v: string | null | undefined): string | null {
  const d = digitos(v);
  if (!d) return null;
  if (d.length === 11) return cpfValido(d) ? null : "Este CPF não é válido. Confira os números.";
  if (d.length === 14) return cnpjValido(d) ? null : "Este CNPJ não é válido. Confira os números.";
  return "O CPF tem 11 números e o CNPJ tem 14.";
}

export function formatarDocumento(v: string | null | undefined) {
  const d = digitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return String(v ?? "").trim();
}

export function formatarTelefone(v: string | null | undefined) {
  const d = digitos(v).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(v ?? "").trim();
}

export function formatarCEP(v: string | null | undefined) {
  const d = digitos(v);
  return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, "$1-$2") : String(v ?? "").trim();
}

export function erroEmail(v: string | null | undefined) {
  const t = String(v ?? "").trim();
  if (!t) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? null : "Este e-mail não parece certo.";
}

type ComEndereco = {
  endereco?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null;
  cidade?: string | null; uf?: string | null; cep?: string | null;
};

/** "Rua X, 123, apto 4 - Centro - Cidade/UF - CEP 00000-000" */
export function enderecoCompleto(c: ComEndereco | null | undefined) {
  if (!c) return "";
  const rua = [c.endereco, c.numero, c.complemento].filter(Boolean).join(", ");
  const cidade = c.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : c.uf ?? "";
  return [rua, c.bairro, cidade, c.cep ? `CEP ${formatarCEP(c.cep)}` : ""].filter(Boolean).join(" - ");
}

export function idade(nascimento: string | null | undefined) {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.slice(0, 10).split("-").map(Number);
  const hoje = new Date();
  let i = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) i--;
  return i >= 0 && i < 130 ? i : null;
}

type Qualificavel = ComEndereco & {
  nome?: string | null; tipo_pessoa?: string | null; cpf_cnpj?: string | null; rg?: string | null;
  estado_civil?: string | null; profissao?: string | null; telefone?: string | null; email?: string | null;
};

/** Qualificação do contratante para o contrato: nome, documento, estado civil, endereço e contato. */
export function qualificacaoCliente(c: Qualificavel | null | undefined) {
  if (!c) return "";
  const pj = c.tipo_pessoa === "juridica";
  const d = digitos(c.cpf_cnpj);
  const doc = c.cpf_cnpj ? `${d.length === 14 || pj ? "CNPJ" : d.length === 11 ? "CPF" : "CPF/CNPJ"} ${c.cpf_cnpj}` : "";
  const end = enderecoCompleto(c);
  return [
    c.nome,
    pj ? "" : c.estado_civil?.toLowerCase(),
    pj ? "" : c.profissao,
    doc,
    !pj && c.rg ? `RG ${c.rg}` : "",
    end ? `${pj ? "com sede em" : "residente em"} ${end}` : "",
    c.telefone ? `telefone ${c.telefone}` : "",
    c.email ? `e-mail ${c.email}` : "",
  ].filter(Boolean).join(", ");
}
