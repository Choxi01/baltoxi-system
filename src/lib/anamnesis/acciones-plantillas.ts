"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { validarPlantilla, type ErrorPlantilla } from "./estructura";

// Plantillas de anamnesis (Configuración > Anamnesis, tarea A6). Lo que llega del editor se vuelve a
// validar acá. Cambiar una plantilla no toca las anamnesis ya creadas: cada una tiene su copia.

export type ResultadoPlantilla = { ok: true; id: string } | { ok: false; errores: ErrorPlantilla[] };

const NO_SE_PUDO: ErrorPlantilla[] = [{ ruta: "general", mensaje: "No se pudo guardar. Probá de nuevo.", detalle: "No se pudo guardar. Probá de nuevo." }];

function plantillasCambiaron() {
  revalidatePath("/config");
  // La pestaña Anamnesis del expediente ofrece las plantillas activas.
  revalidatePath("/pacientes", "layout");
}

/** `id` null: plantilla nueva. */
export async function guardarPlantillaAnamnesis(id: string | null, datos: unknown): Promise<ResultadoPlantilla> {
  if (id !== null && !esIdValido(id)) return { ok: false, errores: [{ ruta: "general", mensaje: "Plantilla no encontrada.", detalle: "Plantilla no encontrada." }] };
  const validacion = validarPlantilla(datos);
  if (!validacion.ok) return { ok: false, errores: validacion.errores };

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { nombre, estructura } = validacion.datos;

  if (id === null) {
    const { data, error } = await supabase
      .from("plantillas_anamnesis")
      .insert({ consultorio_id: consultorio.id, nombre, estructura })
      .select("id")
      .single();
    if (error || !data) return { ok: false, errores: NO_SE_PUDO };
    plantillasCambiaron();
    return { ok: true, id: data.id };
  }

  const { data, error } = await supabase
    .from("plantillas_anamnesis")
    .update({ nombre, estructura })
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .select("id");
  if (error || !data?.length) return { ok: false, errores: NO_SE_PUDO };
  plantillasCambiaron();
  return { ok: true, id };
}

/** Las plantillas no se borran (las anamnesis guardan de cuál vienen): se desactivan. */
export async function cambiarActivaPlantillaAnamnesis(id: string, activa: boolean): Promise<{ error: string | null }> {
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
