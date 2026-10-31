import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "./env";
import type { Database } from "./types";

// Cliente con la service role: SALTEA RLS y ve todos los consultorios.
// Solo para el servidor y solo en estos casos (ver docs/supabase.md):
// - ficha pública y copias de seguridad, donde no hay usuario logueado;
// - dispositivos de confianza (src/lib/auth/dispositivo-servidor.ts): esas
//   tablas no tienen políticas, así nadie las lee desde el navegador.
// Para todo lo demás, crearClienteServidor(), que respeta RLS.
// "server-only" hace fallar el build si alguien lo importa desde el navegador.
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");

  return createClient<Database>(supabaseUrl(), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
