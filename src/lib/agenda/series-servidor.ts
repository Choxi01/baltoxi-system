import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { horaDeBase } from "./horario";
import { horaFin, instanteUtc } from "./reservas";
import { fechasDeSerie } from "./series";

/**
 * Crea los turnos de las próximas 8 semanas de las series activas (o de una).
 * Se llama al abrir la agenda y al crear una serie. No duplica: si el turno
 * de esa serie a esa hora ya existe (aunque se haya movido o cancelado), no
 * se vuelve a crear (unique (serie_id, inicio)).
 */
export async function materializarSeries(hoy: string, serieId?: string): Promise<{ error: string | null }> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("series_turnos")
    .select("id, paciente_id, tipo_turno_id, dia_semana, hora, duracion_min, desde, hasta")
    .eq("consultorio_id", consultorio.id)
    .eq("estado", "activa");
  if (serieId) consulta = consulta.eq("id", serieId);
  const [{ data: series, error }, { data: bloqueos }] = await Promise.all([
    consulta,
    supabase.from("bloqueos").select("desde, hasta").eq("consultorio_id", consultorio.id).gte("hasta", hoy),
  ]);
  if (error) return { error: "No se pudieron leer los turnos fijos." };

  const filas = (series ?? []).flatMap((s) => {
    const hora = horaDeBase(s.hora);
    return fechasDeSerie(s, hoy, bloqueos ?? []).map((fecha) => ({
      consultorio_id: consultorio.id,
      clase: "turno",
      paciente_id: s.paciente_id,
      tipo_turno_id: s.tipo_turno_id,
      serie_id: s.id,
      inicio: instanteUtc(fecha, hora),
      fin: instanteUtc(fecha, horaFin(hora, s.duracion_min)),
    }));
  });
  if (filas.length === 0) return { error: null };
  const { error: errorAlta } = await supabase
    .from("turnos")
    .upsert(filas, { onConflict: "serie_id,inicio", ignoreDuplicates: true });
  return { error: errorAlta ? "No se pudieron crear los turnos fijos." : null };
}
