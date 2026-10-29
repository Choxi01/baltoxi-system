import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { sumarDias } from "./calendario";
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
      "id, clase, estado, inicio, fin, nombre_reserva, motivo_ocupado, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, apellido), tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(nombre)",
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
    };
  });
}
