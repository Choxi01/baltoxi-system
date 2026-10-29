import type { Metadata } from "next";

import { FormularioIngreso } from "./formulario";

export const metadata: Metadata = { title: "Ingresar · Consultorio" };

export default function PaginaIngresar() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Ingresar</h1>
        <p className="text-sm text-muted-foreground">Con tu email y contraseña.</p>
      </div>
      <FormularioIngreso />
    </div>
  );
}
