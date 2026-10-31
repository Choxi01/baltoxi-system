"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { horaCorta } from "@/lib/agenda/bloques";
import type { TurnoAgenda } from "@/lib/agenda/turnos";
import { AccionesTurno, FormularioTurno, useAccionesTurno, type AccionTarjeta } from "../agenda/acciones-de-turno";
import type { AccionesDeTurno } from "../agenda/acciones-turno";

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
  const turno = useAccionesTurno({ acciones, alGuardar: guardado });

  function guardado(texto: string) {
    turno.cerrar();
    setAviso(texto);
  }

  function alAccion(t: TurnoAgenda, accion: AccionTarjeta) {
    setUltimo(t.id);
    setAviso(null);
    turno.alAccion(t, accion);
  }

  if (turnos.length === 0) {
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
        {turnos.map((t) => (
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
                    alVolver={turno.cerrar}
                    alGuardar={guardado}
                  />
                </div>
              ) : (
                <AccionesTurno turno={t} hoy={hoy} ocupado={turno.guardando} alAccion={(a) => alAccion(t, a)} />
              )}
              {ultimo === t.id && turno.error && (
                <p role="alert" className="text-sm text-destructive">
                  {turno.error}
                </p>
              )}
              {ultimo === t.id && aviso && (
                <p role="status" className="text-sm text-muted-foreground">
                  {aviso}
                </p>
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
