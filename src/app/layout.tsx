import type { Metadata, Viewport } from "next";
import { Newsreader, Public_Sans } from "next/font/google";

import { TEMA } from "@/lib/tema";
import { cn } from "@/lib/utils";
import "./globals.css";

// Fuentes del tema «sereno» (se descargan al compilar y se sirven desde la propia app).
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-newsreader" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });

export const metadata: Metadata = {
  title: "Consultorio",
  description: "Agenda, expediente y cobros del consultorio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Respeta la "isla" y la barra de inicio del iPhone.
  viewportFit: "cover",
  // Color de la barra del navegador en el iPhone.
  themeColor: TEMA === "sereno" ? "#f7f5ef" : "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-PY"
      data-tema={TEMA}
      className={cn("h-full antialiased", TEMA === "sereno" && [newsreader.variable, publicSans.variable])}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
