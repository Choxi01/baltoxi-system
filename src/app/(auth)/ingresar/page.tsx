import type { Metadata } from "next";

import { mensajeErrorIngreso } from "@/lib/auth/ingreso";
import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Ingresar · Consultorio" };

// El ?error= se lee acá, en el servidor: así el formulario viene armado en el
// HTML y el navegador puede autocompletar el email y la contraseña guardados.
export default async function PaginaIngresar({ searchParams }: PageProps<"/ingresar">) {
  const { error } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
        <p className="text-sm text-muted-foreground">Con tu email y contraseña.</p>
      </div>
      <FormularioIngreso error={mensajeErrorIngreso(typeof error === "string" ? error : null)} />
    </div>
  );
}
