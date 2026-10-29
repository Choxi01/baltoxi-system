import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Pacientes · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Pacientes" tarea="A1" />;
}
