import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Mensajes de hoy · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Mensajes de hoy" tarea="B5" />;
}
