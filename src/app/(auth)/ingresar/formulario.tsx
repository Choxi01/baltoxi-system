"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RUTA_CODIGO } from "@/lib/auth/acceso";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

export function FormularioIngreso() {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function ingresar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);

    const { error } = await crearClienteNavegador().auth.signInWithPassword({
      email: String(datos.get("email") ?? "").trim(),
      password: String(datos.get("contrasena") ?? ""),
    });

    if (error) {
      setEnviando(false);
      setError(
        error.code === "invalid_credentials"
          ? "El email o la contraseña no son correctos."
          : "No se pudo ingresar. Revisá tu conexión y probá de nuevo.",
      );
      return;
    }
    // Recarga completa (no navegación interna): así el servidor ve la sesión
    // nueva y no queda nada guardado en memoria de una sesión anterior.
    window.location.replace(RUTA_CODIGO);
  }

  return (
    <form onSubmit={ingresar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
