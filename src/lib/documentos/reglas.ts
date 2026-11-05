// Documentos del expediente (tarea A7, docs/expediente.md "Documentos").
// DATOS CLÍNICOS (regla de oro 7): el archivo se guarda con un nombre al azar (uuid), nunca con el
// título ni con el nombre original. Solo se abre con links firmados de 5 minutos.
// Funciones puras con tests.

import { z } from "zod";

import type { ErroresFormulario } from "@/lib/pacientes/validacion";

export const TIPOS_DOCUMENTO = ["cedula", "analisis", "informe", "certificado", "otro"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const NOMBRE_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  cedula: "Cédula",
  analisis: "Análisis",
  informe: "Informe",
  certificado: "Certificado",
  otro: "Otro",
};

/** Lo que se guarda en el bucket: las imágenes se pasan a JPEG en el dispositivo; el PDF va tal cual. */
export const MIMES_GUARDADOS = ["image/jpeg", "application/pdf"] as const;
export type MimeGuardado = (typeof MIMES_GUARDADOS)[number];

const EXTENSION: Record<MimeGuardado, string> = { "image/jpeg": "jpg", "application/pdf": "pdf" };

export const MAXIMO_BYTES = 15 * 1024 * 1024;
/** Lado mayor de una imagen después de achicarla. */
export const LADO_MAXIMO = 2000;
export const CALIDAD_JPEG = 0.8;
/** Vencimiento de los links para ver un documento: 5 minutos. */
export const SEGUNDOS_LINK = 300;

export function esMimeGuardado(valor: unknown): valor is MimeGuardado {
  return typeof valor === "string" && (MIMES_GUARDADOS as readonly string[]).includes(valor);
}

/**
 * Qué hacer con el archivo que eligió la profesional: una imagen (cualquier formato que el
 * navegador sepa dibujar, incluida la HEIC del iPhone) se achica y pasa a JPEG; un PDF se sube
 * tal cual si no pasa de 15 MB. Lo demás no se acepta.
 */
export function clasificarArchivo(archivo: { type: string; name: string; size: number }):
  | { ok: true; accion: "achicar" | "tal_cual" }
  | { ok: false; error: string } {
  const nombre = archivo.name.toLowerCase();
  const esPdf = archivo.type === "application/pdf" || (archivo.type === "" && nombre.endsWith(".pdf"));
  if (esPdf) {
    if (archivo.size > MAXIMO_BYTES) return { ok: false, error: "El PDF pasa de 15 MB. Probá con uno más liviano." };
    if (archivo.size <= 0) return { ok: false, error: "El archivo está vacío." };
    return { ok: true, accion: "tal_cual" };
  }
  const esImagen = archivo.type.startsWith("image/") || /\.(heic|heif)$/.test(nombre);
  if (esImagen) return { ok: true, accion: "achicar" };
  return { ok: false, error: "Solo se pueden subir fotos o PDF." };
}

/** Medidas al achicar: el lado mayor queda en `maximo` como mucho, sin agrandar nunca. */
export function medidasAchicadas(ancho: number, alto: number, maximo = LADO_MAXIMO): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto);
  if (mayor <= maximo) return { ancho, alto };
  const escala = maximo / mayor;
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

/** Ruta en el bucket: `<consultorio>/<paciente>/<uuid>.<ext>` (migración 0002). */
export function rutaDocumento(consultorioId: string, pacienteId: string, uuid: string, mime: MimeGuardado): string {
  return `${consultorioId}/${pacienteId}/${uuid}.${EXTENSION[mime]}`;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Que la ruta sea exactamente una de las que arma `rutaDocumento` para ese consultorio, paciente y tipo de archivo. */
export function rutaValida(ruta: string, consultorioId: string, pacienteId: string, mime: MimeGuardado): boolean {
  const patron = new RegExp(`^${UUID}\\.${EXTENSION[mime]}$`);
  const prefijo = `${consultorioId}/${pacienteId}/`;
  return ruta.startsWith(prefijo) && patron.test(ruta.slice(prefijo.length));
}

const esquemaDocumento = (hoy: string) =>
  z.object({
    tipo: z.enum(TIPOS_DOCUMENTO, "Elegí el tipo de documento."),
    titulo: z.string().trim().min(1, "Escribí un título.").max(120, "Título: hasta 120 letras."),
    // Vacía = sin fecha.
    fecha: z
      .string()
      .transform((v) => (v.trim() === "" ? null : v.trim()))
      .refine((v) => v === null || esFecha(v), "Esa fecha no existe.")
      .refine((v) => v === null || v <= hoy, "La fecha no puede ser futura."),
  });

export type DatosDocumento = { tipo: TipoDocumento; titulo: string; fecha: string | null };

function esFecha(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const prueba = new Date(Date.UTC(a, mes - 1, d));
  return prueba.getUTCFullYear() === a && prueba.getUTCMonth() === mes - 1 && prueba.getUTCDate() === d;
}

/** Tipo, título y fecha del formulario. `hoy`: "AAAA-MM-DD" en Asunción. */
export function validarDocumento(
  formulario: FormData,
  hoy: string,
): { ok: true; datos: DatosDocumento } | { ok: false; errores: ErroresFormulario } {
  const resultado = esquemaDocumento(hoy).safeParse({
    tipo: String(formulario.get("tipo") ?? ""),
    titulo: String(formulario.get("titulo") ?? ""),
    fecha: String(formulario.get("fecha") ?? ""),
  });
  if (resultado.success) return { ok: true, datos: resultado.data };
  const errores: ErroresFormulario = {};
  for (const problema of resultado.error.issues) errores[String(problema.path[0] ?? "general")] ??= problema.message;
  return { ok: false, errores };
}

/** 1536 → "1,5 KB"; 2_400_000 → "2,3 MB". */
export function textoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toLocaleString("es-PY", { maximumFractionDigits: 1 })} KB`;
  return `${(kb / 1024).toLocaleString("es-PY", { maximumFractionDigits: 1 })} MB`;
}
