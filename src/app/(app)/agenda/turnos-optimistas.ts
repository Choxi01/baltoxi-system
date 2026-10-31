"use client";

import { useOptimistic, useTransition } from "react";

import type { ResultadoSimple } from "@/lib/agenda/acciones-turnos";
import { aplicarCambio, type CambioOptimista } from "@/lib/agenda/optimista";
import type { TurnoAgenda } from "@/lib/agenda/turnos";
import type { MensajeListo } from "@/lib/mensajes/tipos";

/**
 * Guarda un cambio de un turno de forma optimista: la pantalla cambia al tocar y el
 * guardado sigue por detrás. `aviso` = lo que se muestra enseguida ("Vino ✓").
 */
export type Ejecutar = (cambio: CambioOptimista, accion: () => Promise<ResultadoSimple>, aviso: string) => void;

const SIN_CONEXION = "No se pudo guardar. Revisá la conexión.";

/**
 * Los turnos de la pantalla con los cambios que se están guardando (Agenda y Hoy).
 * Vive en la pantalla, no en el formulario: el formulario se cierra enseguida y la
 * respuesta del servidor (mensaje para la familia o error) igual llega.
 * Si el servidor dice que no, los turnos vuelven solos a como estaban (useOptimistic).
 */
export function useTurnosOptimistas(
  turnos: TurnoAgenda[],
  al: {
    /** Enseguida al tocar: cerrar el formulario y mostrar el aviso. */
    enviar: (aviso: string) => void;
    /** El servidor guardó y dejó un aviso distinto (ej. "Movido ✓ pero…"). */
    aviso: (aviso: string) => void;
    /** Después de mover o cancelar: el WhatsApp para la familia (B5). */
    mensaje: (mensaje: MensajeListo) => void;
    /** El servidor no pudo: los turnos ya volvieron a como estaban. */
    error: (error: string) => void;
  },
) {
  const [vista, aplicar] = useOptimistic(turnos, aplicarCambio);
  const [, iniciar] = useTransition();

  const ejecutar: Ejecutar = (cambio, accion, aviso) => {
    al.enviar(aviso);
    iniciar(async () => {
      aplicar(cambio);
      let r: ResultadoSimple;
      try {
        r = await accion();
      } catch {
        r = { ok: false, error: SIN_CONEXION };
      }
      if (!r.ok) return al.error(`${r.error} Quedó como estaba.`);
      if (r.aviso) al.aviso(r.aviso);
      if (r.mensaje) al.mensaje(r.mensaje);
    });
  };

  return { turnos: vista, ejecutar };
}
