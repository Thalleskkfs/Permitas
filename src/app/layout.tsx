import type { Metadata } from "next";
import { Geist, Jost } from "next/font/google";
import "@/styles/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Família de exibição, só para títulos. Geométrica e de traço fino no peso leve: faz
// par com a linha delicada do logo sem imitar a caligrafia dele. Provisória até a marca
// informar as fontes oficiais.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

// Base para resolver as URLs absolutas dos metadados (Open Graph). Sem ela, o cartão
// de prévia que o WhatsApp monta a partir de um link de produto não tem como apontar
// para a página nem para a imagem. Ausente em desenvolvimento, e tudo bem: a prévia só
// existe com o site publicado, porque quem a gera é o aparelho de quem envia o link.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "catalogo-saas",
  description: "Plataforma de catálogo de produtos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
