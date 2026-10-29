import type { Metadata } from "next";

import { FormularioConsultorio } from "./formulario";

export const metadata: Metadata = { title: "Nuevo consultorio · Consultorio" };

export default function PaginaNuevoConsultorio() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">¡Te damos la bienvenida!</h1>
        <p className="text-sm text-muted-foreground">
          Para empezar, poné el nombre de tu consultorio. Así aparece en los mensajes a las
          familias y lo podés cambiar después.
        </p>
      </div>
      <FormularioConsultorio />
    </div>
  );
}
