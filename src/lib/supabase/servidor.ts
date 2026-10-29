import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

// Cliente para páginas, acciones y rutas del servidor, con la sesión del
// usuario guardada en cookies. Todo lo que ve pasa por RLS.
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) {
            almacen.set(name, value, options);
          }
        } catch {
          // Desde una página no se pueden escribir cookies; el proxy ya
          // renueva la sesión en cada pedido, así que se puede ignorar.
        }
      },
    },
  });
}
