import type { Icone as NomeIcone } from "@/lib/navegacao";

/** Ícones de traço fino (24×24), desenhados aqui mesmo para não depender de biblioteca. */
const CAMINHOS: Record<NomeIcone | "busca" | "seta" | "mais" | "fechar" | "sair" | "chave" | "raio" | "documento" | "pasta" | "caixa" | "pessoa" | "enter" | "menu" | "sino" | "lapis" | "lixeira" | "certo" | "alerta", string> = {
  painel: "M4 4h6v7H4zM14 4h6v4h-6zM14 12h6v8h-6zM4 15h6v5H4z",
  vendas: "M3 4h18l-7 8v6l-4 2v-8z",
  clientes: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.5 3.5 0 0 1 0 6.7",
  pedidos: "M9 4h6v3H9zM7 5.5H5.5A1.5 1.5 0 0 0 4 7v12.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H17M8.5 12h7M8.5 16h5",
  producao: "M3 21V10l5 3V10l5 3V7l8 4v10zM7 17h2M12 17h2M17 17h1",
  estoque: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  compras: "M3 4h2.5l2.2 11h10.6L20.5 8H7M9.5 19.5a1 1 0 1 0 0 .01M17 19.5a1 1 0 1 0 0 .01",
  financeiro: "M3 21h18M5 21V10M19 21V10M9.5 21v-7M14.5 21v-7M2.5 10 12 4l9.5 6z",
  analises: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
  equipe: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4",
  configuracoes: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  agenda: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 10h16M8 3v4M16 3v4",
  curriculos: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M12 11.5a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5M8.5 16.5a3.5 3.5 0 0 1 7 0",
  organograma: "M9.5 3.5h5v4h-5zM3.5 16.5h5v4h-5zM9.5 16.5h5v4h-5zM15.5 16.5h5v4h-5zM12 7.5v4.5M6 16.5V12h12v4.5M12 12v4.5",
  melhorias: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3",
  historico: "M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  redes: "M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 7v.01",
  funcionarios: "M9 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0M4 21v-1a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1M12 15v3M10.5 18h3",
  comissoes: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.2-4.5 3 1.7 2.6 4.5 3.2 4.5 1.5 4.5 3.3-2 3-4.5 3-4.5-1.3-4.5-3",
  importar: "M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  busca: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4",
  seta: "M9 6l6 6-6 6",
  mais: "M12 5v14M5 12h14",
  fechar: "M6 6l12 12M18 6 6 18",
  sair: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  chave: "M15 9a3 3 0 1 0-3 3M12 12l-8 8M7 17l2 2M5 19l1.5 1.5M15 3a6 6 0 1 1-5.2 9",
  raio: "M13 3 5 13h6l-1 8 8-10h-6z",
  documento: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  pasta: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  caixa: "M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  pessoa: "M18 20v-1a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  enter: "M20 5v7a3 3 0 0 1-3 3H6M10 11l-4 4 4 4",
  menu: "M4 7h16M4 12h16M4 17h16",
  lapis: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  lixeira: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  certo: "M5 12.5l4.5 4.5L19 7",
  alerta: "M12 4 2.5 20h19zM12 10v4.5M12 17.5v.01",
  sino: "M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0",
};

export type NomeDoIcone = keyof typeof CAMINHOS;

export function Icone({ nome, className = "h-[18px] w-[18px]" }: { nome: NomeDoIcone; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
