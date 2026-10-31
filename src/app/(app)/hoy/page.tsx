import type { Metadata } from "next";
import { connection } from "next/server";

import {
  cancelarTurno,
  crearSerie,
  finalizarSerie,
  libresDelDia,
  marcarAsistencia,
  moverTurno,
  quitarTurno,
} from "@/lib/agenda/acciones-turnos";
import { tituloDia } from "@/lib/agenda/calendario";
import { listarTurnos, obtenerDatosParaReservar } from "@/lib/agenda/datos";
import { resumenHoy, textoResumenHoy } from "@/lib/agenda/hoy";
import { materializarSeries } from "@/lib/agenda/series-servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { ListaHoy } from "./lista-hoy";

export const metadata: Metadata = { title: "Hoy · Consultorio" };

// Hoy (B3b): los turnos del día, también los cancelados, con las mismas acciones que la agenda.
// Solo datos administrativos (regla de oro 7): nombre, tipo de turno, hora y estado.
export default async function Pagina() {
  // "Hoy" se calcula en cada visita, no al compilar (si no, Next 16 frena el build).
  await connection();
  const hoy = hoyEnAsuncion();
  // Igual que la Agenda: crear los turnos fijos que falten (después del login se entra acá).
  await materializarSeries(hoy);
  const [turnos, { horasAvisoMinimas }] = await Promise.all([listarTurnos(hoy, hoy), obtenerDatosParaReservar()]);
  const resumen = textoResumenHoy(resumenHoy(turnos));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hoy</h1>
        <p className="text-muted-foreground">
          {tituloDia(hoy)}
          {resumen && ` · ${resumen}`}
        </p>
      </div>
      <ListaHoy
        hoy={hoy}
        turnos={turnos}
        horasAvisoMinimas={horasAvisoMinimas}
        acciones={{ libresDelDia, moverTurno, cancelarTurno, quitarTurno, marcarAsistencia, crearSerie, finalizarSerie }}
      />
    </div>
  );
}
