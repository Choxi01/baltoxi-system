"use client";

import { Check, UserRoundPen } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

/** Aviso "Actualizado por la familia" (ficha online) con el botón Visto. */
export function AvisoFamilia({ cuando, quien, alVer }: { cuando: string; quien: string; alVer: () => Promise<{ error: string | null }> }) {
  const [ocupado, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <section role="status" className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <p className="flex items-center gap-2 text-sm font-medium">
        <UserRoundPen className="size-4 shrink-0" /> Actualizado por la familia el {cuando}
      </p>
      <p className="text-sm text-muted-foreground">Cambió: {quien}. Revisá las pestañas Datos y Tutores.</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        variant="outline"
        className="h-11 self-start"
        disabled={ocupado}
        onClick={() =>
          iniciar(async () => {
            const r = await alVer();
            setError(r.error);
          })
        }
      >
        <Check /> Visto
      </Button>
    </section>
  );
}
