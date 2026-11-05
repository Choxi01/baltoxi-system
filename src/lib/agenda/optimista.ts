// Acciones optimistas: cómo se ven los turnos MIENTRAS se guarda un cambio.
// La pantalla cambia al tocar; cuando el servidor contesta, se reemplaza por los
// datos reales (normalmente iguales). Si falla, React vuelve solo a como estaba.
// Copia lo que hace el servidor en cada acción (src/lib/agenda/acciones-turnos.ts),
// con las mismas funciones puras. Funciones puras con tests.

import { cambiosAsistencia, type AccionAsistencia } from "./asistencia";
import type { TurnoAgenda } from "./turnos";

export type EstadoCancelado = "ausente_con_aviso" | "aviso_tardio" | "cancelado_profesional";

export type CambioOptimista =
  /** Vino / No vino / Volver a agendado / Quitar excepción. */
  | { tipo: "asistencia"; id: string; accion: Exclude<AccionAsistencia, "excepcion"> }
  /** Excepción "a criterio" (otro porcentaje). */
  | { tipo: "excepcion"; id: string; porcentaje: number }
  /** Cancelar (el estado sale de datosCancelacion, igual que en el servidor). */
  | { tipo: "cancelar"; id: string; estado: EstadoCancelado }
  /** Quitar un reservado u ocupado: el horario queda libre. */
  | { tipo: "quitar"; id: string }
  /** Mover a otro día u hora. */
  | { tipo: "mover"; id: string; fecha: string; inicio: string; fin: string }
  /** Reservar o marcar ocupado: el turno nuevo (armado con `turnoNuevo`). */
  | { tipo: "agregar"; turno: TurnoAgenda }
  /** Cobrar ahora: el botón desaparece (el pago se registró). */
  | { tipo: "cobrado"; id: string };

/** Id del turno nuevo que se muestra mientras se mueve uno con paciente (el real lo da la base). */
export const idMovido = (id: string) => `movido-${id}`;

/**
 * Los turnos como se tienen que ver mientras se guarda `cambio`. No modifica la lista
 * que recibe. El turno tocado queda con `guardando: true` y sin `cobro`: el monto de
 * "Cobrar ahora" puede cambiar, así que el botón vuelve cuando contesta el servidor.
 */
export function aplicarCambio(turnos: TurnoAgenda[], cambio: CambioOptimista): TurnoAgenda[] {
  if (cambio.tipo === "agregar") return ordenar([...turnos, { ...cambio.turno, guardando: true }]);
  const turno = turnos.find((t) => t.id === cambio.id);
  if (!turno) return turnos;
  const marcado = (datos: Partial<TurnoAgenda>): TurnoAgenda => ({ ...turno, ...datos, cobro: undefined, guardando: true });
  const reemplazar = (nuevo: TurnoAgenda) => turnos.map((t) => (t.id === turno.id ? nuevo : t));

  switch (cambio.tipo) {
    case "asistencia": {
      // La fecha no importa acá: solo se usa para "marcado_en", que la pantalla no muestra.
      const c = cambiosAsistencia(cambio.accion, null, new Date(0));
      return reemplazar(marcado({ ...(c.estado ? { estado: c.estado } : {}), porcentajeManual: c.porcentaje_manual }));
    }
    case "excepcion":
      return reemplazar(marcado({ porcentajeManual: cambio.porcentaje }));
    case "cancelar":
      return reemplazar(marcado({ estado: cambio.estado }));
    case "quitar":
      return turnos.filter((t) => t.id !== turno.id);
    case "cobrado":
      return reemplazar(marcado({}));
    case "mover": {
      const lugar = { fecha: cambio.fecha, inicio: cambio.inicio, fin: cambio.fin };
      if (turno.clase !== "turno") return ordenar(reemplazar(marcado(lugar)));
      // Con paciente: el original queda "reprogramado" (libera su horario) y se crea uno nuevo
      // con el mismo paciente y tipo, sin turno fijo ni excepción (como mover_turno, migración 0007).
      const nuevo: TurnoAgenda = {
        ...turno,
        ...lugar,
        id: idMovido(turno.id),
        estado: "agendado",
        serieId: null,
        porcentajeManual: null,
        cobro: undefined,
        guardando: true,
      };
      return ordenar([...reemplazar(marcado({ estado: "reprogramado" })), nuevo]);
    }
  }
}

const ordenar = (turnos: TurnoAgenda[]) =>
  [...turnos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio));

/**
 * El turno que se muestra al Reservar o Marcar ocupado mientras se guarda, con los mismos
 * datos que después devuelve el servidor (listarTurnos): título = nombre del paciente,
 * nombre suelto o motivo; un ocupado no tiene tipo de turno.
 */
export function turnoNuevo(datos: {
  id: string;
  fecha: string;
  inicio: string;
  fin: string;
  clase: "turno" | "reservado" | "ocupado";
  paciente?: { id: string; nombre: string; apellido: string | null } | null;
  nombreReserva?: string;
  motivo?: string;
  tipo?: { id: string; nombre: string; modalidad: string; color?: string | null } | null;
}): TurnoAgenda {
  const tipo = datos.clase === "ocupado" ? null : (datos.tipo ?? null);
  const titulo =
    datos.clase === "turno"
      ? `${datos.paciente?.nombre ?? ""} ${datos.paciente?.apellido ?? ""}`.trim()
      : datos.clase === "reservado"
        ? (datos.nombreReserva ?? "")
        : (datos.motivo ?? "");
  return {
    id: datos.id,
    clase: datos.clase,
    estado: "agendado",
    fecha: datos.fecha,
    inicio: datos.inicio,
    fin: datos.fin,
    titulo,
    tipo: tipo?.nombre ?? null,
    serieId: null,
    tipoId: tipo?.id ?? null,
    pacienteId: datos.clase === "turno" ? (datos.paciente?.id ?? null) : null,
    color: tipo?.color ?? null,
    modalidad: tipo?.modalidad ?? null,
    porcentajeManual: null,
  };
}
