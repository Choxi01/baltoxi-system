import type { MetadataRoute } from "next";

import { TEMA } from "@/lib/tema";

// Lo que lee el sistema al instalar la app. Sin modo offline: sin internet no abre.
export default function manifest(): MetadataRoute.Manifest {
  const fondo = TEMA === "sereno" ? "#f7f5ef" : "#ffffff";
  return {
    name: "Consultorio",
    short_name: "Consultorio",
    description: "Agenda, expediente y cobros del consultorio",
    lang: "es-PY",
    start_url: "/hoy",
    display: "standalone",
    background_color: fondo,
    theme_color: fondo,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
