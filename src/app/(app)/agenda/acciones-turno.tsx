"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResultadoAgendar, ResultadoSimple } from "@/lib/agenda/acciones-turnos";
import { validarExcepcion, type AccionAsistencia, type Excepcion } from "@/lib/agenda/asistencia";
import { aHora, aMinutos, horaCorta } from "@/lib/agenda/bloques";
import { fechasEntre, sumarDias, tituloDia } from "@/lib/agenda/calendario";
import { datosCancelacion, mostrarSeCobra, MOTIVO_AL_CANCELAR, validarNoSeCobra, type MontoAvisoTardio, type NoSeCobra, type QuienCancela } from "@/lib/agenda/cancelacion";
import { horaFin, instanteUtc } from "@/lib/agenda/reservas";
import { aHoraLocal, NOMBRE_ESTADO_TURNO, textoTurno, type TurnoAgenda } from "@/lib/agenda/turnos";
import type { ResultadoPago } from "@/lib/cobro/acciones-pagos";
import { clasificarCancelacion } from "@/lib/cobro/cancelacion";
import { formatoGs } from "@/lib/cobro/formato";
import { cn } from "@/lib/utils";
import type { Ejecutar } from "./turnos-optimistas";

export type AccionesDeTurno = {
  libresDelDia: (fecha: string) => Promise<{ ok: true; libres: string[]; bloqueo: string | null } | { ok: false; error: string }>;
  moverTurno: (id: string, fecha: string, inicio: string) => Promise<ResultadoSimple>;
  montoSiSeCobra: (id: string) => Promise<MontoAvisoTardio>;
  cancelarTurno: (id: string, quien: QuienCancela, aviso: { fecha: string; hora: string } | null, noSeCobra?: NoSeCobra | null) => Promise<ResultadoSimple>;
  quitarTurno: (id: string) => Promise<ResultadoSimple>;
  marcarAsistencia: (id: string, accion: AccionAsistencia, excepcion?: Excepcion | null) => Promise<ResultadoSimple>;
  crearSerie: (entrada: unknown) => Promise<ResultadoAgendar>;
  finalizarSerie: (serieId: string) => Promise<ResultadoSimple>;
  registrarPago: (entrada: unknown) => Promise<ResultadoPago>;
};

// Una sola rueda con los días (más cómoda en el iPhone que un calendario).
function RuedaDia({ id, dias, valor, alCambiar }: { id: string; dias: string[]; valor: string; alCambiar: (f: string) => void }) {
  return (
    <Select id={id} value={valor} onChange={(e) => alCambiar(e.target.value)}>
      {dias.map((f) => (
        <option key={f} value={f}>
          {tituloDia(f)}
        </option>
      ))}
    </Select>
  );
}

/** Mover: elegir el día y uno de sus bloques libres. */
export function FormularioMover({
  turno,
  hoy,
  acciones,
  ejecutar,
  alVolver,
}: {
  turno: TurnoAgenda;
  hoy: string;
  acciones: AccionesDeTurno;
  ejecutar: Ejecutar;
  alVolver: () => void;
}) {
  // De hoy a 3 meses (y el día del turno, si ya pasó).
  const dias = fechasEntre(turno.fecha < hoy ? turno.fecha : hoy, sumarDias(hoy, 90));
  const [fecha, setFecha] = useState(turno.fecha);
  const [libres, setLibres] = useState<string[] | null>(null);
  const [bloqueo, setBloqueo] = useState<string | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, iniciarBusqueda] = useTransition();

  function buscar(nueva: string) {
    setFecha(nueva);
    setElegido(null);
    setError(null);
    iniciarBusqueda(async () => {
      const r = await acciones.libresDelDia(nueva);
      if (r.ok) {
        setLibres(r.libres);
        setBloqueo(r.bloqueo);
      } else setError(r.error);
    });
  }

  function mover() {
    if (!elegido) return;
    // Misma duración que el turno (igual que el servidor).
    const duracion = aMinutos(turno.fin) - aMinutos(turno.inicio);
    const fin = horaFin(elegido, duracion > 0 ? duracion : 45);
    ejecutar(
      { tipo: "mover", id: turno.id, fecha, inicio: elegido, fin },
      () => acciones.moverTurno(turno.id, fecha, elegido),
      `Movido al ${tituloDia(fecha).toLowerCase()} a las ${horaCorta(elegido)} ✓`,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Mover <strong>{textoTurno(turno)}</strong>
        {turno.clase === "turno" && " (el turno original queda como reprogramado, sin costo)"}.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="mover-dia">Día</Label>
        <RuedaDia id="mover-dia" dias={dias} valor={fecha} alCambiar={buscar} />
      </div>
      {libres === null && !buscando && (
        <Button variant="outline" className="h-12" onClick={() => buscar(fecha)}>
          Ver horarios libres
        </Button>
      )}
      {buscando && <p className="text-sm text-muted-foreground">Buscando horarios libres…</p>}
      {!buscando && libres !== null && (
        <>
          {bloqueo && <p className="text-sm text-muted-foreground">Sin agenda: {bloqueo}.</p>}
          {!bloqueo && libres.length === 0 && <p className="text-sm text-muted-foreground">No hay horarios libres ese día.</p>}
          {libres.length > 0 && (
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Horarios libres">
              {libres.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={elegido === h}
                  onClick={() => setElegido(h)}
                  className={cn(
                    "h-12 rounded-lg border text-sm tabular-nums active:bg-accent",
                    elegido === h && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {horaCorta(h)}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {elegido && (
          <Button size="touch" onClick={mover}>
            Mover a las {horaCorta(elegido)}
          </Button>
        )}
        <Button variant="ghost" onClick={alVolver}>
          Volver
        </Button>
      </div>
    </div>
  );
}

/** Cancelar: quién canceló y, si fue la familia, cuándo avisó y (si avisó tarde) si se cobra. */
export function FormularioCancelar({
  turno,
  hoy,
  horasAvisoMinimas,
  acciones,
  ejecutar,
  alVolver,
}: {
  turno: TurnoAgenda;
  hoy: string;
  horasAvisoMinimas: number;
  acciones: AccionesDeTurno;
  ejecutar: Ejecutar;
  alVolver: () => void;
}) {
  const [quien, setQuien] = useState<QuienCancela | null>(null);
  // Cuándo avisó: arranca en "ahora" (hora de Asunción, redondeada a 15 minutos).
  const [avisoFecha, setAvisoFecha] = useState(hoy);
  const [avisoHora, setAvisoHora] = useState(() => {
    const ahora = aMinutos(aHoraLocal(new Date().toISOString()).hora);
    return aHora(ahora - (ahora % 15));
  });

  // "¿Se cobra?" (B9). Por defecto sí; el monto lo calcula el servidor.
  const [monto, setMonto] = useState<MontoAvisoTardio | undefined>(undefined);
  const [seCobra, setSeCobra] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [buscandoMonto, iniciarMonto] = useTransition();

  function elegirQuien(valor: QuienCancela) {
    setQuien(valor);
    if (valor !== "familia" || monto !== undefined || buscandoMonto) return;
    iniciarMonto(async () => {
      try {
        setMonto(await acciones.montoSiSeCobra(turno.id));
      } catch {
        setMonto("desconocido");
      }
    });
  }

  // Días para elegir: dos semanas antes del turno (o de hoy) hasta hoy.
  const desde = sumarDias(turno.fecha < hoy ? turno.fecha : hoy, -14);
  const dias = fechasEntre(desde, hoy).reverse();
  const horas = Array.from({ length: 24 * 4 }, (_, i) => aHora(i * 15));

  const clasificacion = clasificarCancelacion({
    inicio: new Date(instanteUtc(turno.fecha, turno.inicio)),
    avisoEn: new Date(instanteUtc(avisoFecha, avisoHora)),
    horasAvisoMinimas,
  });

  // Mientras llega el monto la pregunta ya se ve (sin el número): así no se confirma sin verla.
  const preguntar = mostrarSeCobra(quien, clasificacion, monto);

  function confirmar() {
    if (!quien) return;
    setError(null);
    const v = validarNoSeCobra(preguntar && !seCobra ? { motivo } : null);
    if (!v.ok) return setError(v.error);
    const noSeCobra = v.datos;
    const aviso = quien === "familia" ? { fecha: avisoFecha, hora: avisoHora } : null;
    // Lo mismo que va a guardar el servidor (con aviso, aviso tardío o "Cancelé yo").
    const { estado, porcentaje_manual: porcentaje } = datosCancelacion(
      quien,
      { inicio: new Date(instanteUtc(turno.fecha, turno.inicio)) },
      aviso ? new Date(instanteUtc(aviso.fecha, aviso.hora)) : new Date(),
      horasAvisoMinimas,
      noSeCobra,
    );
    ejecutar(
      { tipo: "cancelar", id: turno.id, estado, porcentaje },
      () => acciones.cancelarTurno(turno.id, quien, aviso, noSeCobra),
      quien === "profesional" ? "Cancelado ✓ Quedó en «Para reponer»." : noSeCobra ? "Cancelado ✓ No se cobra." : "Cancelado ✓",
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Cancelar la sesión de <strong>{turno.titulo}</strong> ({horaCorta(turno.inicio)}). El horario queda libre.
      </p>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Quién canceló">
        {(
          [
            ["familia", "Canceló la familia"],
            ["profesional", "Cancelé yo"],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={quien === valor}
            onClick={() => elegirQuien(valor)}
            className={cn("h-12 rounded-lg border px-2 text-sm active:bg-accent", quien === valor && "border-primary bg-primary text-primary-foreground")}
          >
            {texto}
          </button>
        ))}
      </div>

      {quien === "familia" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">¿Cuándo avisó?</legend>
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <Select aria-label="Día del aviso" value={avisoFecha} onChange={(e) => setAvisoFecha(e.target.value)}>
              {dias.map((f) => (
                <option key={f} value={f}>
                  {f === hoy ? "Hoy" : tituloDia(f)}
                </option>
              ))}
            </Select>
            <Select aria-label="Hora del aviso" value={avisoHora} onChange={(e) => setAvisoHora(e.target.value)}>
              {horas.map((h) => (
                <option key={h} value={h}>
                  {horaCorta(h)}
                </option>
              ))}
            </Select>
          </div>
          <p className="rounded-md bg-muted px-3 py-2 text-sm">
            {clasificacion === "ausente_con_aviso"
              ? `Avisó con ${horasAvisoMinimas} h o más: cancelación con aviso.`
              : `Avisó con menos de ${horasAvisoMinimas} h: aviso tardío.`}
          </p>
        </fieldset>
      )}
      {preguntar && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">¿Se cobra?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [true, typeof monto === "number" ? `Se cobra (${formatoGs(monto)})` : "Se cobra"],
                [false, "No se cobra"],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={String(valor)}
                type="button"
                aria-pressed={seCobra === valor}
                onClick={() => setSeCobra(valor)}
                className={cn("min-h-12 rounded-lg border px-2 py-1 text-sm active:bg-accent", seCobra === valor && "border-primary bg-primary text-primary-foreground")}
              >
                {texto}
              </button>
            ))}
          </div>
          {!seCobra && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cancelar-motivo">Motivo (opcional)</Label>
              <Input
                id="cancelar-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={MOTIVO_AL_CANCELAR}
                maxLength={200}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Sin datos clínicos: este texto se guarda junto al cobro.</p>
            </div>
          )}
        </fieldset>
      )}
      {quien === "profesional" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">Va a aparecer en «Para reponer este mes» hasta que le des otro turno.</p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        {quien && (
          <Button size="touch" variant="destructive" onClick={confirmar}>
            Confirmar cancelación
          </Button>
        )}
        <Button variant="ghost" onClick={alVolver}>
          Volver
        </Button>
      </div>
    </div>
  );
}

/** Excepción "a criterio": otro porcentaje para este turno, con motivo (docs/reglas-cobro.md sección 3). */
export function FormularioExcepcion({
  turno,
  acciones,
  ejecutar,
  alVolver,
}: {
  turno: TurnoAgenda;
  acciones: AccionesDeTurno;
  ejecutar: Ejecutar;
  alVolver: () => void;
}) {
  const [porcentaje, setPorcentaje] = useState(turno.porcentajeManual != null ? String(turno.porcentajeManual) : "");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    setError(null);
    const v = validarExcepcion({ porcentaje: porcentaje.trim() === "" ? Number.NaN : Number(porcentaje), motivo });
    if (!v.ok) return setError(v.error);
    ejecutar(
      { tipo: "excepcion", id: turno.id, porcentaje: v.datos.porcentaje },
      () => acciones.marcarAsistencia(turno.id, "excepcion", v.datos),
      `Excepción ${v.datos.porcentaje}% ✓`,
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Excepción para <strong>{turno.titulo}</strong> ({NOMBRE_ESTADO_TURNO[turno.estado]}): ¿qué porcentaje se cobra?
      </p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Porcentajes rápidos">
        {["0", "50", "100"].map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={porcentaje === p}
            onClick={() => setPorcentaje(p)}
            className={cn("h-12 rounded-lg border text-sm active:bg-accent", porcentaje === p && "border-primary bg-primary text-primary-foreground")}
          >
            {p}%
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="excepcion-porcentaje">Porcentaje</Label>
        <Input
          id="excepcion-porcentaje"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={porcentaje}
          onChange={(e) => setPorcentaje(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="excepcion-motivo">Motivo</Label>
        <Input
          id="excepcion-motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Acuerdo con la familia"
          maxLength={200}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Sin datos clínicos: este texto se guarda junto al cobro.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button size="touch" onClick={guardar}>
          Guardar excepción
        </Button>
        <Button variant="ghost" onClick={alVolver}>
          Volver
        </Button>
      </div>
    </div>
  );
}
