import type { Metadata } from "next";
import { connection } from "next/server";

import { sumarDias, tituloDia } from "@/lib/agenda/calendario";
import { hoyEnAsuncion } from "@/lib/fechas";
import { obtenerDatosPendientes } from "@/lib/mensajes/datos";
import { pendientesDelDia } from "@/lib/mensajes/pendientes";
import { textoDiaMensaje } from "@/lib/mensajes/plantillas";
import { Bandeja } from "./bandeja";

export const metadata: Metadata = { title: "Mensajes de hoy · Consultorio" };

// Mensajes de hoy (B5): recordatorios del próximo día de atención, montos del período y pagos atrasados.
// Solo datos administrativos (regla de oro 7).
export default async function Pagina() {
  // "Hoy" se calcula en cada visita, no al compilar.
  await connection();
  const hoy = hoyEnAsuncion();
  const pendientes = pendientesDelDia(hoy, await obtenerDatosPendientes(hoy));
  const dia = pendientes.proximoDia;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mensajes de hoy</h1>
        <p className="text-muted-foreground">{tituloDia(hoy)}</p>
      </div>
      <Bandeja
        grupos={[
          {
            id: "recordatorios",
            titulo: !dia
              ? "Recordatorios"
              : dia === sumarDias(hoy, 1)
                ? "Recordatorios de mañana"
                : `Recordatorios del ${textoDiaMensaje(dia)}`,
            filas: pendientes.recordatorios,
          },
          { id: "montos", titulo: "Montos de hoy", filas: pendientes.montos },
          { id: "pagos", titulo: "Pagos atrasados", filas: pendientes.pagos },
        ]}
      />
    </div>
  );
}
