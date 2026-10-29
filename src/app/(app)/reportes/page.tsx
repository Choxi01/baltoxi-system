import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Reportes · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Reportes" tarea="B8" />;
}
