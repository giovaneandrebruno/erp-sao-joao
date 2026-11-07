import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veio · São João Móveis",
  description: "Gestão de móveis planejados da São João Móveis",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-areia text-stone-800">{children}</body>
    </html>
  );
}
