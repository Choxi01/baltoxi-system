"use client";

import { Banknote, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FormularioPago, type TutorParaPago } from "@/components/app/formulario-pago";
import { Button } from "@/components/ui/button";
import type { ResultadoPago } from "@/lib/cobro/acciones-pagos";
import type { FilaQuienDebe } from "@/lib/cobro/cuenta";
import { formatoGs } from "@/lib/cobro/formato";
import { cn } from "@/lib/utils";

const textoDias = (d: number) => (d === 1 ? "1 día" : `${d} días`);

export function ListaCobros({
  hoy,
  filas,
  totales,
  tutores,
  registrarPago,
}: {
  hoy: string;
  filas: FilaQuienDebe[];
  totales: { debenGs: number; vencidoGs: number; enAtraso: number; aFavorGs: number };
  tutores: TutorParaPago[];
  registrarPago: (entrada: unknown) => Promise<ResultadoPago>;
}) {
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border p-2">
          <dt className="text-xs text-muted-foreground">Te deben</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatoGs(totales.debenGs)}</dd>
        </div>
        <div className={cn("rounded-lg border p-2", totales.enAtraso > 0 && "border-destructive/50")}>
          <dt className="text-xs text-muted-foreground">En atraso</dt>
          <dd className={cn("text-sm font-semibold tabular-nums", totales.enAtraso > 0 && "text-destructive")}>
            {formatoGs(totales.vencidoGs)}
          </dd>
        </div>
        <div className="rounded-lg border p-2">
          <dt className="text-xs text-muted-foreground">A favor</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatoGs(totales.aFavorGs)}</dd>
        </div>
      </dl>

      {registrando ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <FormularioPago
            hoy={hoy}
            titulo="Registrar pago"
            tutores={tutores}
            registrarPago={registrarPago}
            alVolver={() => setRegistrando(false)}
            alGuardar={(texto) => {
              setRegistrando(false);
              setAviso(texto);
            }}
          />
        </div>
      ) : (
        <Button size="touch" onClick={() => (setAviso(null), setRegistrando(true))}>
          <Banknote /> Registrar pago
        </Button>
      )}
      {aviso && (
        <p role="status" className="text-sm text-muted-foreground">
          {aviso}
        </p>
      )}

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">Nadie te debe ni tiene saldo a favor.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <li key={f.tutorId}>
              <Link
                href={`/cobros/${f.tutorId}`}
                className="flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2 active:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.nombre}</p>
                  {f.saldo > 0 && f.enAtraso && (
                    <p className="text-sm text-destructive">
                      Atraso {textoDias(f.diasAtraso)} · vencido {formatoGs(f.vencidoGs)}
                    </p>
                  )}
                  {f.saldo > 0 && !f.enAtraso && <p className="text-sm text-muted-foreground">Al día (todavía no venció)</p>}
                  {f.saldo < 0 && <p className="text-sm text-emerald-700 dark:text-emerald-400">Saldo a favor</p>}
                </div>
                <span className={cn("shrink-0 font-semibold tabular-nums", f.saldo < 0 && "text-emerald-700 dark:text-emerald-400")}>
                  {formatoGs(Math.abs(f.saldo))}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
