import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERP São João",
  description: "Gestão da marcenaria e da loja São João Móveis",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-stone-100 text-stone-800">{children}</body>
    </html>
  );
}
