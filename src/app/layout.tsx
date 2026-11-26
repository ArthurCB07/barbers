import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "@/styles/globals.css";
import { getShop } from "@/server/shop";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display-serif", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShop().catch(() => null);
  const name = shop?.name ?? "Barberverse";
  return {
    title: { default: `${name} — Barbearia virtual 3D`, template: `%s · ${name}` },
    description: shop?.description || "Entre na nossa barbearia em 3D, conheça os profissionais e agende seu horário.",
  };
}

export const viewport: Viewport = { themeColor: "#0b0a09", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-dvh bg-ink text-cream">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
