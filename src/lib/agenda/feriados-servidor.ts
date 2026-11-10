import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { sumarDias } from "./calendario";
import { aniosACargar, feriadosDelAnio } from "./feriados";
import { inicioDelDiaUtc } from "./turnos";

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/**
 * Al poner un feriado: borra los turnos fijos futuros y sin marcar de esos días
 * (se crean solos; si se borra el feriado, vuelven al abrir la agenda) y cuenta
 * los agendados a mano, que no se tocan.
 */
export async function quitarTurnosFijos(
  supabase: Cliente,
  consultorioId: string,
  desde: string,
  hasta: string,
): Promise<{ quitados: number; aMano: number }> {
  const ahora = new Date().toISOString();
  const inicio = inicioDelDiaUtc(desde);
  const desdeInstante = inicio > ahora ? inicio : ahora;
  const hastaInstante = inicioDelDiaUtc(sumarDias(hasta, 1));
  const [{ data: quitados }, { data: aMano }] = await Promise.all([
    supabase
      .from("turnos")
      .delete()
      .eq("consultorio_id", consultorioId)
      .eq("estado", "agendado")
      .not("serie_id", "is", null)
      .gte("inicio", desdeInstante)
      .lt("inicio", hastaInstante)
      .select("id"),
    supabase
      .from("turnos")
      .select("id")
      .eq("consultorio_id", consultorioId)
      .eq("estado", "agendado")
      .is("serie_id", null)
      .gte("inicio", desdeInstante)
      .lt("inicio", hastaInstante),
  ]);
  return { quitados: quitados?.length ?? 0, aMano: aMano?.length ?? 0 };
}

/** Año ya revisado por este servidor, por consultorio (atajo en memoria, como en series-servidor.ts). */
const revisadoEn = new Map<string, number>();

/**
 * Carga los feriados de ley del año actual y del siguiente, si todavía no se
 * cargaron, y anota el último año en `consultorios.feriados_cargados_hasta`.
 * Un año ya anotado no se vuelve a cargar: si la profesional borra o cambia un
 * feriado (traslado por decreto), queda como lo dejó. No pisa feriados que ya
 * estén puestos ese día. Nunca corta la pantalla: si falla, se reintenta en la
 * próxima visita.
 */
export async function cargarFeriados(hoy: string): Promise<void> {
  try {
    const consultorio = await exigirConsultorio();
    const anio = Number(hoy.slice(0, 4));
    if (revisadoEn.get(consultorio.id) === anio) return;

    const supabase = await crearClienteServidor();
    const { data: actual, error } = await supabase
      .from("consultorios")
      .select("feriados_cargados_hasta")
      .eq("id", consultorio.id)
      .single();
    if (error) throw error;
    const anterior = actual.feriados_cargados_hasta;
    const anios = aniosACargar(hoy, anterior);
    if (anios.length === 0) {
      revisadoEn.set(consultorio.id, anio);
      return;
    }

    // Primero se "reserva" el año: si Agenda y Hoy llegan juntas, solo una carga.
    const hasta = anios[anios.length - 1];
    let reserva = supabase.from("consultorios").update({ feriados_cargados_hasta: hasta }).eq("id", consultorio.id);
    reserva = anterior === null ? reserva.is("feriados_cargados_hasta", null) : reserva.eq("feriados_cargados_hasta", anterior);
    const { data: reservado, error: errorReserva } = await reserva.select("id");
    if (errorReserva) throw errorReserva;
    if (!reservado?.length) return; // otro pedido ya lo está haciendo

    const feriados = anios.flatMap(feriadosDelAnio);
    const { data: existentes } = await supabase
      .from("bloqueos")
      .select("desde")
      .eq("consultorio_id", consultorio.id)
      .gte("desde", feriados[0].desde)
      .lte("desde", feriados[feriados.length - 1].desde);
    const yaPuestos = new Set((existentes ?? []).map((b) => b.desde));
    const nuevos = feriados.filter((f) => !yaPuestos.has(f.desde));

    const { error: errorInsertar } = nuevos.length
      ? await supabase.from("bloqueos").insert(nuevos.map((f) => ({ ...f, consultorio_id: consultorio.id })))
      : { error: null };
    if (errorInsertar) {
      // Se devuelve la marca para reintentar en la próxima visita.
      await supabase.from("consultorios").update({ feriados_cargados_hasta: anterior }).eq("id", consultorio.id);
      throw errorInsertar;
    }
    for (const f of nuevos) await quitarTurnosFijos(supabase, consultorio.id, f.desde, f.hasta);
    revisadoEn.set(consultorio.id, anio);
  } catch {
    // Sin datos del consultorio en el registro (regla de oro 7).
    console.warn("[feriados] no se pudieron cargar los feriados del año");
  }
}
