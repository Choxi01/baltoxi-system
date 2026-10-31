"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { MES_CERRADO } from "@/lib/cobro/aplicar";
import { aplicarEstadoTurno } from "@/lib/cobro/aplicar-estado";
import { hoyEnAsuncion } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ACCIONES_ASISTENCIA, accionesDelTurno, cambiosAsistencia, validarExcepcion, type AccionAsistencia, type Excepcion } from "./asistencia";
import { inicioDeMes } from "./calendario";
import { datosCancelacion, pendientesDeReponer } from "./cancelacion";
import { listarTurnos, obtenerHorario } from "./datos";
import { avisosAlAgendar, horaFin, instanteUtc, textosAvisos, validarReserva } from "./reservas";
import { aHoraLocal, armarDia, type ClaseTurno, type EstadoTurno } from "./turnos";

export type ResultadoAgendar =
  | { ok: true }
  /** Ya hay un turno a esa hora: la pantalla pregunta "¿Agendar igual?" y vuelve a mandar con confirmado. */
  | { ok: false; confirmar: string }
  | { ok: false; error: string };

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

/** Reservar un bloque (paciente o nombre suelto) o marcarlo ocupado. */
export async function agendar(entrada: unknown): Promise<ResultadoAgendar> {
  const validacion = validarReserva(entrada);
  if (!validacion.ok) return validacion;
  const datos = validacion.datos;

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  // El tipo de turno y el paciente tienen que ser de este consultorio.
  const tipoId = datos.clase === "ocupado" ? null : datos.tipo_turno_id;
  let modalidad: string | null = null;
  if (tipoId) {
    const { data: tipo } = await supabase
      .from("tipos_turno")
      .select("modalidad")
      .eq("consultorio_id", consultorio.id)
      .eq("id", tipoId)
      .eq("activo", true)
      .maybeSingle();
    if (!tipo) return { ok: false, error: "Elegí un tipo de turno." };
    modalidad = tipo.modalidad;
  }
  if (datos.clase === "turno") {
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("id")
      .eq("consultorio_id", consultorio.id)
      .eq("id", datos.paciente_id)
      .maybeSingle();
    if (!paciente) return { ok: false, error: "Paciente no encontrado." };
    // Reponer: tiene que ser una sesión de ese paciente que canceló la profesional.
    // Y que todavía no tenga otra reposición agendada (no reponer dos veces la misma).
    if (datos.repone_a) {
      const [{ data: original }, { data: reposiciones, error: errorReposiciones }] = await Promise.all([
        supabase
          .from("turnos")
          .select("id, reponer, estado")
          .eq("consultorio_id", consultorio.id)
          .eq("id", datos.repone_a)
          .eq("paciente_id", datos.paciente_id)
          .eq("estado", "cancelado_profesional")
          .maybeSingle(),
        supabase.from("turnos").select("repone_a, estado").eq("consultorio_id", consultorio.id).eq("repone_a", datos.repone_a),
      ]);
      if (!original) return { ok: false, error: "No se encontró la sesión a reponer." };
      if (errorReposiciones) return { ok: false, error: NO_SE_PUDO };
      if (pendientesDeReponer([original], reposiciones ?? []).length === 0) {
        return { ok: false, error: "Esa sesión ya tiene una reposición agendada." };
      }
    }
  }

  const { data: config } = await supabase
    .from("consultorios")
    .select("duracion_bloque_min, traslado_domicilio_min")
    .eq("id", consultorio.id)
    .single();
  if (!config) return { ok: false, error: NO_SE_PUDO };
  const fin = horaFin(datos.inicio, config.duracion_bloque_min);

  // Se vuelve a revisar acá por si otro dispositivo agendó en ese horario mientras tanto.
  if (!datos.confirmado) {
    const avisos = avisosAlAgendar(
      { fecha: datos.fecha, inicio: datos.inicio, fin, modalidad },
      await listarTurnos(datos.fecha, datos.fecha),
      config.traslado_domicilio_min,
    );
    const texto = textosAvisos(avisos, config.traslado_domicilio_min).superposicion;
    if (texto) return { ok: false, confirmar: texto };
  }

  const { error } = await supabase.from("turnos").insert({
    consultorio_id: consultorio.id,
    clase: datos.clase,
    paciente_id: datos.clase === "turno" ? datos.paciente_id : null,
    nombre_reserva: datos.clase === "reservado" ? datos.nombre_reserva : null,
    motivo_ocupado: datos.clase === "ocupado" ? datos.motivo_ocupado : null,
    tipo_turno_id: tipoId,
    repone_a: datos.clase === "turno" ? (datos.repone_a ?? null) : null,
    inicio: instanteUtc(datos.fecha, datos.inicio),
    fin: instanteUtc(datos.fecha, fin),
  });
  if (error) return { ok: false, error: NO_SE_PUDO };
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Mover, cancelar y quitar (A3b)
// ---------------------------------------------------------------------

const esFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const esHora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const esId = z.uuid();

/** `aviso`: se guardó, pero hay algo para contarle a la profesional. */
export type ResultadoSimple = { ok: true; aviso?: string } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/agenda");
  revalidatePath("/hoy");
}

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/** ¿El mes del turno está cerrado? Entonces no se cambia nada del turno (regla de oro 5). */
async function mesCerrado(supabase: Supabase, consultorioId: string, inicio: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("cierres")
    .select("id")
    .eq("consultorio_id", consultorioId)
    .eq("periodo", inicioDeMes(aHoraLocal(inicio).fecha))
    .eq("estado", "cerrado")
    .maybeSingle();
  // Si no se pudo leer, mejor no tocar nada.
  return !!data || !!error;
}

/** Bloques libres de un día (para elegir a dónde mover). */
export async function libresDelDia(
  fecha: string,
): Promise<{ ok: true; libres: string[]; bloqueo: string | null } | { ok: false; error: string }> {
  if (!esFecha.safeParse(fecha).success) return { ok: false, error: "Fecha no válida." };
  const [{ duracion, tramos, bloqueos }, turnos] = await Promise.all([obtenerHorario(), listarTurnos(fecha, fecha)]);
  const dia = armarDia(fecha, tramos, duracion, bloqueos, turnos);
  return {
    ok: true,
    libres: dia.filas.flatMap((f) => (f.tipo === "bloque" && f.turnos.length === 0 ? [f.inicio] : [])),
    bloqueo: dia.bloqueo ? (dia.bloqueo.motivo || "Feriado o vacaciones") : null,
  };
}

/** Lee un turno del consultorio que todavía se puede mover o cancelar. */
async function turnoAgendado(id: string) {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: turno } = await supabase
    .from("turnos")
    .select("id, clase, estado, inicio, fin")
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .maybeSingle();
  return { consultorio, supabase, turno: turno?.estado === "agendado" ? turno : null };
}

/**
 * Mover: un turno con paciente queda 'reprogramado' y se crea el nuevo (sin
 * costo); un reservado u ocupado cambia de hora. Todo en la base de una vez
 * (función mover_turno, migración 0007). Mantiene la duración del turno.
 */
export async function moverTurno(id: string, fecha: string, inicio: string): Promise<ResultadoSimple> {
  if (!esId.safeParse(id).success || !esFecha.safeParse(fecha).success || !esHora.safeParse(inicio).success) {
    return { ok: false, error: "Faltan datos para mover." };
  }
  const { consultorio, supabase, turno } = await turnoAgendado(id);
  if (!turno) return { ok: false, error: "Ese turno ya no se puede mover." };
  // Mover un turno con paciente cambia su estado (reprogramado): no en un mes cerrado.
  if (turno.clase === "turno" && (await mesCerrado(supabase, consultorio.id, turno.inicio))) return { ok: false, error: MES_CERRADO };

  // Con las fechas completas (no solo la hora), así no falla si el turno cruza la medianoche.
  const duracion = Math.round((new Date(turno.fin).getTime() - new Date(turno.inicio).getTime()) / 60_000);
  const fin = horaFin(inicio, duracion > 0 ? duracion : 45);
  const { error } = await supabase.rpc("mover_turno", {
    p_turno: id,
    p_inicio: instanteUtc(fecha, inicio),
    p_fin: instanteUtc(fecha, fin),
  });
  if (error) return { ok: false, error: NO_SE_PUDO };
  revalidar();
  // El original queda 'reprogramado' con su cargo de Gs. 0 (así aparece en el detalle).
  // Si eso falla, el turno se movió igual: el cobro real es el del turno nuevo.
  if (turno.clase === "turno") {
    const cargo = await aplicarEstadoTurno(supabase, consultorio.id, id);
    if (!cargo.ok) return { ok: true, aviso: `Movido ✓ pero no se anotó el cobro de Gs. 0 del original: ${cargo.error}` };
  }
  return { ok: true };
}

/**
 * Cancelar un turno con paciente. La familia: se clasifica según cuándo avisó
 * (48 h). La profesional: queda para reponer. Después crea el cargo (aplicarEstadoTurno);
 * si eso falla, el turno vuelve a quedar agendado.
 */
export async function cancelarTurno(
  id: string,
  quien: "familia" | "profesional",
  aviso: { fecha: string; hora: string } | null,
): Promise<ResultadoSimple> {
  if (!esId.safeParse(id).success || (quien !== "familia" && quien !== "profesional")) {
    return { ok: false, error: "Faltan datos para cancelar." };
  }
  if (quien === "familia" && (!aviso || !esFecha.safeParse(aviso.fecha).success || !esHora.safeParse(aviso.hora).success)) {
    return { ok: false, error: "Elegí cuándo avisó." };
  }
  const { consultorio, supabase, turno } = await turnoAgendado(id);
  if (!turno || turno.clase !== "turno") return { ok: false, error: "Ese turno ya no se puede cancelar." };
  if (await mesCerrado(supabase, consultorio.id, turno.inicio)) return { ok: false, error: MES_CERRADO };

  const { data: config } = await supabase.from("consultorios").select("horas_aviso_minimas").eq("id", consultorio.id).single();
  if (!config) return { ok: false, error: NO_SE_PUDO };
  const avisoEn = aviso ? new Date(instanteUtc(aviso.fecha, aviso.hora)) : new Date();
  const cambios = datosCancelacion(quien, { inicio: new Date(turno.inicio) }, avisoEn, config.horas_aviso_minimas);

  const { data: cancelados, error } = await supabase
    .from("turnos")
    .update({ ...cambios, marcado_en: new Date().toISOString() })
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .eq("estado", "agendado")
    .select("id");
  if (error) return { ok: false, error: NO_SE_PUDO };
  if (!cancelados?.length) return { ok: false, error: "El turno cambió en otro dispositivo. Recargá la página." };

  const cargo = await aplicarEstadoTurno(supabase, consultorio.id, id);
  if (!cargo.ok) {
    // Deshacer: el turno vuelve a como estaba (estaba agendado, sin excepción).
    await supabase
      .from("turnos")
      .update({ estado: "agendado", aviso_en: null, reponer: false, marcado_en: null })
      .eq("consultorio_id", consultorio.id)
      .eq("id", id);
    revalidar();
    return { ok: false, error: cargo.error };
  }
  revalidar();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Asistencia (B3): Vino / No vino / volver a agendado / excepción
// ---------------------------------------------------------------------

/**
 * Marca la asistencia o la excepción de un turno con paciente y actualiza su cargo.
 * Solo lo que permite `accionesDelTurno` (la misma regla que los botones).
 * Si el cargo no se puede guardar, el turno vuelve a como estaba.
 */
export async function marcarAsistencia(id: string, accion: AccionAsistencia, excepcion: Excepcion | null = null): Promise<ResultadoSimple> {
  if (!esId.safeParse(id).success || !(ACCIONES_ASISTENCIA as readonly string[]).includes(accion)) {
    return { ok: false, error: "Faltan datos." };
  }
  let datosExcepcion: Excepcion | null = null;
  if (accion === "excepcion") {
    const v = validarExcepcion(excepcion);
    if (!v.ok) return v;
    datosExcepcion = v.datos;
  }

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: turno } = await supabase
    .from("turnos")
    .select("id, clase, estado, inicio, porcentaje_manual, motivo_excepcion, marcado_en")
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .maybeSingle();
  if (!turno) return { ok: false, error: "Turno no encontrado." };

  const permitidas = accionesDelTurno(
    {
      clase: turno.clase as ClaseTurno,
      estado: turno.estado as EstadoTurno,
      fecha: aHoraLocal(turno.inicio).fecha,
      porcentajeManual: turno.porcentaje_manual,
    },
    hoyEnAsuncion(),
  );
  if (!permitidas.includes(accion)) return { ok: false, error: "Ese turno ya no se puede cambiar así. Recargá la página." };
  if (await mesCerrado(supabase, consultorio.id, turno.inicio)) return { ok: false, error: MES_CERRADO };

  // Solo si sigue en el mismo estado (por si otro dispositivo lo cambió mientras tanto).
  const { data: cambiados, error } = await supabase
    .from("turnos")
    .update(cambiosAsistencia(accion, datosExcepcion, new Date()))
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .eq("estado", turno.estado)
    .select("id");
  if (error) return { ok: false, error: NO_SE_PUDO };
  if (!cambiados?.length) return { ok: false, error: "El turno cambió en otro dispositivo. Recargá la página." };

  const cargo = await aplicarEstadoTurno(supabase, consultorio.id, id);
  if (!cargo.ok) {
    await supabase
      .from("turnos")
      .update({
        estado: turno.estado,
        porcentaje_manual: turno.porcentaje_manual,
        motivo_excepcion: turno.motivo_excepcion,
        marcado_en: turno.marcado_en,
      })
      .eq("consultorio_id", consultorio.id)
      .eq("id", id);
    revalidar();
    return { ok: false, error: cargo.error };
  }
  revalidar();
  return { ok: true };
}

/** Quitar un "Reservado" u "Ocupado" (no generan cobros ni historial). */
export async function quitarTurno(id: string): Promise<ResultadoSimple> {
  if (!esId.safeParse(id).success) return { ok: false, error: "Turno no encontrado." };
  const { consultorio, supabase, turno } = await turnoAgendado(id);
  if (!turno || turno.clase === "turno") return { ok: false, error: "Ese turno no se puede quitar: cancelalo." };
  const { error } = await supabase.from("turnos").delete().eq("consultorio_id", consultorio.id).eq("id", id);
  if (error) return { ok: false, error: NO_SE_PUDO };
  revalidar();
  return { ok: true };
}
