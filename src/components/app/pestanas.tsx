"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type Pestana = { id: string; titulo: string; contenido: React.ReactNode };

// Las pestañas cambian al instante (todo el contenido ya vino del servidor) y
// la elegida queda en la dirección (?pestana=), sin recargar.
export function Pestanas({ pestanas, inicial, etiqueta }: { pestanas: Pestana[]; inicial: string; etiqueta: string }) {
  const [actual, setActual] = useState(pestanas.some((p) => p.id === inicial) ? inicial : pestanas[0].id);

  function elegir(id: string) {
    setActual(id);
    const parametros = new URLSearchParams(window.location.search);
    parametros.set("pestana", id);
    window.history.replaceState(null, "", `?${parametros}`);
  }

  return (
    <>
      <div role="tablist" aria-label={etiqueta} className="-mx-4 overflow-x-auto px-4">
        <div className="flex min-w-max gap-1 border-b">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`pestana-${p.id}`}
              aria-selected={p.id === actual}
              aria-controls={`panel-${p.id}`}
              onClick={() => elegir(p.id)}
              className={cn(
                "flex h-11 items-center border-b-2 px-3 text-sm font-medium",
                p.id === actual ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              {p.titulo}
            </button>
          ))}
        </div>
      </div>
      {pestanas.map((p) => (
        <div key={p.id} role="tabpanel" id={`panel-${p.id}`} aria-labelledby={`pestana-${p.id}`} hidden={p.id !== actual}>
          {p.contenido}
        </div>
      ))}
    </>
  );
}
