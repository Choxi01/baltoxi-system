import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consultorio",
  description: "Agenda, expediente y cobros del consultorio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Respeta la "isla" y la barra de inicio del iPhone.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-PY" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
