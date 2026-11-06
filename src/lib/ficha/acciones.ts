"use server";

import { revalidatePath } from "next/cache";

import { hoyEnAsuncion } from "@/lib/fechas";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarDatosTutor } from "@/lib/tutores/validacion";
import {
  MAXIMO_FALLIDOS_POR_IP,
  MAXIMO_GUARDADOS_POR_LINK,
  claveFallidos,
  claveGuardados,
  esTokenValido,
  superaLimite,
  validarHijoFicha,
  validarOtroTutor,
} from "./reglas";
import { buscarTutorPorToken, contarIntentos, hashIpDeLaSolicitud, hashSecreto, registrarIntento, type TutorFicha } from "./servidor";

// Lo que la familia guarda desde la ficha online (tarea A8a). Sin usuario logueado: cliente admin,
// siempre filtrando por el consultorio y el tutor del link, y solo columnas administrativas.
// Cada guardado marca `cambios_familia_en` para que el expediente lo avise.

export type EstadoFicha = {
  errores: Partial<Record<string, string>>;
  guardadoEn: number | null;
  revision?: number;
  enviado?: Record<string, string>;
};

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

function conError(errores: EstadoFicha["errores"], formulario: FormData): EstadoFicha {
  const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

function guardado(token: string): EstadoFicha {
  revalidatePath(`/ficha/${token}`);
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, revision: ahora };
}

/** Valida el link y los límites de intentos. Devuelve el tutor o el error para mostrar. */
async function antesDeGuardar(token: string): Promise<{ tutor: TutorFicha } | { error: string }> {
  const hashIp = await hashIpDeLaSolicitud();
  if (superaLimite(await contarIntentos(claveFallidos(hashIp)), MAXIMO_FALLIDOS_POR_IP)) {
    return { error: "Hubo demasiados intentos. Probá de nuevo en una hora." };
  }
  const tutor = await buscarTutorPorToken(token);
  if (!tutor) {
    await registrarIntento(claveFallidos(hashIp));
    return { error: "Este link no es válido. Pedile uno nuevo al consultorio." };
  }
  const clave = claveGuardados(hashSecreto(token));
  if (superaLimite(await contarIntentos(clave), MAXIMO_GUARDADOS_POR_LINK)) {
    return { error: "Hiciste muchos cambios seguidos. Probá de nuevo en una hora." };
  }
  await registrarIntento(clave);
  return { tutor };
}

/** Datos del tutor del link: nombre, contacto y datos de factura. */
export async function guardarDatosTutor(token: string, _anterior: EstadoFicha, formulario: FormData): Promise<EstadoFicha> {
  const validacion = validarDatosTutor(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);
  const previo = await antesDeGuardar(token);
  if ("error" in previo) return conError({ general: previo.error }, formulario);

  const { error } = await crearClienteAdmin()
    .from("tutores")
    .update({ ...validacion.datos, cambios_familia_en: new Date().toISOString() })
    .eq("consultorio_id", previo.tutor.consultorio_id)
    .eq("id", previo.tutor.id);
  if (error) return conError({ general: NO_SE_PUDO }, formulario);
  return guardado(token);
}

/** Un hijo del tutor del link: nombre, apellido, fecha de nacimiento y colegio (nada más). */
export async function guardarHijo(token: string, pacienteId: string, _anterior: EstadoFicha, formulario: FormData): Promise<EstadoFicha> {
  // El id del hijo también es un uuid (no se busca otra cosa).
  if (!esTokenValido(pacienteId)) return conError({ general: NO_SE_PUDO }, formulario);
  const validacion = validarHijoFicha(formulario, hoyEnAsuncion());
  if (!validacion.ok) return conError(validacion.errores, formulario);
  const previo = await antesDeGuardar(token);
  if ("error" in previo) return conError({ general: previo.error }, formulario);

  const admin = crearClienteAdmin();
  const { data: vinculo } = await admin
    .from("paciente_tutores")
    .select("paciente_id")
    .eq("consultorio_id", previo.tutor.consultorio_id)
    .eq("tutor_id", previo.tutor.id)
    .eq("paciente_id", pacienteId)
    .maybeSingle();
  if (!vinculo) return conError({ general: NO_SE_PUDO }, formulario);

  const { error } = await admin
    .from("pacientes")
    .update({ ...validacion.datos, cambios_familia_en: new Date().toISOString() })
    .eq("consultorio_id", previo.tutor.consultorio_id)
    .eq("id", vinculo.paciente_id);
  if (error) return conError({ general: NO_SE_PUDO }, formulario);
  return guardado(token);
}

/** Otro tutor (abuela, papá...) para todos los hijos del tutor del link. */
export async function agregarOtroTutor(token: string, _anterior: EstadoFicha, formulario: FormData): Promise<EstadoFicha> {
  const validacion = validarOtroTutor(formulario);
  if (!validacion.ok) return conError(validacion.errores, formulario);
  const previo = await antesDeGuardar(token);
  if ("error" in previo) return conError({ general: previo.error }, formulario);

  const admin = crearClienteAdmin();
  const consultorioId = previo.tutor.consultorio_id;
  const { data: vinculos } = await admin
    .from("paciente_tutores")
    .select("paciente_id")
    .eq("consultorio_id", consultorioId)
    .eq("tutor_id", previo.tutor.id);
  const hijos = (vinculos ?? []).map((v) => v.paciente_id);
  if (hijos.length === 0) return conError({ general: NO_SE_PUDO }, formulario);

  const ahora = new Date().toISOString();
  const { parentesco, ...datos } = validacion.datos;
  const { data: nuevo, error } = await admin
    .from("tutores")
    .insert({ ...datos, consultorio_id: consultorioId, cambios_familia_en: ahora })
    .select("id")
    .single();
  if (error || !nuevo) return conError({ general: NO_SE_PUDO }, formulario);

  const { error: errorVinculo } = await admin
    .from("paciente_tutores")
    .insert(hijos.map((paciente_id) => ({ consultorio_id: consultorioId, paciente_id, tutor_id: nuevo.id, parentesco })));
  if (errorVinculo) {
    // Que no quede un tutor suelto.
    await admin.from("tutores").delete().eq("consultorio_id", consultorioId).eq("id", nuevo.id);
    return conError({ general: NO_SE_PUDO }, formulario);
  }
  await admin.from("pacientes").update({ cambios_familia_en: ahora }).eq("consultorio_id", consultorioId).in("id", hijos);
  return guardado(token);
}
