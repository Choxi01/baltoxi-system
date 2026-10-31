"use client";

import { ArrowRightLeft, Ban, Check, ExternalLink, Percent, Trash2, Undo2, UserPlus, UserX, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { accionesDelTurno, type AccionAsistencia, type AccionTurno } from "@/lib/agenda/asistencia";
import { NOMBRE_ESTADO_TURNO, textoEstado, textoTurno, type TurnoAgenda } from "@/lib/agenda/turnos";
import { cn } from "@/lib/utils";
import { FormularioCancelar, FormularioExcepcion, FormularioMover, type AccionesDeTurno } from "./acciones-turno";

const BOTONES: Record<AccionTurno, { texto: string; icono: LucideIcon; peligro?: boolean }> = {
  vino: { texto: NOMBRE_ESTADO_TURNO.presente, icono: Check },
  no_vino: { texto: NOMBRE_ESTADO_TURNO.ausente_sin_aviso, icono: UserX },
  agendado: { texto: "Volver a agendado", icono: Undo2 },
  excepcion: { texto: "Excepción", icono: Percent },
  quitar_excepcion: { texto: "Quitar excepción", icono: X },
  mover: { texto: "Mover", icono: ArrowRightLeft },
  cancelar: { texto: "Cancelar", icono: Ban, peligro: true },
  quitar: { texto: "Quitar", icono: Trash2, peligro: true },
};

/** Un turno con sus acciones (agenda y, en la B3b, la pantalla Hoy). */
export function AccionesTurno({
  turno,
  hoy,
  ocupado,
  alAccion,
}: {
  turno: TurnoAgenda;
  hoy: string;
  ocupado: boolean;
  alAccion: (accion: AccionTurno) => void;
}) {
  const acciones = accionesDelTurno(turno, hoy);
  const estado = textoEstado(turno);
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-2">
      <div className="px-1">
        <p className="text-sm font-medium">{textoTurno(turno)}</p>
        {estado && <p className="text-sm text-muted-foreground">{estado}</p>}
      </div>
      {turno.clase === "turno" && turno.pacienteId && (
        <Button asChild variant="outline" className="h-12 justify-start">
          <Link href={`/pacientes/${turno.pacienteId}`}>
            <ExternalLink /> Ver expediente
          </Link>
        </Button>
      )}
      {turno.clase === "reservado" && turno.estado === "agendado" && (
        <Button asChild variant="outline" className="h-12 justify-start">
          <Link href={`/pacientes/nuevo?reserva=${turno.id}`}>
            <UserPlus /> Crear ficha
          </Link>
        </Button>
      )}
      {acciones.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {acciones.map((a) => {
            const { texto, icono: Icono, peligro } = BOTONES[a];
            return (
              <Button
                key={a}
                variant="outline"
                className={cn("h-12", peligro && "text-destructive")}
                onClick={() => alAccion(a)}
                disabled={ocupado}
              >
                <Icono /> {a === "excepcion" && turno.porcentajeManual != null ? "Cambiar excepción" : texto}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Un turno con un formulario abierto (Mover, Cancelar o Excepción). */
export type TurnoAbierto = { accion: "mover" | "cancelar" | "excepcion"; turno: TurnoAgenda };

const LISTO: Record<Exclude<AccionAsistencia, "excepcion">, string> = {
  vino: "Vino ✓",
  no_vino: "No vino ✓",
  agendado: "Volvió a agendado ✓",
  quitar_excepcion: "Excepción quitada ✓",
};

/**
 * Qué pasa al tocar un botón de AccionesTurno (lo usan la agenda y Hoy):
 * Mover / Cancelar / Excepción abren su formulario; Vino, No vino, Volver a agendado,
 * Quitar excepción y Quitar se guardan directo.
 */
export function useAccionesTurno({ acciones, alGuardar }: { acciones: AccionesDeTurno; alGuardar: (aviso: string) => void }) {
  const [abierto, setAbierto] = useState<TurnoAbierto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function quitar(t: TurnoAgenda) {
    if (!window.confirm(`¿Quitar «${textoTurno(t)}»? El horario queda libre.`)) return;
    setError(null);
    iniciar(async () => {
      const r = await acciones.quitarTurno(t.id);
      if (r.ok) alGuardar("Quitado ✓");
      else setError(r.error);
    });
  }

  function marcar(t: TurnoAgenda, accion: Exclude<AccionAsistencia, "excepcion">) {
    if (accion === "agendado" && !window.confirm(`¿Volver «${textoTurno(t)}» a agendado? Se borra su cobro.`)) return;
    setError(null);
    iniciar(async () => {
      const r = await acciones.marcarAsistencia(t.id, accion);
      if (r.ok) alGuardar(LISTO[accion]);
      else setError(r.error);
    });
  }

  function alAccion(t: TurnoAgenda, accion: AccionTurno) {
    setError(null);
    if (accion === "mover" || accion === "cancelar" || accion === "excepcion") setAbierto({ accion, turno: t });
    else if (accion === "quitar") quitar(t);
    else marcar(t, accion);
  }

  return { abierto, cerrar: () => setAbierto(null), error, guardando, alAccion };
}

/** El formulario del turno abierto. */
export function FormularioTurno({
  abierto,
  hoy,
  horasAvisoMinimas,
  acciones,
  alVolver,
  alGuardar,
}: {
  abierto: TurnoAbierto;
  hoy: string;
  horasAvisoMinimas: number;
  acciones: AccionesDeTurno;
  alVolver: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const { accion, turno } = abierto;
  if (accion === "mover") return <FormularioMover turno={turno} hoy={hoy} acciones={acciones} alVolver={alVolver} alGuardar={alGuardar} />;
  if (accion === "cancelar") {
    return (
      <FormularioCancelar
        turno={turno}
        hoy={hoy}
        horasAvisoMinimas={horasAvisoMinimas}
        acciones={acciones}
        alVolver={alVolver}
        alGuardar={alGuardar}
      />
    );
  }
  return <FormularioExcepcion turno={turno} acciones={acciones} alVolver={alVolver} alGuardar={alGuardar} />;
}
