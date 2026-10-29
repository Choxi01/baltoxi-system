"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { validarConsultorio, validarTarifa, type ErroresFormulario } from "./validacion";

export type EstadoFormularioConfig = {
  errores: ErroresFormulario;
  guardadoEn: number | null;
  /** Cambia en cada envío: el formulario se vuelve a armar con los valores nuevos. */
  revision?: number;
  /** Lo que se escribió, para no perderlo si hubo un error (React vacía el formulario). */
  enviado?: Record<string, string>;
};

function conError(errores: ErroresFormulario, formulario: FormData): EstadoFormularioConfig {
  const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

function listo(): EstadoFormularioConfig {
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, revision: ahora };
}

const ERROR_GENERAL = { general: "No se pudo guardar. Probá de nuevo." };

export async function actualizarConsultorio(
  _anterior: EstadoFormularioConfig,
  formulario: FormData,
): Promise<EstadoFormularioConfig> {
  const validacion = validarConsultorio(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("consultorios").update(validacion.datos).eq("id", consultorio.id);
  if (error) return conError(ERROR_GENERAL, formulario);
  // El nombre del consultorio aparece en toda la app.
  revalidatePath("/", "layout");
  return listo();
}

function tarifasCambiaron() {
  revalidatePath("/config");
  revalidatePath("/pacientes", "layout");
}

export async function crearTarifa(_anterior: EstadoFormularioConfig, formulario: FormData): Promise<EstadoFormularioConfig> {
  const validacion = validarTarifa(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarifas").insert({ ...validacion.datos, consultorio_id: consultorio.id });
  if (error) return conError(ERROR_GENERAL, formulario);
  tarifasCambiaron();
  return listo();
}

export async function actualizarTarifa(
  id: string,
  _anterior: EstadoFormularioConfig,
  formulario: FormData,
): Promise<EstadoFormularioConfig> {
  if (!esIdValido(id)) return conError({ general: "Tarifa no encontrada." }, formulario);
  const validacion = validarTarifa(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  // Los cargos ya creados guardan su monto (snapshot): cambiar la tarifa no los toca.
  const { error } = await supabase
    .from("tarifas")
    .update(validacion.datos)
    .eq("consultorio_id", consultorio.id)
    .eq("id", id);
  if (error) return conError(ERROR_GENERAL, formulario);
  tarifasCambiaron();
  return listo();
}

/** Las tarifas no se borran (las usan pacientes y tipos de turno): se desactivan. */
export async function cambiarActivaTarifa(id: string, activa: boolean): Promise<{ error: string | null }> {
  if (!esIdValido(id)) return { error: "Tarifa no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("tarifas")
    .update({ activa })
    .eq("consultorio_id", consultorio.id)
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };
  tarifasCambiaron();
  return { error: null };
}
