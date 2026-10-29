import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { horaDeBase } from "./horario";

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
