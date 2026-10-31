import type { Metadata } from "next";

import { rangoParaCargar, type Vista } from "@/lib/agenda/calendario";
import { agendar, cancelarTurno, libresDelDia, moverTurno, quitarTurno } from "@/lib/agenda/acciones-turnos";
import { listarParaReponer, listarTurnos, obtenerDatosParaReservar, obtenerHorario } from "@/lib/agenda/datos";
import { hoyEnAsuncion } from "@/lib/fechas";
import { armarFecha, partirFecha } from "@/lib/pacientes/fecha";
import { Agenda } from "./agenda";

export const metadata: Metadata = { title: "Agenda · Consultorio" };

const VISTAS: Vista[] = ["dia", "semana", "mes"];

/** Una fecha "AAAA-MM-DD" que exista, o null. */
function fechaValida(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const p = partirFecha(valor);
  const r = armarFecha(p.dia, p.mes, p.anio);
  return r.ok ? r.fecha : null;
}

// Agenda (A2b + A3a reservar + A3b mover, cancelar y reponer). Turnos fijos: A3c.
export default async function Pagina({ searchParams }: PageProps<"/agenda">) {
  const parametros = await searchParams;
  const { duracion, tramos, bloqueos } = await obtenerHorario();
  const hoy = hoyEnAsuncion();
  const fecha = fechaValida(parametros.fecha) ?? hoy;
  const vista = VISTAS.find((v) => v === parametros.vista) ?? null;

  // Se trae del mes anterior al siguiente: moverse por la agenda no vuelve a pedir datos.
  const rango = rangoParaCargar(fecha);
  const [turnos, paraReservar, paraReponer] = await Promise.all([
    listarTurnos(rango.desde, rango.hasta),
    obtenerDatosParaReservar(),
    listarParaReponer(hoy),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
      <Agenda
        hoy={hoy}
        fechaInicial={fecha}
        vistaInicial={vista}
        rango={rango}
        duracion={duracion}
        tramos={tramos}
        bloqueos={bloqueos}
        turnos={turnos}
        paraReponer={paraReponer}
        datosPanel={{ ...paraReservar, hoy, agendar, acciones: { libresDelDia, moverTurno, cancelarTurno, quitarTurno } }}
      />
    </div>
  );
}
