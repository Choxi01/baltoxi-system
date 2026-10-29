import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Cobros · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Cobros" tarea="B4" />;
}
