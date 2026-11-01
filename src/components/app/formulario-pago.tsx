"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResultadoPago } from "@/lib/cobro/acciones-pagos";
import { formatoGs, leerGs } from "@/lib/cobro/formato";
import { MEDIOS_PAGO, REFERENCIA_MAX, validarPago, type ErroresPago, type MedioRegistrable } from "@/lib/cobro/pago";
import { cn } from "@/lib/utils";

export type TutorParaPago = { id: string; nombre: string };

/** "290.000" (sin "Gs.") para poner en el campo. */
const sinGs = (monto: number) => formatoGs(monto).replace("Gs. ", "");

/**
 * Registrar un pago. Con `tutor` el que paga queda fijo (Cobrar ahora, cuenta del tutor);
 * si no, se elige de `tutores`. `deudaAnterior` > 0 muestra el aviso de FIFO y el botón "Poner el total".
 */
export function FormularioPago({
  hoy,
  tutor,
  tutores = [],
  montoInicial = null,
  deudaAnterior = 0,
  titulo,
  registrarPago,
  enviarOptimista,
  alVolver,
  alGuardar,
}: {
  hoy: string;
  tutor?: TutorParaPago | null;
  tutores?: TutorParaPago[];
  montoInicial?: number | null;
  deudaAnterior?: number;
  titulo?: string;
  registrarPago: (entrada: unknown) => Promise<ResultadoPago>;
  /**
   * Opcional (Cobrar ahora en la agenda y Hoy): no espera al servidor. El formulario valida
   * acá (misma validación que el servidor) y le pasa el pago a la pantalla, que lo guarda
   * de forma optimista. Sin esto, espera la respuesta (pantallas de Cobros).
   */
  enviarOptimista?: (entrada: unknown, aviso: string) => void;
  alVolver: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const [tutorId, setTutorId] = useState(tutor?.id ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [monto, setMonto] = useState(montoInicial && montoInicial > 0 ? sinGs(montoInicial) : "");
  const [medio, setMedio] = useState<MedioRegistrable | "">("");
  const [referencia, setReferencia] = useState("");
  const [errores, setErrores] = useState<ErroresPago>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const montoLeido = leerGs(monto);
  const total = (montoInicial ?? 0) + deudaAnterior;

  function guardar() {
    setError(null);
    setErrores({});
    const entrada = { tutor_id: tutorId, fecha, monto, medio, referencia };
    if (enviarOptimista) {
      const v = validarPago(entrada, hoy);
      if (!v.ok) {
        setError("Revisá los datos del pago.");
        setErrores(v.errores);
        return;
      }
      enviarOptimista(entrada, `Pago de ${formatoGs(v.datos.monto_gs)} registrado ✓`);
      return;
    }
    iniciar(async () => {
      const r = await registrarPago(entrada);
      if (r.ok) alGuardar(`Pago de ${formatoGs(leerGs(monto) ?? 0)} registrado ✓`);
      else {
        setError(r.error);
        setErrores(r.errores ?? {});
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {titulo && <p className="text-sm font-medium">{titulo}</p>}

      {tutor ? (
        <p className="text-sm">
          Paga: <strong>{tutor.nombre}</strong>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="pago-tutor">Quién paga</Label>
          <Select id="pago-tutor" value={tutorId} onChange={(e) => setTutorId(e.target.value)} aria-invalid={!!errores.tutor_id}>
            <option value="">Elegí…</option>
            {tutores.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </Select>
          {errores.tutor_id && <p className="text-sm text-destructive">{errores.tutor_id}</p>}
        </div>
      )}

      {deudaAnterior > 0 && (
        <div role="note" className="flex flex-col gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <p>
            Además debe <strong>{formatoGs(deudaAnterior)}</strong> de antes: con FIFO, este pago se usa primero para eso.
          </p>
          <Button type="button" variant="outline" className="h-12" onClick={() => setMonto(sinGs(total))} disabled={enviando}>
            Poner el total ({formatoGs(total)})
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="pago-monto">Monto (Gs.)</Label>
        <Input
          id="pago-monto"
          inputMode="numeric"
          autoComplete="off"
          placeholder="290.000"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          aria-invalid={!!errores.monto}
        />
        {errores.monto ? (
          <p className="text-sm text-destructive">{errores.monto}</p>
        ) : (
          montoLeido != null && montoLeido > 0 && <p className="text-xs text-muted-foreground">{formatoGs(montoLeido)}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Medio</span>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Medio de pago">
          {MEDIOS_PAGO.map((m) => (
            <button
              key={m.valor}
              type="button"
              aria-pressed={medio === m.valor}
              onClick={() => setMedio(m.valor)}
              className={cn("h-12 rounded-lg border text-sm active:bg-accent", medio === m.valor && "border-primary bg-primary text-primary-foreground")}
            >
              {m.texto}
            </button>
          ))}
        </div>
        {errores.medio && <p className="text-sm text-destructive">{errores.medio}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pago-fecha">Fecha</Label>
        <Input id="pago-fecha" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} aria-invalid={!!errores.fecha} />
        {errores.fecha && <p className="text-sm text-destructive">{errores.fecha}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pago-referencia">Referencia {medio === "transferencia" ? "(nº de operación)" : "(opcional)"}</Label>
        <Input
          id="pago-referencia"
          autoComplete="off"
          maxLength={REFERENCIA_MAX}
          value={referencia}
          onChange={(e) => setReferencia(e.target.value)}
          placeholder={medio === "transferencia" ? "Ej. 123456" : ""}
        />
        <p className="text-xs text-muted-foreground">Sin datos clínicos.</p>
        {errores.referencia && <p className="text-sm text-destructive">{errores.referencia}</p>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button size="touch" onClick={guardar} disabled={enviando}>
          {enviando ? "Guardando…" : "Registrar pago"}
        </Button>
        <Button variant="ghost" onClick={alVolver} disabled={enviando}>
          Volver
        </Button>
      </div>
    </div>
  );
}
