"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CLAVES, LARGO_MAXIMO_PLANTILLA, variablesDesconocidas } from "./plantillas";

export type ResultadoMensaje = { ok: true } | { ok: false; error: string };

const NO_SE_PUDO = "No se pudo guardar. Probá de nuevo.";

/** Guarda el texto de una plantilla (Configuración → Mensajes). */
export async function guardarPlantilla(clave: string, texto: string): Promise<ResultadoMensaje> {
  const c = z.enum(CLAVES).safeParse(clave);
  if (!c.success || typeof texto !== "string") return { ok: false, error: "Faltan datos." };
  const limpio = texto.replace(/\r\n/g, "\n").trim();
  if (!limpio) return { ok: false, error: "El mensaje no puede quedar vacío." };
  if (limpio.length > LARGO_MAXIMO_PLANTILLA) return { ok: false, error: `Máximo ${LARGO_MAXIMO_PLANTILLA} caracteres.` };
  const desconocidas = variablesDesconocidas(limpio, c.data);
  if (desconocidas.length > 0) {
    const lista = desconocidas.map((v) => `{${v}}`).join(", ");
    return { ok: false, error: `${desconocidas.length === 1 ? "Esta variable no existe" : "Estas variables no existen"}: ${lista}. Usá los botones de abajo.` };
  }

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("plantillas_mensaje")
    .upsert({ consultorio_id: consultorio.id, clave: c.data, texto: limpio }, { onConflict: "consultorio_id,clave" });
  if (error) return { ok: false, error: NO_SE_PUDO };
  revalidatePath("/config");
  revalidatePath("/mensajes");
  revalidatePath("/agenda");
  return { ok: true };
}

const esEnvio = z.object({
  clave: z.enum(CLAVES),
  // Id del turno, "AAAA-MM", "AAAA-Www" o "AAAA-MM-DD".
  referencia: z.union([z.uuid(), z.string().regex(/^\d{4}-(\d{2}|W\d{2}|\d{2}-\d{2})$/)]),
  tutorId: z.uuid(),
  canal: z.enum(["copiado", "whatsapp_link"]),
});

/**
 * Anota que un mensaje se copió o se abrió en WhatsApp (para tacharlo y no repetirlo).
 * Si ya estaba anotado no hace nada: cuenta el primer envío.
 */
export async function registrarEnvio(entrada: {
  clave: string;
  referencia: string;
  tutorId: string;
  canal: "copiado" | "whatsapp_link";
}): Promise<ResultadoMensaje> {
  const e = esEnvio.safeParse(entrada);
  if (!e.success) return { ok: false, error: "Faltan datos." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("mensajes_enviados").upsert(
    {
      consultorio_id: consultorio.id,
      clave: e.data.clave,
      referencia: e.data.referencia,
      tutor_id: e.data.tutorId,
      canal: e.data.canal,
    },
    { onConflict: "consultorio_id,clave,referencia,tutor_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "No se pudo anotar el envío." };
  revalidatePath("/mensajes");
  return { ok: true };
}
