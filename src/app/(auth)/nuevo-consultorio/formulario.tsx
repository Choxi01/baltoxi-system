"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearConsultorio, type EstadoFormulario } from "@/lib/auth/acciones";
import { LARGO_MAXIMO_NOMBRE } from "@/lib/auth/consultorio";

const inicial: EstadoFormulario = { error: null };

export function FormularioConsultorio() {
  const [estado, accion, enviando] = useActionState(crearConsultorio, inicial);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="nombre">Nombre del consultorio</Label>
        <Input id="nombre" name="nombre" maxLength={LARGO_MAXIMO_NOMBRE} required autoFocus />
      </div>
      {estado.error && (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Creando…" : "Crear consultorio"}
      </Button>
    </form>
  );
}
