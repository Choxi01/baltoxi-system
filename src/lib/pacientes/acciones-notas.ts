"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { EstadoFormularioPaciente } from "./acciones";
import { esIdValido } from "./datos";
import { validarNota } from "./notas";

// Notas de sesión (tarea A5). DATOS CLÍNICOS (regla de oro 7): los errores son genéricos y nunca
// llevan el texto de la nota; no se loguea nada.

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

function conError(errores: EstadoFormularioPaciente["errores"], formulario: FormData): EstadoFormularioPaciente {
  const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

function guardado(pacienteId: string): EstadoFormularioPaciente {
  revalidatePath(`/pacientes/${pacienteId}`);
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, revision: ahora };
}

/** `turnoId`: viene de "Agregar nota de esta sesión" (tiene que ser un turno de este paciente). */
export async function crearNota(
  pacienteId: string,
  turnoId: string | null,
  _anterior: EstadoFormularioPaciente,
  formulario: FormData,
): Promise<EstadoFormularioPaciente> {
  if (!esIdValido(pacienteId)) return conError({ general: "Paciente no encontrado." }, formulario);
  const validacion = validarNota(formulario, hoyEnAsuncion());
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  if (turnoId !== null) {
    const { data: turno } = esIdValido(turnoId)
      ? await supabase
          .from("turnos")
          .select("id")
          .eq("consultorio_id", consultorio.id)
          .eq("paciente_id", pacienteId)
          .eq("id", turnoId)
          .maybeSingle()
      : { data: null };
    if (!turno) return conError({ general: "Esa sesión no es de este paciente." }, formulario);
  }

  const { error } = await supabase.from("notas").insert({
    consultorio_id: consultorio.id,
    paciente_id: pacienteId,
    turno_id: turnoId,
    fecha: validacion.datos.fecha,
    texto: validacion.datos.texto,
  });
  if (error) return conError({ general: NO_SE_PUDO }, formulario);
  return guardado(pacienteId);
}

export async function actualizarNota(
  pacienteId: string,
  notaId: string,
  _anterior: EstadoFormularioPaciente,
  formulario: FormData,
): Promise<EstadoFormularioPaciente> {
  if (!esIdValido(pacienteId) || !esIdValido(notaId)) return conError({ general: "Nota no encontrada." }, formulario);
  const validacion = validarNota(formulario, hoyEnAsuncion());
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("notas")
    // La base no actualiza `actualizado_en` sola.
    .update({ ...validacion.datos, actualizado_en: new Date().toISOString() })
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", notaId)
    .select("id");
  if (error || !data?.length) return conError({ general: NO_SE_PUDO }, formulario);
  return guardado(pacienteId);
}

/** Fijar deja una sola nota fijada por paciente: la anterior se desfija. */
export async function fijarNota(pacienteId: string, notaId: string, fijar: boolean): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(notaId)) return { error: "Nota no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  if (fijar) {
    const { error } = await supabase
      .from("notas")
      .update({ fijada: false })
      .eq("consultorio_id", consultorio.id)
      .eq("paciente_id", pacienteId)
      .eq("fijada", true)
      .neq("id", notaId);
    if (error) return { error: NO_SE_PUDO };
  }
  const { data, error } = await supabase
    .from("notas")
    .update({ fijada: fijar })
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", notaId)
    .select("id");
  if (error || !data?.length) return { error: NO_SE_PUDO };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { error: null };
}

/** Borrar (con confirmación en pantalla). Queda registrado en `auditoria`. */
export async function borrarNota(pacienteId: string, notaId: string): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(notaId)) return { error: "Nota no encontrada." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("notas")
    .delete()
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", notaId)
    .select("id");
  if (error || !data?.length) return { error: "No se pudo borrar. Probá de nuevo." };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { error: null };
}
