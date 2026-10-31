"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { MensajeListo } from "@/lib/mensajes/tipos";
import { BotonesMensaje } from "./botones-mensaje";

// Después de mover o cancelar un turno: el WhatsApp para avisarle a la familia (B5).
// No va a "Mensajes de hoy": se ofrece en el momento.
export function MensajeFamilia({ mensaje, alCerrar }: { mensaje: MensajeListo; alCerrar: () => void }) {
  const [enviado, setEnviado] = useState(false);
  return (
    <section aria-label="Avisar a la familia" className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">¿Le avisás a {mensaje.tutor}?</h2>
        <Button variant="ghost" className="size-10" aria-label="Cerrar" onClick={alCerrar}>
          <X className="size-5" />
        </Button>
      </div>
      <BotonesMensaje mensaje={mensaje} enviado={enviado} alEnviar={() => setEnviado(true)} />
      <Button variant="ghost" className="h-12" onClick={alCerrar}>
        {enviado ? "Listo" : "No avisar"}
      </Button>
    </section>
  );
}
