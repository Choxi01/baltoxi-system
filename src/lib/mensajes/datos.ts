import "server-only";

// Lecturas de mensajes. Pasan por RLS y además se filtran por el consultorio.
// No es "use server": son funciones del servidor que no puede llamar el navegador.

import { aHoraLocal } from "@/lib/agenda/turnos";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CLAVES, PLANTILLAS_POR_DEFECTO, esClave, type Clave } from "./plantillas";
import type { MensajeListo } from "./tipos";
import { textoMensajeTurno } from "./turno";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Texto guardado de cada plantilla (o el de por defecto si falta o está vacío). */
export async function textosDePlantillas(supabase: Supabase, consultorioId: string): Promise<Record<Clave, string>> {
  const { data, error } = await supabase.from("plantillas_mensaje").select("clave, texto").eq("consultorio_id", consultorioId);
  if (error) throw new Error("No se pudieron leer las plantillas");
  const textos = { ...PLANTILLAS_POR_DEFECTO };
  for (const p of data ?? []) if (esClave(p.clave) && p.texto.trim()) textos[p.clave] = p.texto;
  return textos;
}

/** Plantillas para el editor de Configuración, en el orden de CLAVES. */
export async function listarPlantillas(): Promise<{ clave: Clave; texto: string }[]> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const textos = await textosDePlantillas(supabase, consultorio.id);
  return CLAVES.map((clave) => ({ clave, texto: textos[clave] }));
}

/**
 * Mensaje de cambio o cancelación para la familia de un turno con paciente.
 * Va al responsable de pago. Si falta algo (sin paciente, sin responsable), null.
 * `turnoId` es el turno cuyo día y hora van en el texto (el nuevo, si se movió).
 */
export async function mensajeParaTurno(
  supabase: Supabase,
  consultorioId: string,
  turnoId: string,
  clave: "cambio_turno" | "cancelacion_turno",
): Promise<MensajeListo | null> {
  const { data: turno } = await supabase
    .from("turnos")
    .select("clase, inicio, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, responsable_pago_id)")
    .eq("consultorio_id", consultorioId)
    .eq("id", turnoId)
    .maybeSingle();
  const paciente = turno?.pacientes;
  if (!turno || turno.clase !== "turno" || !paciente?.responsable_pago_id) return null;

  const [{ data: tutor }, textos] = await Promise.all([
    supabase
      .from("tutores")
      .select("id, nombre, apellido, telefono_wa")
      .eq("consultorio_id", consultorioId)
      .eq("id", paciente.responsable_pago_id)
      .maybeSingle(),
    textosDePlantillas(supabase, consultorioId),
  ]);
  if (!tutor) return null;

  const { fecha, hora } = aHoraLocal(turno.inicio);
  return {
    clave,
    referencia: turnoId,
    tutorId: tutor.id,
    tutor: `${tutor.nombre} ${tutor.apellido ?? ""}`.trim(),
    texto: textoMensajeTurno({ plantilla: textos[clave], tutor: tutor.nombre, paciente: paciente.nombre, fecha, hora }),
    telefono: tutor.telefono_wa,
  };
}

