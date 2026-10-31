"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { RUTA_INICIO } from "./acceso";
import { validarNombreConsultorio } from "./consultorio";
import { opcionesCookie } from "./cookies";
import { codigoReciente, COOKIE_DISPOSITIVO, COOKIE_SESION_CONFIANZA, DURACION_DISPOSITIVO_MS } from "./dispositivo";
import { recordarDispositivo } from "./dispositivo-servidor";
import { COOKIE_ULTIMO_USO, momentosDeIngreso } from "./inactividad";
import { exigirSesionCompleta, leerConsultorio } from "./servidor";

// Cierra la sesión en el servidor. Quien la llama recarga la página entera
// (ver BotonSalir) para no dejar datos de la sesión en memoria.
// La llave del dispositivo se queda: la próxima vez alcanza con la contraseña.
export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  const almacen = await cookies();
  almacen.delete(COOKIE_ULTIMO_USO);
  almacen.delete(COOKIE_SESION_CONFIANZA);
}

// Después de poner el código: este navegador queda de confianza por 30 días.
// Solo si el código se acaba de poner (lo dice Supabase, no el navegador).
export async function confiarEnEsteDispositivo() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  // Los avisos van al registro del servidor (Netlify > Logs) sin datos personales.
  if (!claims || claims.aal !== "aal2") {
    console.warn("[dispositivo] no se recordó: la sesión no tiene el código");
    return;
  }
  if (!codigoReciente(momentosDeIngreso(claims.amr).codigoEn, Date.now())) {
    console.warn("[dispositivo] no se recordó: el código no es reciente");
    return;
  }

  const llave = await recordarDispositivo(claims.sub);
  (await cookies()).set(COOKIE_DISPOSITIVO, llave, opcionesCookie(DURACION_DISPOSITIVO_MS / 1000));
}

export type EstadoFormulario = { error: string | null };

export async function crearConsultorio(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const validacion = validarNombreConsultorio(formulario.get("nombre"));
  if (!validacion.ok) return { error: validacion.error };

  const { supabase } = await exigirSesionCompleta();
  // Si ya tiene uno (ej. tocó dos veces el botón), no crear otro. Sin caché: justo
  // después se crea, y la pantalla siguiente tiene que ver el consultorio nuevo.
  if (!(await leerConsultorio())) {
    const { error } = await supabase.rpc("crear_consultorio", { p_nombre: validacion.nombre });
    if (error) return { error: "No se pudo crear el consultorio. Probá de nuevo." };
  }
  redirect(RUTA_INICIO);
}
