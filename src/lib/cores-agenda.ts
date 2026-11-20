/** Cores que o administrador pode escolher para cada agenda do Google. */
export const CORES_AGENDA = [
  { cor: "#2563eb", nome: "Azul" },
  { cor: "#16a34a", nome: "Verde" },
  { cor: "#7c3aed", nome: "Roxo" },
  { cor: "#db2777", nome: "Rosa" },
  { cor: "#dc2626", nome: "Vermelho" },
  { cor: "#ca8a04", nome: "Amarelo" },
  { cor: "#0891b2", nome: "Turquesa" },
  { cor: "#92400e", nome: "Marrom" },
  { cor: "#525252", nome: "Cinza" },
] as const;

export const corValida = (c: unknown) => (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null);
