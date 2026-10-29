import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { crearPaciente } from "@/lib/pacientes/acciones";
import { listarTarifas } from "@/lib/pacientes/datos";
import { FormularioPaciente } from "../formulario-paciente";

export const metadata: Metadata = { title: "Nuevo paciente · Consultorio" };

export default async function PaginaNuevoPaciente() {
  const tarifas = await listarTarifas();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/pacientes" className="flex h-10 items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Pacientes
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo paciente</h1>
      <p className="text-sm text-muted-foreground">Después de guardarlo vas a poder agregar sus tutores.</p>
      <FormularioPaciente accion={crearPaciente} tarifas={tarifas} textoBoton="Crear paciente" />
    </div>
  );
}
