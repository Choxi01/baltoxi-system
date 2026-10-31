"use client";

import { Banknote, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { FormularioPago, type TutorParaPago } from "@/components/app/formulario-pago";
import { Button } from "@/components/ui/button";
import type { ResultadoPago } from "@/lib/cobro/acciones-pagos";
import { fechaCorta, type Cuenta, type Movimiento } from "@/lib/cobro/cuenta";
import { formatoGs } from "@/lib/cobro/formato";
import { NOMBRE_MEDIO } from "@/lib/cobro/pago";
import { cn } from "@/lib/utils";

const textoDias = (d: number) => (d === 1 ? "1 día" : `${d} días`);

/** Texto del saldo acumulado: "Debe Gs. X", "A favor Gs. X" o "Al día". */
function textoSaldo(s: number): string {
  if (s > 0) return `Debe ${formatoGs(s)}`;
  if (s < 0) return `A favor ${formatoGs(-s)}`;
  return "Saldo Gs. 0";
}

export function CuentaTutor({
  hoy,
  tutor,
  cuenta,
  registrarPago,
  borrarPago,
}: {
  hoy: string;
  tutor: TutorParaPago;
  cuenta: Cuenta;
  registrarPago: (entrada: unknown) => Promise<ResultadoPago>;
  borrarPago: (id: string) => Promise<ResultadoPago>;
}) {
  const [registrando, setRegistrando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrando, iniciar] = useTransition();

  function borrar(m: Extract<Movimiento, { tipo: "pago" }>) {
    if (!window.confirm(`¿Borrar el pago de ${formatoGs(m.monto)} del ${fechaCorta(m.fecha)}? El saldo vuelve a subir.`)) return;
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await borrarPago(m.id);
      if (r.ok) setAviso("Pago borrado ✓");
      else setError(r.error);
    });
  }

  // Lo más nuevo arriba (el saldo acumulado ya viene calculado en orden de fecha).
  const movimientos = [...cuenta.movimientos].reverse();

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex flex-col gap-1 rounded-lg border p-3",
          cuenta.enAtraso && "border-destructive/50 bg-destructive/5",
          cuenta.aFavor > 0 && "border-emerald-600/40 bg-emerald-600/5",
        )}
      >
        {cuenta.saldo > 0 && (
          <>
            <p className="text-sm text-muted-foreground">Debe</p>
            <p className="text-2xl font-semibold tabular-nums">{formatoGs(cuenta.saldo)}</p>
            {cuenta.enAtraso ? (
              <p className="text-sm text-destructive">
                En atraso {textoDias(cuenta.diasAtraso)} · vencido {formatoGs(cuenta.vencidoGs)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Al día: nada vencido todavía.</p>
            )}
          </>
        )}
        {cuenta.aFavor > 0 && (
          <>
            <p className="text-sm text-muted-foreground">Saldo a favor</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatoGs(cuenta.aFavor)}</p>
            <p className="text-sm text-muted-foreground">Se usa automáticamente en las próximas sesiones.</p>
          </>
        )}
        {cuenta.saldo === 0 && <p className="text-lg font-medium">Al día · Gs. 0</p>}
      </div>

      {registrando ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <FormularioPago
            hoy={hoy}
            titulo="Registrar pago"
            tutor={tutor}
            montoInicial={cuenta.saldo > 0 ? cuenta.saldo : null}
            registrarPago={registrarPago}
            alVolver={() => setRegistrando(false)}
            alGuardar={(texto) => {
              setRegistrando(false);
              setAviso(texto);
            }}
          />
        </div>
      ) : (
        <Button size="touch" onClick={() => (setAviso(null), setError(null), setRegistrando(true))}>
          <Banknote /> Registrar pago
        </Button>
      )}
      {aviso && (
        <p role="status" className="text-sm text-muted-foreground">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <h2 className="text-lg font-semibold">Movimientos</h2>
      {movimientos.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay cargos ni pagos.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {movimientos.map((m) => (
            <li key={`${m.tipo}-${m.id}`} className="flex flex-col gap-1 rounded-lg border p-3">
              {m.tipo === "cargo" ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{m.concepto}</p>
                      {m.paciente && <p className="text-sm text-muted-foreground">{m.paciente}</p>}
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{formatoGs(m.monto)}</span>
                  </div>
                  {m.monto > 0 && m.pendiente === 0 && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      Pagado{m.cubiertoPor.length > 0 && ` (${m.cubiertoPor.map((p) => `pago del ${fechaCorta(p.fecha)}`).join(", ")})`}
                    </p>
                  )}
                  {m.pendiente > 0 && (
                    <p className={cn("text-sm", m.vencido ? "text-destructive" : "text-muted-foreground")}>
                      Pendiente {formatoGs(m.pendiente)}
                      {m.pagado > 0 && ` (pagó ${formatoGs(m.pagado)})`} · {m.vencido ? "venció" : "vence"} el {fechaCorta(m.vencimiento!)}
                    </p>
                  )}
                  {m.monto < 0 && <p className="text-sm text-muted-foreground">Ajuste a favor</p>}
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        Pago · {NOMBRE_MEDIO[m.medio] ?? m.medio}
                        {m.facturado && <span className="ml-2 text-xs text-muted-foreground">Facturado</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {fechaCorta(m.fecha)}
                        {m.referencia && ` · Ref. ${m.referencia}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">−{formatoGs(m.monto)}</span>
                  </div>
                  {m.cubre.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Cubrió: {m.cubre.map((c) => `${c.concepto} (${formatoGs(c.monto)})`).join(", ")}
                    </p>
                  )}
                  {m.sinImputar > 0 && <p className="text-sm text-emerald-700 dark:text-emerald-400">Quedó a favor {formatoGs(m.sinImputar)}</p>}
                  {!m.facturado && (
                    <Button variant="ghost" className="h-11 self-start text-destructive" onClick={() => borrar(m)} disabled={borrando}>
                      <Trash2 /> Borrar pago
                    </Button>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground">
                {m.tipo === "cargo" && `${fechaCorta(m.fecha)} · `}
                {textoSaldo(m.saldo)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
