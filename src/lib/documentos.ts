/** Tipos de documento da pasta do cliente. A ordem é a que aparece na lista de escolha. */
export const TIPOS_DOCUMENTO = {
  pedido_fechado: "Pedido fechado (assinado)",
  memorial_descritivo: "Memorial descritivo",
  briefing: "Briefing / ficha do cliente",
  contrato: "Contrato",
  projeto: "Projeto / planta / render",
  medidas: "Medidas da obra",
  comprovante: "Comprovante de pagamento",
  foto: "Foto",
  outro: "Outro",
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

/** Documentos que todo cliente fechado deveria ter na pasta. */
export const DOCUMENTOS_ESSENCIAIS: TipoDocumento[] = ["pedido_fechado", "memorial_descritivo", "contrato"];

export const BUCKET_DOCUMENTOS = "documentos";
export const LIMITE_DOCUMENTO = 50 * 1024 * 1024;

export function ehTipoDocumento(v: unknown): v is TipoDocumento {
  return typeof v === "string" && Object.hasOwn(TIPOS_DOCUMENTO, v);
}

/** Pasta de cada cliente dentro do Storage. */
export const pastaDoCliente = (clienteId: string) => `clientes/${clienteId}/`;

/** Nome seguro para o caminho no Storage (sem acentos, espaços ou símbolos). */
export function caminhoNovo(clienteId: string, nomeArquivo: string) {
  const limpo = nomeArquivo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "arquivo";
  const aleatorio = Math.random().toString(36).slice(2, 8);
  return `${pastaDoCliente(clienteId)}${Date.now()}-${aleatorio}-${limpo}`;
}

export function tamanhoLegivel(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
