"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Formulario "de verdad" (method="post"): el navegador lo envía y cambia de
// página, así Safari reconoce el login y ofrece guardar la contraseña.
export function FormularioIngreso({ error }: { error: string | null }) {
  const [enviando, setEnviando] = useState(false);

  // Si vuelve con el botón "atrás", Safari restaura la página tal cual:
  // destrabamos el botón.
  useEffect(() => {
    const alVolver = (evento: PageTransitionEvent) => {
      if (evento.persisted) setEnviando(false);
    };
    window.addEventListener("pageshow", alVolver);
    return () => window.removeEventListener("pageshow", alVolver);
  }, []);

  return (
    <form
      method="post"
      action="/ingresar/enviar"
      onSubmit={() => setEnviando(true)}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contrasena">Contraseña</Label>
        <Input id="contrasena" name="contrasena" type="password" autoComplete="current-password" required />
      </div>
      {error && !enviando && (
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
