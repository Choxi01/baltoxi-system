import type { Metadata } from "next";
import { connection } from "next/server";

import { rangoParaCargar, type Vista } from "@/lib/agenda/calendario";
import {
  agendar,
  cancelarGrupo,
  cancelarTurno,
  crearSerie,
  finalizarSerie,
  finalizarSeriesDelGrupo,
  libresDelDia,
  marcarAsistencia,
  montoSiSeCobra,
  moverGrupo,
  moverTurno,
  quitarTurno,
} from "@/lib/agenda/acciones-turnos";
import { listarParaReponer, listarTurnosConCobro, obtenerDatosParaReservar, obtenerHorario, obtenerPlantillaLibres } from "@/lib/agenda/datos";
import { materializarSeries } from "@/lib/agenda/series-servidor";
import { registrarPago } from "@/lib/cobro/acciones-pagos";
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

// Agenda (A2b + A3a reservar + A3b mover, cancelar y reponer + A3c turnos fijos + B3 asistencia + A4 copiar libres).
export default async function Pagina({ searchParams }: PageProps<"/agenda">) {
  const parametros = await searchParams;
  // "Hoy" se calcula en cada visita, no al compilar. `await searchParams` no alcanza:
  // con la navegación instantánea, Next puede preparar la página de antemano.
  await connection();
  const hoy = hoyEnAsuncion();
  const fecha = fechaValida(parametros.fecha) ?? hoy;
  const vista = VISTAS.find((v) => v === parametros.vista) ?? null;

  // Se trae del mes anterior al siguiente: moverse por la agenda no vuelve a pedir datos.
  const rango = rangoParaCargar(fecha);
  // Todo a la vez (cada espera de más se nota en el iPhone). Solo los turnos esperan a
  // que estén creados los de los turnos fijos (próximas 8 semanas, una vez por día).
  const [{ duracion, tramos, bloqueos }, turnos, paraReservar, paraReponer, plantillaLibres] = await Promise.all([
    obtenerHorario(),
    materializarSeries(hoy).then(() => listarTurnosConCobro(rango.desde, rango.hasta)),
    obtenerDatosParaReservar(),
    listarParaReponer(hoy),
    obtenerPlantillaLibres(),
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
        plantillaLibres={plantillaLibres}
        datosPanel={{
          ...paraReservar,
          hoy,
          agendar,
          acciones: { libresDelDia, moverTurno, montoSiSeCobra, cancelarTurno, quitarTurno, marcarAsistencia, crearSerie, finalizarSerie, registrarPago },
          sesion: { moverGrupo, cancelarGrupo, finalizarSeriesDelGrupo },
        }}
      />
    </div>
  );
}
