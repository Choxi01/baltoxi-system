import type { NextRequest } from "next/server";

import { actualizarSesion } from "@/lib/supabase/sesion";

// Next.js 16: "proxy" reemplaza a "middleware". Corre antes de cada página.
export async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos, imágenes, el manifest y los íconos de la app instalada
    // (sin esto, el iPhone recibe el login en vez del ícono).
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon/|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
