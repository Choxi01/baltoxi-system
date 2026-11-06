"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esIdValido } from "./datos";
import { validarPaciente, type ErroresFormulario } from "./validacion";

export type EstadoFormularioPaciente = {
  errores: ErroresFormulario;
  guardadoEn: number | null;
  /** Cambia en cada envío: el formulario se vuelve a armar con los valores nuevos. */
  revision?: number;
  /** Lo que se escribió, para no perderlo si hubo un error (React vacía el formulario). */
  enviado?: Record<string, string>;
};

function conError(errores: ErroresFormulario, formulario: FormData): EstadoFormularioPaciente {
  const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

export async function crearPaciente(
  _anterior: EstadoFormularioPaciente,
  formulario: FormData,
): Promise<EstadoFormularioPaciente> {
  const validacion = validarPaciente(formulario, hoyEnAsuncion());
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  // Un paciente nuevo todavía no tiene tutores: el responsable de pago se elige después.
  const { data, error } = await supabase
    .from("pacientes")
    .insert({ ...validacion.datos, responsable_pago_id: null, consultorio_id: consultorio.id })
    .select("id")
    .single();
  if (error || !data) return conError({ general: "No se pudo guardar. Probá de nuevo." }, formulario);

  // Vino de "Crear ficha" en un "Reservado: Fulano": la reserva pasa a ser un turno del paciente.
  const reserva = String(formulario.get("reserva_id") ?? "");
  if (esIdValido(reserva)) {
    await supabase
      .from("turnos")
      .update({ clase: "turno", paciente_id: data.id, nombre_reserva: null })
      .eq("consultorio_id", consultorio.id)
      .eq("id", reserva)
      .eq("clase", "reservado");
    revalidatePath("/agenda");
  }
  revalidatePath("/pacientes");
  redirect(`/pacientes/${data.id}`);
}

export async function actualizarPaciente(
  id: string,
  _anterior: EstadoFormularioPaciente,
  formulario: FormData,
): Promise<EstadoFormularioPaciente> {
  if (!esIdValido(id)) return conError({ general: "Paciente no encontrado." }, formulario);
  const validacion = validarPaciente(formulario, hoyEnAsuncion());
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  // El responsable de pago tiene que ser uno de los tutores del paciente.
  const responsable = validacion.datos.responsable_pago_id;
  if (responsable) {
    const { data: vinculo } = await supabase
      .from("paciente_tutores")
      .select("tutor_id")
      .eq("consultorio_id", consultorio.id)
      .eq("paciente_id", id)
      .eq("tutor_id", responsable)
      .maybeSingle();
    if (!vinculo) {
      return conError({ responsable_pago_id: "Elegí uno de los tutores del paciente." }, formulario);
    }
  }

  const { error } = await supabase
    .from("pacientes")
    .update(validacion.datos)
    .eq("consultorio_id", consultorio.id)
    .eq("id", id);
  if (error) return conError({ general: "No se pudo guardar. Probá de nuevo." }, formulario);
  // Que la ficha y la lista muestren los datos nuevos.
  revalidatePath(`/pacientes/${id}`);
  revalidatePath("/pacientes");
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, revision: ahora };
}

/** "Visto": la profesional ya revisó lo que cambió la familia desde la ficha online (A8a). */
export async function marcarCambiosVistos(pacienteId: string): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId)) return { error: "Paciente no encontrado." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: vinculos } = await supabase
    .from("paciente_tutores")
    .select("tutor_id")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId);
  const [{ error }, { error: errorTutores }] = await Promise.all([
    supabase.from("pacientes").update({ cambios_familia_en: null }).eq("consultorio_id", consultorio.id).eq("id", pacienteId),
    supabase
      .from("tutores")
      .update({ cambios_familia_en: null })
      .eq("consultorio_id", consultorio.id)
      .in("id", (vinculos ?? []).map((v) => v.tutor_id)),
  ]);
  if (error || errorTutores) return { error: "No se pudo guardar. Probá de nuevo." };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { error: null };
}
