"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { copiarEstructura, validarEstructura } from "./estructura";
import { validarRespuestas } from "./respuestas";

// Anamnesis del expediente (tarea A6b). DATOS CLÍNICOS (regla de oro 7): los errores son genéricos
// y nunca llevan lo respondido; no se loguea nada.

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

/** Crea una anamnesis con una COPIA de la plantilla (si la plantilla cambia, esta no). */
export async function crearAnamnesis(pacienteId: string, plantillaId: string): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(plantillaId)) return { error: "Elegí una plantilla." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  const { data: plantilla } = await supabase
    .from("plantillas_anamnesis")
    .select("id, estructura")
    .eq("consultorio_id", consultorio.id)
    .eq("id", plantillaId)
    .eq("activa", true)
    .maybeSingle();
  const estructura = plantilla ? validarEstructura(plantilla.estructura) : null;
  if (!estructura?.ok) return { error: "Esa plantilla no se puede usar. Revisala en Configuración." };

  // La clave foránea (consultorio_id, paciente_id) impide usar un paciente de otro consultorio.
  const { error } = await supabase.from("anamnesis").insert({
    consultorio_id: consultorio.id,
    paciente_id: pacienteId,
    plantilla_id: plantillaId,
    estructura: copiarEstructura(estructura.estructura),
    respuestas: {},
    fecha: hoyEnAsuncion(),
  });
  if (error) return { error: NO_SE_PUDO };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { error: null };
}

/**
 * Guardado automático: reemplaza todas las respuestas, validadas contra la estructura copiada.
 * No revalida la página para no pisar lo que se está escribiendo.
 */
export async function guardarRespuestas(pacienteId: string, anamnesisId: string, respuestas: unknown): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(anamnesisId)) return { error: "Anamnesis no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  const { data: anamnesis } = await supabase
    .from("anamnesis")
    .select("estructura")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", anamnesisId)
    .maybeSingle();
  const estructura = anamnesis ? validarEstructura(anamnesis.estructura) : null;
  if (!estructura?.ok) return { error: "Anamnesis no encontrada." };

  const validacion = validarRespuestas(estructura.estructura, respuestas);
  if (!validacion.ok) return { error: validacion.error };

  const { data, error } = await supabase
    .from("anamnesis")
    .update({ respuestas: validacion.respuestas, actualizado_en: new Date().toISOString() })
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", anamnesisId)
    .select("id");
  if (error || !data?.length) return { error: NO_SE_PUDO };
  return { error: null };
}
