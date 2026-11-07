"use client";

import { Check, ChevronLeft, ChevronRight, Copy, Download, FileCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inicioDeMes, tituloMes } from "@/lib/agenda/calendario";
import type { ResultadoFactura } from "@/lib/cobro/acciones-facturas";
import { fechaCorta } from "@/lib/cobro/cuenta";
import type { FacturaDelMes, FilaParaFacturar } from "@/lib/cobro/datos-facturar";
import { textoDeshacer, textoMedios } from "@/lib/cobro/facturar";
import { formatoGs } from "@/lib/cobro/formato";

type Marcar = (entrada: { tutorId: string; mes: string; numero: string; montoVisto: number }) => Promise<ResultadoFactura>;

const aParametro = (mes: string) => mes.slice(0, 7);

/** Un dato con su botón Copiar. Sin valor, muestra qué falta. `copiar` es lo que va al portapapeles si difiere de lo que se ve. */
function Campo({ etiqueta, valor, copiar, falta }: { etiqueta: string; valor: string | null; copiar?: string; falta?: string }) {
  const [estado, setEstado] = useState<"copiado" | "error" | null>(null);
  useEffect(() => {
    if (!estado) return;
    const t = setTimeout(() => setEstado(null), 2500);
    return () => clearTimeout(t);
  }, [estado]);

  async function alCopiar() {
    try {
      await navigator.clipboard.writeText(copiar ?? valor ?? "");
      setEstado("copiado");
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="flex items-center gap-2 border-t py-1.5 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        {valor ? <p className="break-words select-text">{valor}</p> : <p className="text-destructive">{falta ?? "Sin cargar"}</p>}
        {estado === "error" && (
          <p role="status" className="text-sm text-destructive">
            No se pudo copiar. Mantené apretado el texto para copiarlo.
          </p>
        )}
      </div>
      {valor && (
        <Button variant="outline" className="size-11" onClick={alCopiar} aria-label={`Copiar ${etiqueta}`}>
          {estado === "copiado" ? <Check /> : <Copy />}
        </Button>
      )}
    </div>
  );
}

function TarjetaFamilia({
  fila,
  mes,
  marcarFacturado,
  alMarcar,
}: {
  fila: FilaParaFacturar;
  mes: string;
  marcarFacturado: Marcar;
  alMarcar: (texto: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [numero, setNumero] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await marcarFacturado({ tutorId: fila.tutor_id, mes: aParametro(mes), numero, montoVisto: fila.monto });
      if (r.ok) alMarcar(`${fila.tutor}: facturado ✓`);
      else setError(r.error);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      {fila.yaTieneFactura && (
        <p className="rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground">
          Ya tiene factura este mes: estos pagos entraron después.
        </p>
      )}
      <div>
        <Campo etiqueta="Tutor" valor={fila.tutor} />
        <Campo etiqueta={fila.doc_tipo ?? "Documento"} valor={fila.documento} falta="Falta RUC o CI" />
        <Campo etiqueta="Razón social" valor={fila.razon_social} />
        <Campo etiqueta="Email" valor={fila.email} />
        <Campo etiqueta="Monto total" valor={formatoGs(fila.monto)} copiar={String(fila.monto)} />
        <Campo etiqueta="IVA 10%" valor={formatoGs(fila.iva)} copiar={String(fila.iva)} />
        <Campo etiqueta="Medios de pago" valor={textoMedios(fila.medios)} />
        <Campo etiqueta="Concepto" valor={fila.concepto} />
      </div>

      {abierto ? (
        <form onSubmit={guardar} className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
          <label htmlFor={`numero-${fila.tutor_id}`} className="text-sm font-medium">
            Número de factura
          </label>
          <Input
            id={`numero-${fila.tutor_id}`}
            className="h-12 text-base"
            inputMode="numeric"
            autoComplete="off"
            placeholder="001-001-0000123"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            aria-invalid={!!error}
            autoFocus
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={() => (setAbierto(false), setError(null))} disabled={guardando}>
              Volver
            </Button>
            <Button type="submit" className="h-12" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      ) : (
        <Button size="touch" onClick={() => setAbierto(true)}>
          <FileCheck /> Marcar facturado
        </Button>
      )}
    </li>
  );
}

export function ListaFacturar({
  mes,
  esMesActual,
  sinTerminar,
  filas,
  facturas,
  marcarFacturado,
  deshacerFactura,
}: {
  mes: string;
  esMesActual: boolean;
  sinTerminar: boolean;
  filas: FilaParaFacturar[];
  facturas: FacturaDelMes[];
  marcarFacturado: Marcar;
  deshacerFactura: (id: string) => Promise<ResultadoFactura>;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deshaciendo, iniciar] = useTransition();

  function deshacer(f: FacturaDelMes) {
    if (!window.confirm(textoDeshacer(f.numero))) return;
    setAviso(null);
    setError(null);
    iniciar(async () => {
      const r = await deshacerFactura(f.id);
      if (r.ok) setAviso(`Factura ${f.numero} sacada de la app ✓`);
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Mes de cobro" className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" className="size-12">
          <Link href={`/facturar?mes=${aParametro(inicioDeMes(mes, -1))}`} aria-label="Mes anterior">
            <ChevronLeft />
          </Link>
        </Button>
        <p className="text-lg font-semibold">{tituloMes(mes)}</p>
        {esMesActual ? (
          <Button variant="outline" className="size-12" disabled aria-label="Mes siguiente">
            <ChevronRight />
          </Button>
        ) : (
          <Button asChild variant="outline" className="size-12">
            <Link href={`/facturar?mes=${aParametro(inicioDeMes(mes, 1))}`} aria-label="Mes siguiente">
              <ChevronRight />
            </Link>
          </Button>
        )}
      </nav>

      {sinTerminar && <p className="text-sm text-muted-foreground">Todavía pueden entrar pagos este mes.</p>}

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

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">No hay pagos sin factura en este mes.</p>
      ) : (
        <>
          {/* <a> común: es una descarga, no una navegación de la app. */}
          <Button asChild variant="outline" size="touch">
            <a href={`/facturar/excel?mes=${aParametro(mes)}`} download>
              <Download /> Descargar Excel
            </a>
          </Button>
          <ul className="flex flex-col gap-3">
            {filas.map((f) => (
              <TarjetaFamilia
                key={f.tutor_id}
                fila={f}
                mes={mes}
                marcarFacturado={marcarFacturado}
                alMarcar={(texto) => (setError(null), setAviso(texto))}
              />
            ))}
          </ul>
        </>
      )}

      {facturas.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Ya facturadas</h2>
          <ul className="flex flex-col gap-2">
            {facturas.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.tutor}</p>
                  <p className="text-sm text-muted-foreground">
                    {f.numero} · {fechaCorta(f.emitida_en)}
                  </p>
                  <p className="text-sm tabular-nums">{formatoGs(f.monto)}</p>
                </div>
                <Button variant="ghost" className="h-11 shrink-0 text-destructive" onClick={() => deshacer(f)} disabled={deshaciendo}>
                  <Undo2 /> Deshacer
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
