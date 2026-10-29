import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Hoy · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Hoy" tarea="B3" />;
}
