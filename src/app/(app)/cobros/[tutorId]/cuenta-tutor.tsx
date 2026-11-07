"use client";

import { Banknote } from "lucide-react";
import { useState, useTransition } from "react";

import { ListaMovimientos, ResumenCuenta } from "@/components/app/cuenta-movimientos";
import { FormularioPago, type TutorParaPago } from "@/components/app/formulario-pago";
import { MontoPorPeriodo } from "@/components/app/mensaje-monto";
import { Button } from "@/components/ui/button";
import type { ResultadoPago } from "@/lib/cobro/acciones-pagos";
import { fechaCorta, type Cuenta, type Movimiento } from "@/lib/cobro/cuenta";
import { formatoGs } from "@/lib/cobro/formato";
import type { IdPeriodo, MontoDeTutor } from "@/lib/mensajes/monto";

export function CuentaTutor({
  hoy,
  tutor,
  cuenta,
  montos,
  periodoInicial,
  registrarPago,
  borrarPago,
}: {
  hoy: string;
  tutor: TutorParaPago;
  cuenta: Cuenta;
  montos: MontoDeTutor[];
  periodoInicial: IdPeriodo;
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

  return (
    <div className="flex flex-col gap-4">
      <ResumenCuenta cuenta={cuenta} />

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

      <section aria-labelledby="mensaje-monto" className="flex flex-col gap-3">
        <h2 id="mensaje-monto" className="text-lg font-semibold">
          Mensaje de monto
        </h2>
        <MontoPorPeriodo montos={montos} inicial={periodoInicial} />
      </section>

      <h2 className="text-lg font-semibold">Movimientos</h2>
      <ListaMovimientos movimientos={cuenta.movimientos} alBorrar={borrar} borrando={borrando} />
    </div>
  );
}
