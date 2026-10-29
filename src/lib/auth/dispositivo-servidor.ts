import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { crearClienteAdmin } from "@/lib/supabase/admin";
import { formatoLlaveValido, venceDispositivo } from "./dispositivo";

// Guardar y reconocer dispositivos de confianza. Usa el cliente admin porque
// las tablas no tienen políticas: nadie las puede leer desde el navegador.

function huella(llave: string): string {
  return createHash("sha256").update(llave).digest("hex");
}

/** Crea la llave de un dispositivo nuevo y guarda su huella. Devuelve la llave (para la cookie). */
export async function recordarDispositivo(userId: string): Promise<string> {
  const admin = crearClienteAdmin();
  // Limpieza: los dispositivos vencidos de este usuario ya no sirven.
  await admin.from("dispositivos_confianza").delete().eq("user_id", userId).lt("vence_en", new Date().toISOString());

  const llave = randomBytes(32).toString("base64url");
  const { error } = await admin.from("dispositivos_confianza").insert({
    user_id: userId,
    llave_hash: huella(llave),
    vence_en: venceDispositivo(Date.now()).toISOString(),
  });
  if (error) throw new Error("No se pudo recordar el dispositivo");
  return llave;
}

/**
 * Si la llave es de este usuario y no venció, marca la sesión como de
 * confianza (así la base deja ver los datos sin el código). Devuelve true si
 * se pudo.
 */
export async function usarDispositivo(llave: string | undefined, userId: string, sessionId: string): Promise<boolean> {
  if (!formatoLlaveValido(llave)) return false;
  const admin = crearClienteAdmin();
  const { data: dispositivo } = await admin
    .from("dispositivos_confianza")
    .select("id")
    .eq("llave_hash", huella(llave))
    .eq("user_id", userId)
    .gt("vence_en", new Date().toISOString())
    .maybeSingle();
  if (!dispositivo) return false;

  const { error } = await admin
    .from("sesiones_confianza")
    .insert({ session_id: sessionId, user_id: userId, dispositivo_id: dispositivo.id });
  return !error;
}
