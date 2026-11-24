export type Papel = "admin" | "vendedor" | "montador";

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Administrador",
  vendedor: "Escritório / vendas",
  montador: "Montador (sem acesso ao sistema)",
};

/** Telas que só o administrador abre. */
export const SO_ADMIN = ["/financeiro", "/comissoes", "/configuracoes", "/equipe", "/relatorios", "/analises", "/historico", "/redes", "/funcionarios", "/reunioes"];

/** Telas abertas ao montador. */
export const DO_MONTADOR = ["/conta"];

export function podeAbrir(papel: Papel | null | undefined, caminho: string) {
  if (!papel) return false;
  if (papel === "admin") return true;
  const dentro = (lista: string[]) => lista.some((r) => caminho === r || caminho.startsWith(`${r}/`));
  if (papel === "montador") return dentro(DO_MONTADOR);
  return !dentro(SO_ADMIN);
}

export function inicioDo(papel: Papel | null | undefined) {
  return papel === "montador" ? "/conta" : "/";
}
