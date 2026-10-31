import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { finDeMes, inicioDeMes, sumarDias } from "./calendario";
import { pendientesDeReponer } from "./cancelacion";
import { horaDeBase } from "./horario";
import { aHoraLocal, inicioDelDiaUtc, type ClaseTurno, type EstadoTurno, type TurnoAgenda } from "./turnos";

// Lecturas del horario de atención y de los feriados/vacaciones.
// Todo pasa por RLS y además se filtra por el consultorio.

export async function obtenerHorario() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: config, error }, { data: tramos }, { data: bloqueos }] = await Promise.all([
    supabase.from("consultorios").select("duracion_bloque_min").eq("id", consultorio.id).single(),
    supabase.from("horarios_atencion").select("dia_semana, desde, hasta").eq("consultorio_id", consultorio.id),
    supabase.from("bloqueos").select("id, desde, hasta, motivo").eq("consultorio_id", consultorio.id).order("desde"),
  ]);
  if (error || !config) throw new Error("No se pudo leer el horario");
  return {
    duracion: config.duracion_bloque_min,
    tramos: (tramos ?? []).map((t) => ({ dia_semana: t.dia_semana, desde: horaDeBase(t.desde), hasta: horaDeBase(t.hasta) })),
    bloqueos: bloqueos ?? [],
  };
}

/**
 * Turnos de un rango de días (de Asunción), ya pasados a la hora local.
 * Solo datos administrativos: nombre del paciente y tipo de turno (regla de oro 7).
 */
export async function listarTurnos(desde: string, hasta: string): Promise<TurnoAgenda[]> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("turnos")
    .select(
      "id, clase, estado, inicio, fin, paciente_id, tipo_turno_id, nombre_reserva, motivo_ocupado, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, apellido), tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(nombre, modalidad)",
    )
    .eq("consultorio_id", consultorio.id)
    .gte("inicio", inicioDelDiaUtc(desde))
    .lt("inicio", inicioDelDiaUtc(sumarDias(hasta, 1)))
    .order("inicio");
  if (error) throw new Error("No se pudieron leer los turnos");

  return (data ?? []).map((t) => {
    const inicio = aHoraLocal(t.inicio);
    const paciente = t.pacientes ? `${t.pacientes.nombre} ${t.pacientes.apellido ?? ""}`.trim() : null;
    return {
      id: t.id,
      clase: t.clase as ClaseTurno,
      estado: t.estado as EstadoTurno,
      fecha: inicio.fecha,
      inicio: inicio.hora,
      fin: aHoraLocal(t.fin).hora,
      titulo: (t.clase === "turno" ? paciente : t.clase === "reservado" ? t.nombre_reserva : t.motivo_ocupado) ?? "",
      tipo: t.tipos_turno?.nombre ?? null,
      tipoId: t.tipo_turno_id,
      pacienteId: t.paciente_id,
      modalidad: t.tipos_turno?.modalidad ?? null,
    };
  });
}

/** Lo que necesita la agenda para reservar: pacientes activos, tipos de turno, traslado y horas mínimas de aviso. */
export async function obtenerDatosParaReservar() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: pacientes }, { data: tipos }, { data: config }] = await Promise.all([
    supabase
      .from("pacientes")
      .select("id, nombre, apellido")
      .eq("consultorio_id", consultorio.id)
      .eq("estado", "activo")
      .order("nombre"),
    supabase
      .from("tipos_turno")
      .select("id, nombre, modalidad, requiere_paciente")
      .eq("consultorio_id", consultorio.id)
      .eq("activo", true)
      .order("nombre"),
    supabase.from("consultorios").select("traslado_domicilio_min, horas_aviso_minimas").eq("id", consultorio.id).single(),
  ]);
  return {
    pacientes: pacientes ?? [],
    tipos: tipos ?? [],
    trasladoMin: config?.traslado_domicilio_min ?? 30,
    horasAvisoMinimas: config?.horas_aviso_minimas ?? 48,
  };
}

/** "Para reponer este mes": sesiones que canceló la profesional y todavía no tienen reposición. */
export async function listarParaReponer(hoy: string) {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: cancelados, error } = await supabase
    .from("turnos")
    .select("id, estado, reponer, inicio, paciente_id, tipo_turno_id, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, apellido)")
    .eq("consultorio_id", consultorio.id)
    .eq("estado", "cancelado_profesional")
    .eq("reponer", true)
    .gte("inicio", inicioDelDiaUtc(inicioDeMes(hoy)))
    .lt("inicio", inicioDelDiaUtc(sumarDias(finDeMes(hoy), 1)))
    .order("inicio");
  if (error) throw new Error("No se pudo leer la lista para reponer");
  if (!cancelados?.length) return [];
  const { data: reposiciones, error: errorReposiciones } = await supabase
    .from("turnos")
    .select("repone_a, estado")
    .eq("consultorio_id", consultorio.id)
    .in("repone_a", cancelados.map((c) => c.id));
  if (errorReposiciones) throw new Error("No se pudo leer la lista para reponer");
  return pendientesDeReponer(cancelados, reposiciones ?? []).map((t) => {
    const { fecha, hora } = aHoraLocal(t.inicio);
    return {
      id: t.id,
      fecha,
      inicio: hora,
      pacienteId: t.paciente_id,
      tipoId: t.tipo_turno_id,
      titulo: t.pacientes ? `${t.pacientes.nombre} ${t.pacientes.apellido ?? ""}`.trim() : "",
    };
  });
}
