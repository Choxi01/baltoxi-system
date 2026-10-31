"use client";

import { ArrowRightLeft, Ban, Check, ExternalLink, Percent, Trash2, Undo2, UserPlus, UserX, X, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { accionesDelTurno, type AccionTurno } from "@/lib/agenda/asistencia";
import { NOMBRE_ESTADO_TURNO, textoEstado, textoTurno, type TurnoAgenda } from "@/lib/agenda/turnos";
import { cn } from "@/lib/utils";

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
