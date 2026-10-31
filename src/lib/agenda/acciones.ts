"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { sumarDias } from "./calendario";
import { validarBloqueo, validarHorario, type ErroresBloqueo } from "./horario";
import { inicioDelDiaUtc } from "./turnos";

export type ResultadoGuardarHorario = { ok: true } | { ok: false; general?: string; porDia: Partial<Record<number, string>> };

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

function listo() {
  revalidatePath("/config");
  revalidatePath("/agenda");
}

/** Guarda el horario completo (todos los tramos) y la duración del bloque. */
export async function guardarHorario(entrada: unknown): Promise<ResultadoGuardarHorario> {
  const validacion = validarHorario(entrada);
  if (!validacion.ok) return validacion;
  const { duracion, tramos } = validacion.datos;

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: anteriores, error: errorLeer } = await supabase
    .from("horarios_atencion")
    .select("id")
    .eq("consultorio_id", consultorio.id);
  if (errorLeer) return { ok: false, general: NO_SE_PUDO, porDia: {} };

  // Primero se agregan los tramos nuevos y recién después se borran los viejos:
  // si algo falla a mitad de camino, el horario anterior queda como estaba.
  if (tramos.length > 0) {
    const { error } = await supabase
      .from("horarios_atencion")
      .insert(tramos.map((t) => ({ ...t, consultorio_id: consultorio.id })));
    if (error) return { ok: false, general: NO_SE_PUDO, porDia: {} };
  }
  const viejos = (anteriores ?? []).map((t) => t.id);
  if (viejos.length > 0) {
    const { error } = await supabase.from("horarios_atencion").delete().eq("consultorio_id", consultorio.id).in("id", viejos);
    if (error) return { ok: false, general: NO_SE_PUDO, porDia: {} };
  }

  const { error } = await supabase.from("consultorios").update({ duracion_bloque_min: duracion }).eq("id", consultorio.id);
  if (error) return { ok: false, general: NO_SE_PUDO, porDia: {} };
  listo();
  return { ok: true };
}

export type EstadoFormularioBloqueo = {
  errores: ErroresBloqueo;
  guardadoEn: number | null;
  /** Turnos fijos que se quitaron de esos días (se crean solos, en un feriado no van). */
  turnosFijosQuitados?: number;
  /** Turnos agendados a mano en esos días: no se tocan, se avisa. */
  turnosAMano?: number;
  revision?: number;
  enviado?: Record<string, string>;
};

/** Agrega un feriado o vacaciones. */
export async function agregarBloqueo(_anterior: EstadoFormularioBloqueo, formulario: FormData): Promise<EstadoFormularioBloqueo> {
  const campos = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  const conError = (errores: ErroresBloqueo) => ({ errores, guardadoEn: null, enviado: campos, revision: Date.now() });

  const validacion = validarBloqueo(campos);
  if (!validacion.ok) return conError(validacion.errores);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { desde, hasta } = validacion.datos;
  const { error } = await supabase.from("bloqueos").insert({ ...validacion.datos, consultorio_id: consultorio.id });
  if (error) return conError({ general: NO_SE_PUDO });

  // Turnos que ya estaban en esos días: solo futuros y sin marcar.
  const desdeInstante = maximo(inicioDelDiaUtc(desde), new Date().toISOString());
  const hastaInstante = inicioDelDiaUtc(sumarDias(hasta, 1));
  // Los turnos fijos se crean solos: en un feriado no van (si se borra el
  // feriado, vuelven al abrir la agenda). Los agendados a mano no se tocan.
  const [{ data: quitados }, { data: aMano }] = await Promise.all([
    supabase
      .from("turnos")
      .delete()
      .eq("consultorio_id", consultorio.id)
      .eq("estado", "agendado")
      .not("serie_id", "is", null)
      .gte("inicio", desdeInstante)
      .lt("inicio", hastaInstante)
      .select("id"),
    supabase
      .from("turnos")
      .select("id")
      .eq("consultorio_id", consultorio.id)
      .eq("estado", "agendado")
      .is("serie_id", null)
      .gte("inicio", desdeInstante)
      .lt("inicio", hastaInstante),
  ]);
  listo();
  const ahora = Date.now();
  return {
    errores: {},
    guardadoEn: ahora,
    revision: ahora,
    turnosFijosQuitados: quitados?.length ?? 0,
    turnosAMano: aMano?.length ?? 0,
  };
}

/** El mayor de dos instantes ISO en UTC (se comparan bien como texto). */
function maximo(a: string, b: string): string {
  return a > b ? a : b;
}

/** Borra un feriado o vacaciones. */
export async function borrarBloqueo(id: string): Promise<{ error: string | null }> {
  if (!esIdValido(id)) return { error: "No se encontró." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("bloqueos").delete().eq("consultorio_id", consultorio.id).eq("id", id);
  if (error) return { error: "No se pudo borrar. Probá de nuevo." };
  listo();
  return { error: null };
}
