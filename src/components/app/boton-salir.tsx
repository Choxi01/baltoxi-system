"use client";

import { Loader2, LogOut } from "lucide-react";
import { useTransition } from "react";

import { RUTA_INGRESAR } from "@/lib/auth/acceso";
import { salir } from "@/lib/auth/acciones";
import { cn } from "@/lib/utils";

// Cierra la sesión y recarga la app entera en /ingresar: así no queda nada
// de la sesión anterior en memoria (ni el cliente de Supabase ni páginas
// guardadas con datos de pacientes).
export function BotonSalir({ className }: { className?: string }) {
  const [saliendo, iniciar] = useTransition();

  function cerrarSesion() {
    if (!window.confirm("¿Cerrar sesión? Para volver a entrar vas a necesitar tu email y contraseña.")) return;
    iniciar(async () => {
      try {
        await salir();
      } finally {
        window.location.replace(RUTA_INGRESAR);
      }
    });
  }

  const Icono = saliendo ? Loader2 : LogOut;
  return (
    <button
      type="button"
      onClick={cerrarSesion}
      disabled={saliendo}
      aria-busy={saliendo}
      className={cn("flex items-center gap-3 active:opacity-70 disabled:opacity-60", className)}
    >
      <Icono className={cn("size-5", saliendo && "animate-spin")} />
      {saliendo ? "Saliendo…" : "Salir"}
    </button>
  );
}
