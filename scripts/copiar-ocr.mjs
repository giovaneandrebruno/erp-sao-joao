// Copia para public/ocr os arquivos que a leitura de PDF e de fotos usa no navegador.
// Tudo roda no próprio computador de quem envia o arquivo: nenhum serviço de fora é chamado.
import fs from "node:fs";
import path from "node:path";

const destino = path.join("public", "ocr");
fs.mkdirSync(destino, { recursive: true });
const copiar = (de, nome = path.basename(de)) => fs.copyFileSync(de, path.join(destino, nome));

copiar("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
copiar("node_modules/tesseract.js/dist/worker.min.js", "tesseract.worker.min.js");
for (const f of fs.readdirSync("node_modules/tesseract.js-core")) {
  if (/-lstm\.wasm\.js$/.test(f)) copiar(path.join("node_modules/tesseract.js-core", f));
}
copiar("node_modules/@tesseract.js-data/por/4.0.0/por.traineddata.gz");
console.log("Arquivos de leitura de documentos copiados para", destino);
