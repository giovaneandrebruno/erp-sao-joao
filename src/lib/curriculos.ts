/** Currículos: os arquivos ficam na pasta privada "documentos" do Storage, em curriculos/<id>/. */
export { BUCKET_DOCUMENTOS as BUCKET_CURRICULOS, LIMITE_DOCUMENTO as LIMITE_CURRICULO, tamanhoLegivel } from "@/lib/documentos";

export const pastaDoCurriculo = (id: string) => `curriculos/${id}/`;

/** Nome seguro para o caminho no Storage (sem acentos, espaços ou símbolos). */
export function caminhoDoCurriculo(id: string, nomeArquivo: string) {
  const limpo = nomeArquivo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "curriculo";
  return `${pastaDoCurriculo(id)}${Date.now()}-${limpo}`;
}

export function ehUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** "hoje", "ontem", "há 5 dias", "há 2 meses", "há 1 ano": para saber se o currículo é recente. */
export function haQuantoTempo(valor: string, agora = new Date()) {
  const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const dias = Math.round((Date.parse(dia(agora)) - Date.parse(dia(new Date(valor)))) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
  const anos = Math.floor(dias / 365);
  return anos <= 1 ? "há 1 ano" : `há ${anos} anos`;
}

/** Cor do selo da data: verde até 30 dias, amarelo até 6 meses, cinza depois disso. */
export function corDaIdade(valor: string, agora = new Date()): "green" | "amber" | "stone" {
  const dias = (agora.getTime() - new Date(valor).getTime()) / 86_400_000;
  return dias <= 30 ? "green" : dias <= 180 ? "amber" : "stone";
}

/** Como mostrar o arquivo na tela: PDF e imagem abrem ali mesmo; o resto só por "Abrir". */
export function tipoDeVisualizacao(nome: string, tipo: string | null): "pdf" | "imagem" | "outro" {
  const n = nome.toLowerCase();
  if (tipo === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (tipo?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(n)) return "imagem";
  return "outro";
}
