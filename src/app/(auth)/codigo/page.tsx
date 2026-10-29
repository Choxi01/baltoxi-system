import type { Metadata } from "next";

import { FormularioCodigo } from "./formulario";

export const metadata: Metadata = { title: "Código · Consultorio" };

export default function PaginaCodigo() {
  return <FormularioCodigo />;
}
