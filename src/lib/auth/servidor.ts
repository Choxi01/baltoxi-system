import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { RUTA_CODIGO, RUTA_INGRESAR, sesionVerificada } from "./acceso";
import { COOKIE_SESION_CONFIANZA } from "./dispositivo";

// Verificaciones de sesión del lado del servidor. El proxy ya redirige, pero
// cada página y acción vuelve a verificar: nunca confiar solo en el proxy.
//
// `cache()` (de React): dentro de un mismo pedido, la sesión y el consultorio se
// verifican UNA vez aunque los pidan el layout y cada lectura de la página (Next ya
// juntaba la consulta a `miembros`, pero se repetía el resto de la verificación).
// Cada pedido nuevo vuelve a verificar: no se comparte nada entre pedidos ni usuarios.

/** Exige sesión completa: con código o desde un dispositivo de confianza. */
export const exigirSesionCompleta = cache(async () => {
  // Todo lo que sigue es de cada pedido (la sesión, la hora para ver si el
  // token venció). Sin esto Next.js avisa "unstable value Date.now()" al
  // preparar la página de antemano.
  await connection();
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(RUTA_INGRESAR);
  const marca = (await cookies()).get(COOKIE_SESION_CONFIANZA)?.value;
  if (!sesionVerificada(claims, marca)) redirect(RUTA_CODIGO);
  return { userId: claims.sub, supabase };
});

/**
 * El consultorio del usuario, o null si todavía no creó ninguno. Sin caché: para
 * acciones que lo cambian (crear el consultorio) y necesitan el valor real.
 */
export async function leerConsultorio() {
  const { userId, supabase } = await exigirSesionCompleta();
  const { data, error } = await supabase
    .from("miembros")
    .select("consultorio_id, consultorios (nombre)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el consultorio");
  if (!data) return null;
  return { id: data.consultorio_id, nombre: data.consultorios?.nombre ?? "" };
}

/** Como leerConsultorio, una sola vez por pedido (para páginas y lecturas). */
export const buscarConsultorio = cache(leerConsultorio);

/** Como buscarConsultorio, pero manda a crearlo si no hay. */
export async function exigirConsultorio() {
  const consultorio = await buscarConsultorio();
  if (!consultorio) redirect("/nuevo-consultorio");
  return consultorio;
}
