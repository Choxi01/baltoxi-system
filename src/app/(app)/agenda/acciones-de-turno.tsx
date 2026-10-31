"use client";

import { ArrowRightLeft, Ban, Banknote, Check, ExternalLink, Percent, Repeat, Trash2, Undo2, UserPlus, UserX, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { FormularioPago } from "@/components/app/formulario-pago";
import { Button } from "@/components/ui/button";
import { accionesDelTurno, type AccionAsistencia, type AccionTurno } from "@/lib/agenda/asistencia";
import { horaCorta } from "@/lib/agenda/bloques";
import { tituloDia } from "@/lib/agenda/calendario";
import { formatoGs } from "@/lib/cobro/formato";
import { NOMBRE_ESTADO_TURNO, textoEstado, textoTurno, type TurnoAgenda } from "@/lib/agenda/turnos";
import type { MensajeListo } from "@/lib/mensajes/tipos";
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

/** Lo que se puede tocar en la tarjeta: las acciones del turno y "Cobrar ahora" (B4). */
export type AccionTarjeta = AccionTurno | "cobrar";

/** Un turno con sus acciones (agenda y pantalla Hoy). */
export function AccionesTurno({
  turno,
  hoy,
  ocupado,
  alAccion,
  alFinalizarSerie,
}: {
  turno: TurnoAgenda;
  hoy: string;
  ocupado: boolean;
  alAccion: (accion: AccionTarjeta) => void;
  /** Si viene, un turno fijo muestra "Finalizar turno fijo" (en la agenda sí, en Hoy no). */
  alFinalizarSerie?: () => void;
}) {
  const acciones = accionesDelTurno(turno, hoy);
  const estado = textoEstado(turno);
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-2">
      <div className="px-1">
        <p className="text-sm font-medium">{textoTurno(turno)}</p>
        {estado && <p className="text-sm text-muted-foreground">{estado}</p>}
        {turno.serieId && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Repeat className="size-3" /> Turno fijo: {tituloDia(turno.fecha).split(" ")[0].toLowerCase()} {horaCorta(turno.inicio)}
          </p>
        )}
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
      {turno.cobro && (
        <Button className="h-12" onClick={() => alAccion("cobrar")} disabled={ocupado}>
          <Banknote /> Cobrar ahora · {formatoGs(turno.cobro.pendiente)}
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
      {turno.serieId && alFinalizarSerie && (
        <Button variant="ghost" className="h-12 text-destructive" onClick={alFinalizarSerie} disabled={ocupado}>
          Finalizar turno fijo
        </Button>
      )}
    </div>
  );
}

/** Un turno con un formulario abierto (Mover, Cancelar, Excepción o Cobrar ahora). */
export type TurnoAbierto = { accion: "mover" | "cancelar" | "excepcion" | "cobrar"; turno: TurnoAgenda };

const LISTO: Record<Exclude<AccionAsistencia, "excepcion">, string> = {
  vino: "Vino ✓",
  no_vino: "No vino ✓",
  agendado: "Volvió a agendado ✓",
  quitar_excepcion: "Excepción quitada ✓",
};

/**
 * Qué pasa al tocar un botón de AccionesTurno (lo usan la agenda y Hoy):
 * Mover / Cancelar / Excepción / Cobrar ahora abren su formulario; Vino, No vino, Volver a agendado,
 * Quitar excepción y Quitar se guardan directo.
 */
export function useAccionesTurno({ acciones, alGuardar }: { acciones: AccionesDeTurno; alGuardar: (aviso: string, mensaje?: MensajeListo) => void }) {
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

  function alAccion(t: TurnoAgenda, accion: AccionTarjeta) {
    setError(null);
    if (accion === "mover" || accion === "cancelar" || accion === "excepcion" || accion === "cobrar") setAbierto({ accion, turno: t });
    else if (accion === "quitar") quitar(t);
    else marcar(t, accion);
  }

  /** Turno fijo (A3c): la serie termina y se borran sus turnos futuros agendados. */
  function finalizarSerie(t: TurnoAgenda) {
    if (!t.serieId) return;
    const dia = tituloDia(t.fecha).split(" ")[0].toLowerCase();
    if (!window.confirm(`¿Finalizar el turno fijo de ${t.titulo} (${dia} ${horaCorta(t.inicio)})? Se borran sus turnos futuros agendados; los pasados quedan.`)) return;
    setError(null);
    iniciar(async () => {
      const r = await acciones.finalizarSerie(t.serieId!);
      if (r.ok) alGuardar("Turno fijo finalizado ✓");
      else setError(r.error);
    });
  }

  return { abierto, cerrar: () => setAbierto(null), error, guardando, alAccion, finalizarSerie };
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
  alGuardar: (aviso: string, mensaje?: MensajeListo) => void;
}) {
  const { accion, turno } = abierto;
  if (accion === "cobrar") {
    if (!turno.cobro) return null;
    return (
      <FormularioPago
        hoy={hoy}
        titulo={`Cobrar ahora: ${turno.titulo}${turno.tipo ? ` · ${turno.tipo}` : ""}`}
        tutor={{ id: turno.cobro.tutorId, nombre: turno.cobro.tutorNombre }}
        montoInicial={turno.cobro.pendiente}
        deudaAnterior={turno.cobro.deudaAnterior}
        registrarPago={acciones.registrarPago}
        alVolver={alVolver}
        alGuardar={alGuardar}
      />
    );
  }
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
