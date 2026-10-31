"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { registrarEnvio } from "@/lib/mensajes/acciones";
import type { CanalManual, MensajeListo } from "@/lib/mensajes/tipos";
import { linkWhatsApp } from "@/lib/mensajes/whatsapp";
import { cn } from "@/lib/utils";

// Vista previa de un mensaje con Copiar y Abrir WhatsApp (docs/mensajes.md).
// Cualquiera de los dos lo anota en mensajes_enviados (para tacharlo y no repetirlo).
export function BotonesMensaje({
  mensaje,
  enviado = false,
  alEnviar,
}: {
  mensaje: MensajeListo;
  /** Ya se mandó: el texto sale tachado (se puede volver a copiar igual). */
  enviado?: boolean;
  /** Se llama apenas se copia o se abre WhatsApp (para tachar sin esperar al servidor). */
  alEnviar?: () => void;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 2500);
    return () => clearTimeout(t);
  }, [aviso]);

  const link = linkWhatsApp(mensaje.telefono, mensaje.texto);

  function anotar(canal: CanalManual) {
    alEnviar?.();
    void registrarEnvio({ clave: mensaje.clave, referencia: mensaje.referencia, tutorId: mensaje.tutorId, canal }).then((r) => {
      if (!r.ok) setAviso(r.error);
    });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje.texto);
      setAviso("Copiado ✓");
      anotar("copiado");
    } catch {
      setAviso("No se pudo copiar. Mantené apretado el texto para copiarlo.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          "whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm select-text",
          enviado && "text-muted-foreground line-through",
        )}
      >
        {mensaje.texto}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={enviado ? "outline" : "default"} className="h-12" onClick={copiar}>
          {aviso === "Copiado ✓" ? <Check /> : <Copy />} Copiar
        </Button>
        {link ? (
          <Button asChild variant="outline" className="h-12">
            <a href={link} target="_blank" rel="noopener noreferrer" onClick={() => anotar("whatsapp_link")}>
              <MessageCircle /> WhatsApp
            </a>
          </Button>
        ) : (
          <Button variant="outline" className="h-12" disabled>
            Sin WhatsApp cargado
          </Button>
        )}
      </div>
      {aviso && (
        <p role="status" className="text-center text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
    </div>
  );
}
