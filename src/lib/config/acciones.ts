"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  ERROR_EXCEPCION_REPETIDA,
  ESTADOS_CON_REGLA,
  validarConsultorio,
  validarExcepcion,
  validarReglas,
  validarTarifa,
  validarTipoTurno,
  type ErroresFormulario,
} from "./validacion";

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

function tiposCambiaron() {
  revalidatePath("/config");
  // La agenda usa los tipos de turno al reservar.
  revalidatePath("/agenda", "layout");
}

export async function crearTipoTurno(_anterior: EstadoFormularioConfig, formulario: FormData): Promise<EstadoFormularioConfig> {
  const validacion = validarTipoTurno(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tipos_turno").insert({ ...validacion.datos, consultorio_id: consultorio.id });
  if (error) return conError(ERROR_GENERAL, formulario);
  tiposCambiaron();
  return listo();
}

export async function actualizarTipoTurno(
  id: string,
  _anterior: EstadoFormularioConfig,
  formulario: FormData,
): Promise<EstadoFormularioConfig> {
  if (!esIdValido(id)) return conError({ general: "Tipo de turno no encontrado." }, formulario);
  const validacion = validarTipoTurno(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  // Los cargos ya creados guardan su snapshot: cambiar el tipo no los toca.
  const { error } = await supabase
    .from("tipos_turno")
    .update(validacion.datos)
    .eq("consultorio_id", consultorio.id)
    .eq("id", id);
  if (error) return conError(ERROR_GENERAL, formulario);
  tiposCambiaron();
  return listo();
}

/** Los tipos de turno no se borran (los usan turnos y series): se desactivan. */
export async function cambiarActivoTipoTurno(id: string, activo: boolean): Promise<{ error: string | null }> {
  if (!esIdValido(id)) return { error: "Tipo de turno no encontrado." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("tipos_turno")
    .update({ activo })
    .eq("consultorio_id", consultorio.id)
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };
  tiposCambiaron();
  return { error: null };
}

/** Porcentajes generales (sin paciente). No toca los cargos ya hechos. */
export async function guardarReglas(_anterior: EstadoFormularioConfig, formulario: FormData): Promise<EstadoFormularioConfig> {
  const validacion = validarReglas(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  // Una sola operación para las 6 reglas: se guardan todas o ninguna. Si alguna regla general
  // faltara, se crea (la base no deja repetir consultorio + estado + paciente, con paciente vacío incluido).
  const { error } = await supabase.from("reglas_cobro").upsert(
    ESTADOS_CON_REGLA.map((estado) => ({
      consultorio_id: consultorio.id,
      estado,
      paciente_id: null,
      porcentaje: validacion.datos[estado],
    })),
    { onConflict: "consultorio_id,estado,paciente_id" },
  );
  if (error) return conError(ERROR_GENERAL, formulario);
  revalidatePath("/config");
  return listo();
}

export async function agregarExcepcion(_anterior: EstadoFormularioConfig, formulario: FormData): Promise<EstadoFormularioConfig> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: existentes } = await supabase
    .from("reglas_cobro")
    .select("paciente_id, estado")
    .eq("consultorio_id", consultorio.id)
    .not("paciente_id", "is", null);
  const validacion = validarExcepcion(
    formulario,
    (existentes ?? []).map((x) => ({ paciente_id: x.paciente_id ?? "", estado: x.estado })),
  );
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const { error } = await supabase.from("reglas_cobro").insert({ ...validacion.datos, consultorio_id: consultorio.id });
  // 23505: otra pestaña la agregó recién (la base no deja repetir).
  if (error?.code === "23505") return conError({ estado: ERROR_EXCEPCION_REPETIDA }, formulario);
  if (error) return conError(ERROR_GENERAL, formulario);
  revalidatePath("/config");
  return listo();
}

/** Quita una excepción. Nunca borra una regla general (sin paciente). */
export async function quitarExcepcion(id: string): Promise<{ error: string | null }> {
  if (!esIdValido(id)) return { error: "Excepción no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("reglas_cobro")
    .delete()
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .not("paciente_id", "is", null);
  if (error) return { error: "No se pudo quitar. Probá de nuevo." };
  revalidatePath("/config");
  return { error: null };
}
