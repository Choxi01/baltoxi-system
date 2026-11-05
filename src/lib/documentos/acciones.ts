"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import type { EstadoFormularioPaciente } from "@/lib/pacientes/acciones";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { MAXIMO_BYTES, SEGUNDOS_LINK, esMimeGuardado, rutaDocumento, rutaValida, validarDocumento } from "./reglas";

// Documentos del expediente (tarea A7). Subida en tres pasos:
// 1. `prepararSubida` arma la ruta (nombre al azar: nada clínico en el nombre del archivo).
// 2. El navegador sube el archivo directo al bucket privado con la sesión de la profesional
//    (las políticas de 0002 solo dejan escribir en la carpeta del propio consultorio).
// 3. `registrarDocumento` verifica la ruta y que el archivo esté, y guarda la fila.
// Errores genéricos y sin datos del documento (regla de oro 7).

const BUCKET = "documentos";

export async function prepararSubida(pacienteId: string, mime: string): Promise<{ ruta: string } | { error: string }> {
  if (!esIdValido(pacienteId) || !esMimeGuardado(mime)) return { error: "No se pudo preparar la subida." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id")
    .eq("consultorio_id", consultorio.id)
    .eq("id", pacienteId)
    .maybeSingle();
  if (!paciente) return { error: "Paciente no encontrado." };
  return { ruta: rutaDocumento(consultorio.id, pacienteId, randomUUID(), mime) };
}

function conError(errores: EstadoFormularioPaciente["errores"], formulario: FormData): EstadoFormularioPaciente {
  const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

/** El formulario trae tipo, título y fecha, más `ruta` y `mime` del archivo ya subido. */
export async function registrarDocumento(
  pacienteId: string,
  _anterior: EstadoFormularioPaciente,
  formulario: FormData,
): Promise<EstadoFormularioPaciente> {
  const ruta = String(formulario.get("ruta") ?? "");
  const mime = String(formulario.get("mime") ?? "");
  const validacion = validarDocumento(formulario, hoyEnAsuncion());
  if (!validacion.ok) return conError(validacion.errores, formulario);

  const consultorio = await exigirConsultorio();
  if (!esIdValido(pacienteId) || !esMimeGuardado(mime) || !rutaValida(ruta, consultorio.id, pacienteId, mime)) {
    return conError({ general: "No se pudo guardar el documento. Probá de nuevo." }, formulario);
  }
  const supabase = await crearClienteServidor();

  // El archivo tiene que estar subido; el tamaño se toma del bucket, no del navegador.
  const carpeta = ruta.slice(0, ruta.lastIndexOf("/"));
  const nombre = ruta.slice(ruta.lastIndexOf("/") + 1);
  const { data: archivos } = await supabase.storage.from(BUCKET).list(carpeta, { search: nombre, limit: 1 });
  const archivo = archivos?.find((a) => a.name === nombre);
  const tamano = Number(archivo?.metadata?.size ?? 0);
  if (!archivo || !(tamano > 0) || tamano > MAXIMO_BYTES) {
    if (archivo) await supabase.storage.from(BUCKET).remove([ruta]);
    return conError({ general: "No se pudo subir el archivo. Probá de nuevo." }, formulario);
  }

  const { error } = await supabase.from("documentos").insert({
    consultorio_id: consultorio.id,
    paciente_id: pacienteId,
    tipo: validacion.datos.tipo,
    titulo: validacion.datos.titulo,
    fecha: validacion.datos.fecha,
    storage_path: ruta,
    mime,
    tamano_bytes: tamano,
  });
  if (error) {
    // Que no quede un archivo suelto sin fila.
    await supabase.storage.from(BUCKET).remove([ruta]);
    return conError({ general: "No se pudo guardar el documento. Probá de nuevo." }, formulario);
  }
  revalidatePath(`/pacientes/${pacienteId}`);
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, revision: ahora };
}

/** Si la subida al bucket salió bien pero la profesional canceló o falló el paso 3: borrar el archivo. */
export async function descartarSubida(pacienteId: string, ruta: string, mime: string): Promise<void> {
  const consultorio = await exigirConsultorio();
  if (!esIdValido(pacienteId) || !esMimeGuardado(mime) || !rutaValida(ruta, consultorio.id, pacienteId, mime)) return;
  const supabase = await crearClienteServidor();
  // Solo si no tiene fila (un documento ya guardado se borra con borrarDocumento).
  const { data } = await supabase.from("documentos").select("id").eq("consultorio_id", consultorio.id).eq("storage_path", ruta).maybeSingle();
  if (!data) await supabase.storage.from(BUCKET).remove([ruta]);
}

/** Link firmado de 5 minutos para ver el documento. Nunca se guarda. */
export async function linkDocumento(pacienteId: string, documentoId: string): Promise<{ url: string } | { error: string }> {
  if (!esIdValido(pacienteId) || !esIdValido(documentoId)) return { error: "Documento no encontrado." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: documento } = await supabase
    .from("documentos")
    .select("storage_path")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", documentoId)
    .maybeSingle();
  if (!documento) return { error: "Documento no encontrado." };
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(documento.storage_path, SEGUNDOS_LINK);
  if (error || !data) return { error: "No se pudo abrir el documento. Probá de nuevo." };
  return { url: data.signedUrl };
}

/** Borrar = primero el archivo, después la fila (si el archivo no se pudo borrar, no se toca nada). */
export async function borrarDocumento(pacienteId: string, documentoId: string): Promise<{ error: string | null }> {
  if (!esIdValido(pacienteId) || !esIdValido(documentoId)) return { error: "Documento no encontrado." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: documento } = await supabase
    .from("documentos")
    .select("id, storage_path")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", documentoId)
    .maybeSingle();
  if (!documento) return { error: "Documento no encontrado." };

  const { error: errorArchivo } = await supabase.storage.from(BUCKET).remove([documento.storage_path]);
  if (errorArchivo) return { error: "No se pudo borrar. Probá de nuevo." };
  const { error } = await supabase.from("documentos").delete().eq("consultorio_id", consultorio.id).eq("id", documento.id);
  if (error) return { error: "No se pudo borrar. Probá de nuevo." };
  revalidatePath(`/pacientes/${pacienteId}`);
  return { error: null };
}
