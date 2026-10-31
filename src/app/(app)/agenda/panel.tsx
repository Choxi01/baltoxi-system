"use client";

import { ArrowRightLeft, Ban, ExternalLink, Trash2, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResultadoAgendar } from "@/lib/agenda/acciones-turnos";
import { horaCorta } from "@/lib/agenda/bloques";
import { avisosAlAgendar, horaFin, textosAvisos } from "@/lib/agenda/reservas";
import { textoTurno, type FilaDia, type TurnoAgenda } from "@/lib/agenda/turnos";
import { filtrarPacientes } from "@/lib/pacientes/busqueda";
import { FormularioCancelar, FormularioMover, type AccionesDeTurno } from "./acciones-turno";

export type PacienteParaReservar = { id: string; nombre: string; apellido: string | null };
export type TipoParaReservar = { id: string; nombre: string; modalidad: string; requiere_paciente: boolean };

export type DatosPanel = {
  pacientes: PacienteParaReservar[];
  tipos: TipoParaReservar[];
  trasladoMin: number;
  duracion: number;
  hoy: string;
  horasAvisoMinimas: number;
  agendar: (entrada: unknown) => Promise<ResultadoAgendar>;
  acciones: AccionesDeTurno;
};

/** Sesión cancelada por la profesional que se está reponiendo ("Para reponer este mes"). */
export type Reposicion = { id: string; pacienteId: string | null; tipoId: string | null; titulo: string };

type Modo = "menu" | "reservar" | "ocupado" | { accion: "mover" | "cancelar"; turno: TurnoAgenda };

// Acciones de una fila de la agenda (se abre debajo del bloque, sin ventanas).
export function PanelFila({
  fecha,
  fila,
  turnosDelDia,
  datos,
  reponiendo,
  alCerrar,
  alGuardar,
}: {
  fecha: string;
  fila: FilaDia;
  turnosDelDia: TurnoAgenda[];
  datos: DatosPanel;
  /** Si se está reponiendo una sesión: un bloque libre abre directo el formulario con ese paciente. */
  reponiendo?: Reposicion | null;
  alCerrar: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const turnos = fila.tipo === "fuera" ? [fila.turno] : fila.turnos;
  const [modo, setModo] = useState<Modo>(reponiendo && turnos.length === 0 ? "reservar" : "menu");
  const [error, setError] = useState<string | null>(null);
  const [quitando, iniciarQuitar] = useTransition();

  function quitar(t: TurnoAgenda) {
    if (!window.confirm(`¿Quitar «${textoTurno(t)}»? El horario queda libre.`)) return;
    setError(null);
    iniciarQuitar(async () => {
      const r = await datos.acciones.quitarTurno(t.id);
      if (r.ok) alGuardar("Quitado ✓");
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {horaCorta(fila.inicio)}
          {turnos.length === 0 ? " · Libre" : ""}
        </p>
        <Button variant="ghost" className="size-10" aria-label="Cerrar" onClick={alCerrar}>
          <X className="size-5" />
        </Button>
      </div>

      {modo === "menu" && (
        <>
          {turnos.map((t) => (
            <AccionesTurno
              key={t.id}
              turno={t}
              ocupado={quitando}
              alMover={() => setModo({ accion: "mover", turno: t })}
              alCancelar={() => setModo({ accion: "cancelar", turno: t })}
              alQuitar={() => quitar(t)}
            />
          ))}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setModo("reservar")}>
              {turnos.length === 0 ? "Reservar" : "Agregar otro acá"}
            </Button>
            <Button variant="outline" className="h-12" onClick={() => setModo("ocupado")}>
              Marcar ocupado
            </Button>
          </div>
        </>
      )}
      {typeof modo === "object" && modo.accion === "mover" && (
        <FormularioMover turno={modo.turno} hoy={datos.hoy} acciones={datos.acciones} alVolver={() => setModo("menu")} alGuardar={alGuardar} />
      )}
      {typeof modo === "object" && modo.accion === "cancelar" && (
        <FormularioCancelar
          turno={modo.turno}
          hoy={datos.hoy}
          horasAvisoMinimas={datos.horasAvisoMinimas}
          acciones={datos.acciones}
          alVolver={() => setModo("menu")}
          alGuardar={alGuardar}
        />
      )}
      {(modo === "reservar" || modo === "ocupado") && (
        <FormularioAgendar
          modo={modo}
          reponiendo={modo === "reservar" ? reponiendo : null}
          fecha={fecha}
          inicio={fila.inicio}
          turnosDelDia={turnosDelDia}
          datos={datos}
          alVolver={() => setModo("menu")}
          alGuardar={alGuardar}
        />
      )}
    </div>
  );
}

function AccionesTurno({
  turno,
  ocupado,
  alMover,
  alCancelar,
  alQuitar,
}: {
  turno: TurnoAgenda;
  ocupado: boolean;
  alMover: () => void;
  alCancelar: () => void;
  alQuitar: () => void;
}) {
  const agendado = turno.estado === "agendado";
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-2">
      <p className="px-1 text-sm font-medium">{textoTurno(turno)}</p>
      {turno.clase === "turno" && turno.pacienteId && (
        <Button asChild variant="outline" className="h-12 justify-start">
          <Link href={`/pacientes/${turno.pacienteId}`}>
            <ExternalLink /> Ver expediente
          </Link>
        </Button>
      )}
      {turno.clase === "reservado" && (
        <Button asChild variant="outline" className="h-12 justify-start">
          <Link href={`/pacientes/nuevo?reserva=${turno.id}`}>
            <UserPlus /> Crear ficha
          </Link>
        </Button>
      )}
      {agendado && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={alMover} disabled={ocupado}>
            <ArrowRightLeft /> Mover
          </Button>
          {turno.clase === "turno" ? (
            <Button variant="outline" className="h-12 text-destructive" onClick={alCancelar} disabled={ocupado}>
              <Ban /> Cancelar
            </Button>
          ) : (
            <Button variant="outline" className="h-12 text-destructive" onClick={alQuitar} disabled={ocupado}>
              <Trash2 /> Quitar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function FormularioAgendar({
  modo,
  reponiendo,
  fecha,
  inicio,
  turnosDelDia,
  datos,
  alVolver,
  alGuardar,
}: {
  modo: "reservar" | "ocupado";
  reponiendo?: Reposicion | null;
  fecha: string;
  inicio: string;
  turnosDelDia: TurnoAgenda[];
  datos: DatosPanel;
  alVolver: () => void;
  alGuardar: (aviso: string) => void;
}) {
  const tiposPaciente = datos.tipos.filter((t) => t.requiere_paciente);
  const [busqueda, setBusqueda] = useState("");
  const [paciente, setPaciente] = useState<PacienteParaReservar | null>(
    () => (reponiendo && datos.pacientes.find((p) => p.id === reponiendo.pacienteId)) || null,
  );
  const [nombreSuelto, setNombreSuelto] = useState<string | null>(null);
  const [tipoId, setTipoId] = useState(
    (reponiendo && tiposPaciente.find((t) => t.id === reponiendo.tipoId)?.id) ??
      tiposPaciente.find((t) => t.nombre === "Sesión")?.id ??
      tiposPaciente[0]?.id ??
      "",
  );
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmarServidor, setConfirmarServidor] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const tipo = datos.tipos.find((t) => t.id === tipoId) ?? null;
  const fin = horaFin(inicio, datos.duracion);
  const avisos = textosAvisos(
    avisosAlAgendar({ fecha, inicio, fin, modalidad: modo === "ocupado" ? null : (tipo?.modalidad ?? null) }, turnosDelDia, datos.trasladoMin),
    datos.trasladoMin,
  );
  const confirmar = confirmarServidor ?? avisos.superposicion;
  const coincidencias = busqueda.trim() ? filtrarPacientes(datos.pacientes.map((p) => ({ ...p, estado: "activo" })), { q: busqueda }).slice(0, 6) : [];
  const elegido = modo === "ocupado" || paciente || nombreSuelto !== null;

  function guardar() {
    setError(null);
    const base = { fecha, inicio, confirmado: !!confirmar };
    const entrada =
      modo === "ocupado"
        ? { ...base, clase: "ocupado", motivo_ocupado: motivo }
        : paciente
          ? { ...base, clase: "turno", paciente_id: paciente.id, tipo_turno_id: tipoId, repone_a: reponiendo?.id ?? null }
          : { ...base, clase: "reservado", nombre_reserva: nombreSuelto ?? "", tipo_turno_id: tipoId || null };
    iniciar(async () => {
      const r = await datos.agendar(entrada);
      if (r.ok) alGuardar(modo === "ocupado" ? "Marcado como ocupado ✓" : reponiendo ? "Sesión repuesta ✓" : "Agendado ✓");
      else if ("confirmar" in r) setConfirmarServidor(r.confirmar);
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {modo === "ocupado" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo-ocupado">Motivo</Label>
          <Input
            id="motivo-ocupado"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. Reunión en el colegio, trámite"
            maxLength={80}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">Sin datos clínicos: este texto se ve en la agenda.</p>
        </div>
      )}

      {modo === "reservar" && !paciente && nombreSuelto === null && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="buscar-paciente">Paciente</Label>
          <Input
            id="buscar-paciente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscá por nombre o apellido"
            autoComplete="off"
            enterKeyHint="search"
          />
          {coincidencias.length > 0 && (
            <ul className="divide-y rounded-lg border bg-background">
              {coincidencias.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex h-12 w-full items-center px-3 text-left active:bg-accent" onClick={() => setPaciente(p)}>
                    {p.nombre} {p.apellido}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busqueda.trim() && (
            <Button variant="ghost" className="h-12 justify-start" onClick={() => setNombreSuelto(busqueda.trim())}>
              Reservar a “{busqueda.trim()}” sin ficha
            </Button>
          )}
        </div>
      )}

      {modo === "reservar" && (paciente || nombreSuelto !== null) && (
        <>
          <div className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
            <span>
              {reponiendo && "Reponer: "}
              {paciente ? `${paciente.nombre} ${paciente.apellido ?? ""}` : `Reservado: ${nombreSuelto}`}
            </span>
            {!reponiendo && (
              <Button
                variant="ghost"
                className="h-10"
                onClick={() => {
                  setPaciente(null);
                  setNombreSuelto(null);
                }}
              >
                Cambiar
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo-turno">Tipo de turno</Label>
            <Select id="tipo-turno" value={tipoId} onChange={(e) => setTipoId(e.target.value)}>
              {!paciente && <option value="">Sin elegir todavía</option>}
              {tiposPaciente.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}

      {elegido && avisos.traslado && (
        <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{avisos.traslado}</p>
      )}
      {elegido && confirmar && (
        <p role="alert" className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          {confirmar}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {elegido && (
          <Button size="touch" onClick={guardar} disabled={enviando || (modo === "ocupado" && !motivo.trim())}>
            {enviando ? "Guardando…" : confirmar ? "Agendar igual" : modo === "ocupado" ? "Marcar ocupado" : "Agendar"}
          </Button>
        )}
        <Button variant="ghost" onClick={alVolver} disabled={enviando}>
          Volver
        </Button>
      </div>
    </div>
  );
}
