import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { horaDeBase } from "./horario";
import { horaFin, instanteUtc } from "./reservas";
import { fechasDeSerie } from "./series";

/**
 * Último día en que este servidor completó todas las series de cada consultorio.
 * La ventana de 8 semanas avanza un día por día: alcanza con hacerlo una vez por día.
 * Es solo un atajo en memoria: si el servidor se reinicia (o Netlify usa otro), se
 * vuelve a hacer una vez, sin problema, porque no duplica. Una serie nueva no espera:
 * `crearSerie` llama con sus series y eso siempre se hace.
 */
const completadoEl = new Map<string, string>();

/**
 * Crea los turnos de las próximas 8 semanas de las series activas (o de las que se pasan: un turno
 * fijo grupal tiene una serie por chico). Cada turno lleva el `grupo_id` de su serie, así las
 * series de una misma sesión se ven juntas todas las semanas.
 * Se llama al abrir la agenda y Hoy (una vez por día) y al crear una serie. No
 * duplica: si el turno de esa serie a esa hora ya existe (aunque se haya movido
 * o cancelado), no se vuelve a crear (unique (serie_id, inicio)).
 */
export async function materializarSeries(hoy: string, serieIds?: string[]): Promise<{ error: string | null }> {
  const consultorio = await exigirConsultorio();
  if (!serieIds && completadoEl.get(consultorio.id) === hoy) return { error: null };
  const resultado = await crearTurnosDeSeries(consultorio.id, hoy, serieIds);
  if (!serieIds && !resultado.error) completadoEl.set(consultorio.id, hoy);
  return resultado;
}

async function crearTurnosDeSeries(consultorioId: string, hoy: string, serieIds?: string[]): Promise<{ error: string | null }> {
  const consultorio = { id: consultorioId };
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("series_turnos")
    .select("id, paciente_id, tipo_turno_id, grupo_id, dia_semana, hora, duracion_min, desde, hasta")
    .eq("consultorio_id", consultorio.id)
    .eq("estado", "activa");
  if (serieIds) consulta = consulta.in("id", serieIds);
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
      grupo_id: s.grupo_id,
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
