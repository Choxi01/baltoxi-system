"use client";

import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { BotonesMensaje } from "@/components/app/botones-mensaje";
import type { FilaPendiente } from "@/lib/mensajes/pendientes";
import { cn } from "@/lib/utils";

export type GrupoBandeja = { id: string; titulo: string; filas: FilaPendiente[] };

const claveDe = (f: FilaPendiente) => `${f.clave}|${f.referencia}|${f.tutorId}`;

// Bandeja de "Mensajes de hoy": cada fila con Copiar / Abrir WhatsApp; al usarla queda tachada
// al instante (y en la base, para no repetirla).
export function Bandeja({ grupos }: { grupos: GrupoBandeja[] }) {
  const [tachadas, setTachadas] = useState<Set<string>>(() => new Set());
  const tachar = (f: FilaPendiente) => setTachadas((t) => new Set(t).add(claveDe(f)));

  return (
    <div className="flex flex-col gap-6">
      {grupos.map((g) => {
        const sinEnviar = g.filas.filter((f) => !f.enviado && !tachadas.has(claveDe(f))).length;
        return (
          <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="flex flex-col gap-3">
            <h2 id={`grupo-${g.id}`} className="flex items-baseline justify-between gap-2 text-lg font-semibold">
              {g.titulo}
              {g.filas.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {sinEnviar === 0 ? "Todo enviado ✓" : `${sinEnviar} sin mandar`}
                </span>
              )}
            </h2>
            {g.filas.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">Nada para mandar</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {g.filas.map((f) => {
                  const enviado = f.enviado || tachadas.has(claveDe(f));
                  return (
                    <li key={claveDe(f)} className={cn("flex flex-col gap-2 rounded-lg border p-3", enviado && "bg-muted/40")}>
                      <div className={cn(enviado && "text-muted-foreground")}>
                        <p className={cn("font-medium", enviado && "line-through")}>{f.tutor}</p>
                        {f.pacientes && <p className="text-sm text-muted-foreground">{f.pacientes}</p>}
                      </div>
                      {f.aviso && !enviado && (
                        <p className="flex items-start gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {f.aviso}
                        </p>
                      )}
                      <BotonesMensaje mensaje={f} enviado={enviado} alEnviar={() => tachar(f)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
