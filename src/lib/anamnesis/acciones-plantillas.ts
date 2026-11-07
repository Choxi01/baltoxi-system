"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import type { ErroresFormulario } from "@/lib/config/validacion";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { validarPlantilla } from "./plantilla";

// Configuración > Anamnesis (tarea A6). Las plantillas son solo preguntas; cambiarlas no toca
// las anamnesis ya hechas, porque cada una guarda su propia copia de la estructura.

export type EstadoPlantilla = {
  errores: ErroresFormulario;
  guardadoEn: number | null;
};

const NO_SE_PUDO: EstadoPlantilla = { errores: { general: "No se pudo guardar. Probá de nuevo." }, guardadoEn: null };

function plantillasCambiaron() {
  revalidatePath("/config");
  // El expediente ofrece las plantillas activas al empezar una anamnesis.
  revalidatePath("/pacientes", "layout");
}

export async function crearPlantilla(_anterior: EstadoPlantilla, formulario: FormData): Promise<EstadoPlantilla> {
  const validacion = validarPlantilla(formulario);
  if (!validacion.ok) return { errores: validacion.errores, guardadoEn: null };

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("plantillas_anamnesis")
    .insert({ consultorio_id: consultorio.id, ...validacion.datos });
  if (error) return NO_SE_PUDO;
  plantillasCambiaron();
  return { errores: {}, guardadoEn: Date.now() };
}

export async function actualizarPlantilla(
  id: string,
  _anterior: EstadoPlantilla,
  formulario: FormData,
): Promise<EstadoPlantilla> {
  if (!esIdValido(id)) return { errores: { general: "Plantilla no encontrada." }, guardadoEn: null };
  const validacion = validarPlantilla(formulario);
  if (!validacion.ok) return { errores: validacion.errores, guardadoEn: null };

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("plantillas_anamnesis")
    .update(validacion.datos)
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return NO_SE_PUDO;
  plantillasCambiaron();
  return { errores: {}, guardadoEn: Date.now() };
}

/** Las plantillas no se borran (las anamnesis hechas las referencian): se desactivan. */
export async function cambiarActivaPlantilla(id: string, activa: boolean): Promise<{ error: string | null }> {
  if (!esIdValido(id)) return { error: "Plantilla no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("plantillas_anamnesis")
    .update({ activa })
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { error: "No se pudo guardar. Probá de nuevo." };
  plantillasCambiaron();
  return { error: null };
}
