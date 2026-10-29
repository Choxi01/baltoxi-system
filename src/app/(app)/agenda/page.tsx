import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Agenda · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Agenda" tarea="A2" />;
}
