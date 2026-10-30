"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarTurnos } from "./datos";
import { avisosAlAgendar, horaFin, instanteUtc, textosAvisos, validarReserva } from "./reservas";

export type ResultadoAgendar =
  | { ok: true }
  /** Ya hay un turno a esa hora: la pantalla pregunta "¿Agendar igual?" y vuelve a mandar con confirmado. */
  | { ok: false; confirmar: string }
  | { ok: false; error: string };

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

/** Reservar un bloque (paciente o nombre suelto) o marcarlo ocupado. */
export async function agendar(entrada: unknown): Promise<ResultadoAgendar> {
  const validacion = validarReserva(entrada);
  if (!validacion.ok) return validacion;
  const datos = validacion.datos;

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  // El tipo de turno y el paciente tienen que ser de este consultorio.
  const tipoId = datos.clase === "ocupado" ? null : datos.tipo_turno_id;
  let modalidad: string | null = null;
  if (tipoId) {
    const { data: tipo } = await supabase
      .from("tipos_turno")
      .select("modalidad")
      .eq("consultorio_id", consultorio.id)
      .eq("id", tipoId)
      .eq("activo", true)
      .maybeSingle();
    if (!tipo) return { ok: false, error: "Elegí un tipo de turno." };
    modalidad = tipo.modalidad;
  }
  if (datos.clase === "turno") {
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("id")
      .eq("consultorio_id", consultorio.id)
      .eq("id", datos.paciente_id)
      .maybeSingle();
    if (!paciente) return { ok: false, error: "Paciente no encontrado." };
  }

  const { data: config } = await supabase
    .from("consultorios")
    .select("duracion_bloque_min, traslado_domicilio_min")
    .eq("id", consultorio.id)
    .single();
  if (!config) return { ok: false, error: NO_SE_PUDO };
  const fin = horaFin(datos.inicio, config.duracion_bloque_min);

  // Se vuelve a revisar acá por si otro dispositivo agendó en ese horario mientras tanto.
  if (!datos.confirmado) {
    const avisos = avisosAlAgendar(
      { fecha: datos.fecha, inicio: datos.inicio, fin, modalidad },
      await listarTurnos(datos.fecha, datos.fecha),
      config.traslado_domicilio_min,
    );
    const texto = textosAvisos(avisos, config.traslado_domicilio_min).superposicion;
    if (texto) return { ok: false, confirmar: texto };
  }

  const { error } = await supabase.from("turnos").insert({
    consultorio_id: consultorio.id,
    clase: datos.clase,
    paciente_id: datos.clase === "turno" ? datos.paciente_id : null,
    nombre_reserva: datos.clase === "reservado" ? datos.nombre_reserva : null,
    motivo_ocupado: datos.clase === "ocupado" ? datos.motivo_ocupado : null,
    tipo_turno_id: tipoId,
    inicio: instanteUtc(datos.fecha, datos.inicio),
    fin: instanteUtc(datos.fecha, fin),
  });
  if (error) return { ok: false, error: NO_SE_PUDO };
  revalidatePath("/agenda");
  return { ok: true };
}
