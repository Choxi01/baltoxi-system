"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MensajeFamilia } from "@/components/app/mensaje-familia";
import { Button } from "@/components/ui/button";
import { horaCorta } from "@/lib/agenda/bloques";
import type { TurnoAgenda } from "@/lib/agenda/turnos";
import type { MensajeListo } from "@/lib/mensajes/tipos";
import { AccionesTurno, FormularioTurno, useAccionesTurno, type AccionTarjeta } from "../agenda/acciones-de-turno";
import type { AccionesDeTurno } from "../agenda/acciones-turno";
import { useTurnosOptimistas } from "../agenda/turnos-optimistas";

// Turnos de hoy con las mismas acciones que la agenda, siempre a mano (sin tener que abrir el bloque).
export function ListaHoy({
  hoy,
  turnos,
  horasAvisoMinimas,
  acciones,
}: {
  hoy: string;
  turnos: TurnoAgenda[];
  horasAvisoMinimas: number;
  acciones: AccionesDeTurno;
}) {
  // El último turno tocado: ahí se muestra el aviso ("Vino ✓") o el error, a la vista en el iPhone.
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Después de mover o cancelar: el WhatsApp para la familia.
  const [ofrecido, setOfrecido] = useState<MensajeListo | null>(null);
  // Si el servidor no pudo guardar un cambio (el turno ya volvió a como estaba).
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  // Lo que se ve: los turnos del servidor más los cambios que se están guardando.
  const optimista = useTurnosOptimistas(turnos, {
    // Se llama al tocar (no al dibujar), cuando `turno` ya existe: cierra el formulario abierto.
    enviar: (texto) => {
      turno.cerrar();
      setErrorAccion(null);
      setAviso(texto);
      setOfrecido(null);
    },
    aviso: setAviso,
    mensaje: setOfrecido,
    error: (texto) => {
      setAviso(null);
      setOfrecido(null);
      setErrorAccion(texto);
    },
  });
  const turno = useAccionesTurno({ acciones, ejecutar: optimista.ejecutar, alGuardar: guardado });
  // Al mover un turno a otro día, el nuevo no es de hoy.
  const deHoy = optimista.turnos.filter((t) => t.fecha === hoy);

  function guardado(texto: string, mensaje?: MensajeListo) {
    turno.cerrar();
    setAviso(texto);
    setOfrecido(mensaje ?? null);
  }

  function alAccion(t: TurnoAgenda, accion: AccionTarjeta) {
    setUltimo(t.id);
    setAviso(null);
    setOfrecido(null);
    setErrorAccion(null);
    turno.alAccion(t, accion);
  }

  if (deHoy.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed px-4 py-10 text-center">
        <p className="text-muted-foreground">No tenés turnos hoy</p>
        <Button asChild variant="outline" className="h-12">
          <Link href="/agenda">
            <CalendarDays /> Ir a la agenda
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {deHoy.map((t) => (
          <li key={t.id} className="flex gap-3">
            <span className="w-12 shrink-0 pt-3 text-right text-sm tabular-nums text-muted-foreground">{horaCorta(t.inicio)}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {turno.abierto?.turno.id === t.id ? (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <FormularioTurno
                    abierto={turno.abierto}
                    hoy={hoy}
                    horasAvisoMinimas={horasAvisoMinimas}
                    acciones={acciones}
                    ejecutar={optimista.ejecutar}
                    alVolver={turno.cerrar}
                    alGuardar={guardado}
                  />
                </div>
              ) : (
                <AccionesTurno turno={t} hoy={hoy} ocupado={turno.guardando} alAccion={(a) => alAccion(t, a)} />
              )}
              {ultimo === t.id && (turno.error || errorAccion) && (
                <p role="alert" className="text-sm text-destructive">
                  {turno.error ?? errorAccion}
                </p>
              )}
              {ultimo === t.id && aviso && (
                <p role="status" className="text-sm text-muted-foreground">
                  {aviso}
                </p>
              )}
              {ultimo === t.id && ofrecido && (
                <MensajeFamilia key={`${ofrecido.clave}-${ofrecido.referencia}`} mensaje={ofrecido} alCerrar={() => setOfrecido(null)} />
              )}
            </div>
          </li>
        ))}
      </ol>
      <Button asChild variant="outline" className="h-12">
        <Link href="/agenda">
          <CalendarDays /> Ver en la agenda
        </Link>
      </Button>
    </div>
  );
}
