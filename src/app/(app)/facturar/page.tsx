import type { Metadata } from "next";

import { EnConstruccion } from "@/components/app/en-construccion";

export const metadata: Metadata = { title: "Para facturar · Consultorio" };

export default function Pagina() {
  return <EnConstruccion titulo="Para facturar" tarea="B7" />;
}
