import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Configuración · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Configuración" tarea="B1" />;
}
