// Mensaje de cambio o cancelación de un turno (se ofrece al mover o cancelar).
// Solo nombre de pila, día y hora (regla de oro 7).

import { horaCorta } from "@/lib/agenda/bloques";
import { nombrePila, rellenar, textoDiaMensaje } from "./plantillas";

export function textoMensajeTurno({
  plantilla,
  tutor,
  paciente,
  fecha,
  hora,
}: {
  plantilla: string;
  /** Nombres completos: se usa el de pila. */
  tutor: string;
  paciente: string;
  /** "AAAA-MM-DD" y "HH:MM" en Asunción. */
  fecha: string;
  hora: string;
}): string {
  return rellenar(plantilla, {
    tutor: nombrePila(tutor),
    paciente: nombrePila(paciente),
    dia: textoDiaMensaje(fecha),
    hora: horaCorta(hora),
  });
}
