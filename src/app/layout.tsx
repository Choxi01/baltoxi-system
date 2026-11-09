import type { Metadata, Viewport } from "next";
import { Newsreader, Public_Sans } from "next/font/google";

import { TEMA } from "@/lib/tema";
import { cn } from "@/lib/utils";
import "./globals.css";

// Fuentes del tema «sereno»: Newsreader (títulos, serif) y Public Sans (texto).
// Se descargan al compilar y se sirven desde la propia app (no dependen de Google al usarla).
// Con TEMA = "basico" no se usan y la app queda con la fuente del sistema.
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-newsreader" });
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" });

export const metadata: Metadata = {
  title: "Consultorio",
  description: "Agenda, expediente y cobros del consultorio",
  // iPhone y iPad: al agregarla a la pantalla de inicio abre sin la barra de Safari.
  appleWebApp: { capable: true, title: "Consultorio", statusBarStyle: "default" },
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
    // data-tema activa (o no) los colores de src/app/tema-sereno.css. Se elige en src/lib/tema.ts.
    <html
      lang="es-PY"
      data-tema={TEMA}
      className={cn("h-full antialiased", TEMA === "sereno" && [newsreader.variable, publicSans.variable])}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
