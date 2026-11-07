// Sesiones dobles y grupales (pedido 2 de docs/pedidos-daniela-2026-11.md, tarea A11a).
// Modelo: UN TURNO POR CHICO, unidos por `grupo_id` (migración 0013). Cada chico tiene su
// propio estado y su propio cargo; acá solo se valida el grupo, se arman los turnos a guardar
// y se junta lo que la grilla muestra como un solo rectángulo. Funciones puras con tests.

import type { TurnoAgenda } from "./turnos";

/** Máximo de chicos en una sesión (respuesta de Daniela; check de `tipos_turno.cupo`). */
export const CUPO_MAXIMO = 4;

export type ResultadoGrupo = { ok: true } | { ok: false; error: string };

/**
 * Al crear un grupo: entre 2 y `cupo` chicos distintos. `cupo` es el del tipo de turno;
 * un tipo individual (cupo 1) no arma grupos.
 */
export function validarGrupo(pacienteIds: string[], cupo: number): ResultadoGrupo {
  if (cupo < 2) return { ok: false, error: "Ese tipo de turno es individual: elegí un tipo doble o grupal." };
  if (new Set(pacienteIds).size !== pacienteIds.length) return { ok: false, error: "Hay un chico repetido." };
  if (pacienteIds.length < 2) return { ok: false, error: "Elegí al menos 2 chicos." };
  if (pacienteIds.length > cupo) {
    return { ok: false, error: cupo === 2 ? "Una sesión doble es de 2 chicos." : `Este tipo de turno es de hasta ${cupo} chicos.` };
  }
  return { ok: true };
}

/** Lo que se guarda en `turnos` para cada chico del grupo (un solo insert: o todos o ninguno). */
export type FilaTurnoGrupo = {
  consultorio_id: string;
  clase: "turno";
  paciente_id: string;
  tipo_turno_id: string;
  grupo_id: string;
  inicio: string;
  fin: string;
};

/** Un turno por chico, todos con el mismo tipo, horario y `grupo_id`. `inicio` y `fin` en UTC. */
export function turnosDelGrupo(datos: {
  consultorioId: string;
  grupoId: string;
  pacienteIds: string[];
  tipoTurnoId: string;
  inicio: string;
  fin: string;
}): FilaTurnoGrupo[] {
  return datos.pacienteIds.map((pacienteId) => ({
    consultorio_id: datos.consultorioId,
    clase: "turno",
    paciente_id: pacienteId,
    tipo_turno_id: datos.tipoTurnoId,
    grupo_id: datos.grupoId,
    inicio: datos.inicio,
    fin: datos.fin,
  }));
}

// ---------------------------------------------------------------------
// Grilla: un rectángulo por sesión
// ---------------------------------------------------------------------

export type ItemGrilla =
  | { tipo: "turno"; turno: TurnoAgenda }
  /** Dos o más turnos con el mismo `grupoId`, fecha y hora de inicio. `turnos` en el orden en que llegaron. */
  | { tipo: "grupo"; grupoId: string; turnos: TurnoAgenda[] };

/**
 * Junta los turnos de una misma sesión doble o grupal (mismo `grupoId`, misma fecha y misma hora
 * de inicio) en un solo item, en el lugar del primero. Si de un grupo queda un solo turno (los
 * demás cancelaron o se movieron), se muestra como uno individual.
 */
export function agruparTurnos(turnos: TurnoAgenda[]): ItemGrilla[] {
  const clave = (t: TurnoAgenda) => (t.grupoId && t.clase === "turno" ? `${t.grupoId}|${t.fecha}|${t.inicio}` : null);
  const porClave = new Map<string, TurnoAgenda[]>();
  for (const t of turnos) {
    const k = clave(t);
    if (k) porClave.set(k, [...(porClave.get(k) ?? []), t]);
  }
  const items: ItemGrilla[] = [];
  const puestos = new Set<string>();
  for (const t of turnos) {
    const k = clave(t);
    const grupo = k ? porClave.get(k)! : [];
    if (!k || grupo.length < 2) {
      items.push({ tipo: "turno", turno: t });
    } else if (!puestos.has(k)) {
      puestos.add(k);
      items.push({ tipo: "grupo", grupoId: t.grupoId!, turnos: grupo });
    }
  }
  return items;
}

/** Primer nombre del título ("Juan Pérez" → "Juan"). */
const primerNombre = (titulo: string) => titulo.trim().split(/\s+/)[0] ?? titulo;

/**
 * Texto del rectángulo, según cuántos chicos quedan en la sesión (no según el cupo del tipo):
 * 2 → "Juan + Pedro" (nombres de pila; si se llaman igual, nombre y apellido); 3 o más → "Grupal · 3".
 */
export function textoGrupo(turnos: Pick<TurnoAgenda, "titulo">[]): string {
  if (turnos.length >= 3) return `Grupal · ${turnos.length}`;
  const nombres = turnos.map((t) => primerNombre(t.titulo));
  const repetidos = new Set(nombres).size !== nombres.length;
  return (repetidos ? turnos.map((t) => t.titulo.trim()) : nombres).join(" + ");
}

/** "Sesión doble" (2 chicos) o "Sesión grupal" (3 o más). */
export function nombreSesion(cantidad: number): string {
  return cantidad >= 3 ? "Sesión grupal" : "Sesión doble";
}

/**
 * Qué clase de sesión es y de qué tipo, sin repetir: "Sesión doble" si el tipo se llama así (o no
 * tiene), "Sesión grupal · Taller de juego" si el tipo tiene otro nombre.
 */
export function encabezadoGrupo(tipo: string | null, cantidad: number): string {
  const nombre = nombreSesion(cantidad);
  if (!tipo || tipo.trim().toLowerCase().startsWith(nombre.toLowerCase())) return nombre;
  return `${nombre} · ${tipo}`;
}

// ---------------------------------------------------------------------
// Acciones de la sesión entera (A11b)
// ---------------------------------------------------------------------

/**
 * Los chicos de una sesión a los que les llega "Mover la sesión" o "Cancelar la sesión": los que
 * siguen agendados, con el mismo `grupoId`, fecha y hora (un turno fijo grupal usa el mismo
 * `grupoId` todas las semanas, así que la fecha y la hora hacen falta). Los que ya vinieron, no
 * vinieron o cancelaron quedan como están.
 */
export function agendadosDeLaSesion(
  turnos: TurnoAgenda[],
  sesion: Pick<TurnoAgenda, "grupoId" | "fecha" | "inicio">,
): TurnoAgenda[] {
  if (!sesion.grupoId) return [];
  return turnos.filter(
    (t) => t.clase === "turno" && t.grupoId === sesion.grupoId && t.fecha === sesion.fecha && t.inicio === sesion.inicio && t.estado === "agendado",
  );
}

export type AccionSesion = "mover_sesion" | "cancelar_sesion" | "finalizar_fijo";

/**
 * Botones de la sesión entera, arriba de los chicos. Mover y cancelar, si quedan al menos 2
 * agendados (con uno solo se usa el botón de ese chico). Finalizar el turno fijo, si algún chico
 * viene de un turno fijo grupal. Ninguna mientras se guarda un cambio de la sesión.
 */
export function accionesDeLaSesion(turnos: TurnoAgenda[]): AccionSesion[] {
  if (turnos.some((t) => t.guardando)) return [];
  const acciones: AccionSesion[] = [];
  const agendados = turnos.filter((t) => t.clase === "turno" && t.estado === "agendado");
  if (agendados.length >= 2) acciones.push("mover_sesion", "cancelar_sesion");
  if (turnos.some((t) => t.serieId)) acciones.push("finalizar_fijo");
  return acciones;
}

/** Los chicos de una sesión por su nombre de pila, para las confirmaciones: "Mateo, Lucas y Tomas". */
export function nombresDeLaSesion(turnos: Pick<TurnoAgenda, "titulo">[]): string {
  const nombres = turnos.map((t) => primerNombre(t.titulo));
  // Si dos se llaman igual, con apellido para no confundirlos.
  const lista = new Set(nombres).size === nombres.length ? nombres : turnos.map((t) => t.titulo.trim());
  return lista.length <= 1 ? (lista[0] ?? "") : `${lista.slice(0, -1).join(", ")} y ${lista.at(-1)}`;
}
