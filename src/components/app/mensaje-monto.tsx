"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { BotonesMensaje } from "@/components/app/botones-mensaje";
import { formatoGs } from "@/lib/cobro/formato";
import type { IdPeriodo, MensajeMonto as Mensaje, MontoDeTutor } from "@/lib/mensajes/monto";
import { cn } from "@/lib/utils";

// Mensaje de "Monto del período" con el interruptor "Agregar detalle" (docs/mensajes.md).
// Por defecto va solo el total. Lo usan "Mensajes de hoy" y la cuenta del tutor.
export function MensajeMonto({ mensaje, enviado, alEnviar }: { mensaje: Mensaje; enviado: boolean; alEnviar: () => void }) {
  const [conDetalle, setConDetalle] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" role="switch" className="size-5 accent-primary" checked={conDetalle} onChange={(e) => setConDetalle(e.target.checked)} />
        Agregar detalle
      </label>
      <BotonesMensaje mensaje={{ ...mensaje, texto: conDetalle ? mensaje.textoConDetalle : mensaje.texto }} enviado={enviado} alEnviar={alEnviar} />
    </div>
  );
}

// En la cuenta del tutor: se elige el período y se manda el total de la familia.
export function MontoPorPeriodo({ montos, inicial }: { montos: MontoDeTutor[]; inicial: IdPeriodo }) {
  const [elegido, setElegido] = useState(inicial);
  const [enviados, setEnviados] = useState<Set<string>>(() => new Set());
  const monto = montos.find((m) => m.id === elegido) ?? montos[0];

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Período del mensaje" className="grid grid-cols-3 gap-1 rounded-lg border p-1">
        {montos.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === elegido}
            onClick={() => setElegido(m.id)}
            className={cn("h-11 rounded-md px-1 text-sm font-medium", m.id === elegido ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            {m.titulo}
          </button>
        ))}
      </div>
      {monto.aviso && (
        <p className="flex items-start gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {monto.aviso}
        </p>
      )}
      {monto.mensaje ? (
        <>
          <p className="text-sm text-muted-foreground">Total de la familia: {formatoGs(monto.total)}</p>
          <MensajeMonto
            key={monto.id}
            mensaje={monto.mensaje}
            enviado={monto.enviado || enviados.has(monto.id)}
            alEnviar={() => setEnviados((e) => new Set(e).add(monto.id))}
          />
        </>
      ) : (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nada para cobrar en este período</p>
      )}
    </div>
  );
}
