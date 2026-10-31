// Tipos compartidos de mensajes (los usan el servidor y la pantalla).

import type { Clave } from "./plantillas";

export type CanalManual = "copiado" | "whatsapp_link";

/**
 * Un mensaje listo para mandar: el texto ya armado y lo necesario para anotarlo
 * en `mensajes_enviados` (clave + referencia + tutor) al copiarlo o abrir WhatsApp.
 */
export type MensajeListo = {
  clave: Clave;
  /** Id del turno, "AAAA-MM", "AAAA-Www" o "AAAA-MM-DD" (docs/mensajes.md). */
  referencia: string;
  tutorId: string;
  /** Nombre del tutor para mostrar en la pantalla (no va en el texto). */
  tutor: string;
  texto: string;
  /** WhatsApp del tutor (595…), o null si no tiene. */
  telefono: string | null;
};
