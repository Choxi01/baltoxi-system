"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PARENTESCOS, validarTutor } from "./validacion";

export type EstadoFormularioTutor = {
  errores: Partial<Record<string, string>>;
  guardadoEn: number | null;
  revision?: number;
  enviado?: Record<string, string>;
};

function conError(errores: EstadoFormularioTutor["errores"], formulario?: FormData): EstadoFormularioTutor {
  const enviado = formulario ? Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)])) : undefined;
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

function listo(pacienteId: string): EstadoFormularioTutor {
  revalidatePath(`/pacientes/${pacienteId}`);
  revalidatePath("/pacientes");
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, revision: ahora };
}

const ERROR_GENERAL = { general: "No se pudo guardar. Probá de nuevo." };

async function contexto(pacienteId: string) {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id, responsable_pago_id")
    .eq("consultorio_id", consultorio.id)
    .eq("id", pacienteId)
    .maybeSingle();
  return { consultorio, supabase, paciente };
}

/** Si el paciente no tiene responsable de pago, el primer tutor que se agrega queda como responsable. */
async function responsableSiFalta(ctx: Awaited<ReturnType<typeof contexto>>, tutorId: string) {
  if (ctx.paciente && !ctx.paciente.responsable_pago_id) {
    await ctx.supabase
      .from("pacientes")
      .update({ responsable_pago_id: tutorId })
      .eq("consultorio_id", ctx.consultorio.id)
      .eq("id", ctx.paciente.id);
  }
}

/** Crea un tutor nuevo y lo vincula al paciente. */
export async function agregarTutorNuevo(
  pacienteId: string,
  _anterior: EstadoFormularioTutor,
  formulario: FormData,
): Promise<EstadoFormularioTutor> {
  if (!esIdValido(pacienteId)) return conError({ general: "Paciente no encontrado." });
  const validacion = validarTutor(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const ctx = await contexto(pacienteId);
  if (!ctx.paciente) return conError({ general: "Paciente no encontrado." });
  const { parentesco, ...datos } = validacion.datos;

  const { data: tutor, error } = await ctx.supabase
    .from("tutores")
    .insert({ ...datos, consultorio_id: ctx.consultorio.id })
    .select("id")
    .single();
  if (error || !tutor) return conError(ERROR_GENERAL, formulario);

  const { error: errorVinculo } = await ctx.supabase
    .from("paciente_tutores")
    .insert({ consultorio_id: ctx.consultorio.id, paciente_id: pacienteId, tutor_id: tutor.id, parentesco });
  if (errorVinculo) {
    await ctx.supabase.from("tutores").delete().eq("consultorio_id", ctx.consultorio.id).eq("id", tutor.id); // no dejar un tutor suelto
    return conError(ERROR_GENERAL, formulario);
  }
  await responsableSiFalta(ctx, tutor.id);
  return listo(pacienteId);
}

/** Vincula un tutor que ya existe (ej. el hermano ya está cargado). */
export async function vincularTutorExistente(
  pacienteId: string,
  _anterior: EstadoFormularioTutor,
  formulario: FormData,
): Promise<EstadoFormularioTutor> {
  const tutorId = String(formulario.get("tutor_id") ?? "");
  const parentesco = String(formulario.get("parentesco") ?? "");
  const errores: EstadoFormularioTutor["errores"] = {};
  if (!esIdValido(tutorId)) errores.tutor_id = "Elegí un tutor de la lista.";
  if (!PARENTESCOS.includes(parentesco as (typeof PARENTESCOS)[number])) errores.parentesco = "Elegí el parentesco.";
  if (!esIdValido(pacienteId)) errores.general = "Paciente no encontrado.";
  if (Object.keys(errores).length) return conError(errores, formulario);

  const ctx = await contexto(pacienteId);
  if (!ctx.paciente) return conError({ general: "Paciente no encontrado." });
  const { error } = await ctx.supabase
    .from("paciente_tutores")
    .insert({ consultorio_id: ctx.consultorio.id, paciente_id: pacienteId, tutor_id: tutorId, parentesco });
  if (error) return conError(ERROR_GENERAL, formulario);
  await responsableSiFalta(ctx, tutorId);
  return listo(pacienteId);
}

/** Edita los datos del tutor (valen para todos sus hijos) y el parentesco con este paciente. */
export async function actualizarTutor(
  pacienteId: string,
  tutorId: string,
  _anterior: EstadoFormularioTutor,
  formulario: FormData,
): Promise<EstadoFormularioTutor> {
  if (!esIdValido(pacienteId) || !esIdValido(tutorId)) return conError({ general: "Tutor no encontrado." });
  const validacion = validarTutor(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);
  const { parentesco, ...datos } = validacion.datos;

  const ctx = await contexto(pacienteId);
  const [{ error }, { error: errorVinculo }] = await Promise.all([
    ctx.supabase.from("tutores").update(datos).eq("consultorio_id", ctx.consultorio.id).eq("id", tutorId),
    ctx.supabase
      .from("paciente_tutores")
      .update({ parentesco })
      .eq("consultorio_id", ctx.consultorio.id)
      .eq("paciente_id", pacienteId)
      .eq("tutor_id", tutorId),
  ]);
  if (error || errorVinculo) return conError(ERROR_GENERAL, formulario);
  return listo(pacienteId);
}

/** Saca el tutor de este paciente (el tutor sigue existiendo para sus otros hijos y sus cobros). */
export async function quitarTutor(pacienteId: string, tutorId: string): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(tutorId)) return { error: "Tutor no encontrado." };
  const ctx = await contexto(pacienteId);
  if (!ctx.paciente) return { error: "Paciente no encontrado." };
  if (ctx.paciente.responsable_pago_id === tutorId) {
    await ctx.supabase
      .from("pacientes")
      .update({ responsable_pago_id: null })
      .eq("consultorio_id", ctx.consultorio.id)
      .eq("id", pacienteId);
  }
  const { error } = await ctx.supabase
    .from("paciente_tutores")
    .delete()
    .eq("consultorio_id", ctx.consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("tutor_id", tutorId);
  if (error) return { error: "No se pudo quitar. Probá de nuevo." };
  listo(pacienteId);
  return { error: null };
}

/** Marca a este tutor como el que paga las sesiones del paciente. */
export async function marcarResponsable(pacienteId: string, tutorId: string): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(tutorId)) return { error: "Tutor no encontrado." };
  const ctx = await contexto(pacienteId);
  const { data: vinculo } = await ctx.supabase
    .from("paciente_tutores")
    .select("tutor_id")
    .eq("consultorio_id", ctx.consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  if (!vinculo) return { error: "Ese tutor no es de este paciente." };
  const { error } = await ctx.supabase
    .from("pacientes")
    .update({ responsable_pago_id: tutorId })
    .eq("consultorio_id", ctx.consultorio.id)
    .eq("id", pacienteId);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };
  listo(pacienteId);
  return { error: null };
}
