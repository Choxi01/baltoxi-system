"use client";

import { ArrowRightLeft, Ban, Repeat, X } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ResultadoAgendar, ResultadoSimple } from "@/lib/agenda/acciones-turnos";
import { horaCorta } from "@/lib/agenda/bloques";
import { tituloDia } from "@/lib/agenda/calendario";
import { accionesDeLaSesion, agendadosDeLaSesion, agruparTurnos, encabezadoGrupo, nombreSesion, nombresDeLaSesion, validarGrupo } from "@/lib/agenda/grupos";
import { turnoNuevo, turnosNuevosDelGrupo } from "@/lib/agenda/optimista";
import { avisosAlAgendar, horaFin, textosAvisos, validarReserva } from "@/lib/agenda/reservas";
import { fechasParaHasta } from "@/lib/agenda/series";
import { type FilaDia, type TurnoAgenda } from "@/lib/agenda/turnos";
import type { MensajeListo } from "@/lib/mensajes/tipos";
import { filtrarPacientes } from "@/lib/pacientes/busqueda";
import { cn } from "@/lib/utils";
import { AccionesTurno, FormularioTurno, useAccionesTurno } from "./acciones-de-turno";
import type { Ejecutar } from "./turnos-optimistas";
import { FormularioCancelarSesion, FormularioMover, type AccionesDeTurno } from "./acciones-turno";

export type PacienteParaReservar = { id: string; nombre: string; apellido: string | null };
/** `cupo`: chicos por sesión (1 individual, 2 doble, 3 o 4 grupal; migración 0013). */
export type TipoParaReservar = { id: string; nombre: string; modalidad: string; color: string | null; cupo: number; requiere_paciente: boolean };

export type DatosPanel = {
  pacientes: PacienteParaReservar[];
  tipos: TipoParaReservar[];
  trasladoMin: number;
  duracion: number;
  hoy: string;
  horasAvisoMinimas: number;
  agendar: (entrada: unknown) => Promise<ResultadoAgendar>;
  acciones: AccionesDeTurno;
  /** Acciones de la sesión doble o grupal entera (A11b): solo en la Agenda. */
  sesion: AccionesSesion;
};

export type AccionesSesion = {
  moverGrupo: (grupoId: string, sesion: { fecha: string; inicio: string }, fecha: string, inicio: string) => Promise<ResultadoSimple>;
  cancelarGrupo: (grupoId: string, sesion: { fecha: string; inicio: string }) => Promise<ResultadoSimple>;
  finalizarSeriesDelGrupo: (grupoId: string) => Promise<ResultadoSimple>;
};

/** Un formulario abierto para la sesión entera: mover o cancelar a los chicos agendados. */
type SesionAbierta = { accion: "mover" | "cancelar"; grupoId: string; turnos: TurnoAgenda[] };

/** Sesión cancelada por la profesional que se está reponiendo ("Para reponer este mes"). */
export type Reposicion = { id: string; pacienteId: string | null; tipoId: string | null; titulo: string };

/**
 * Id solo para la pantalla mientras se guarda (el real lo da la base). No crypto.randomUUID():
 * en el iPhone por http (npm run dev en la red de casa) no existe. Solo se llama al tocar Agendar.
 */
function idDePantalla(): string {
  return `nuevo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** "lunes", "sábados": para "todos los …". */
function diasDeLaSemana(fecha: string): string {
  const dia = tituloDia(fecha).split(" ")[0].toLowerCase();
  return dia.endsWith("s") ? dia : `${dia}s`;
}

type Modo = "menu" | "reservar" | "fijo" | "ocupado";

// Acciones de una fila de la agenda (se abre debajo del bloque, sin ventanas).
export function PanelFila({
  fecha,
  fila,
  turnosDelDia,
  datos,
  reponiendo,
  ejecutar,
  alCerrar,
  alGuardar,
}: {
  fecha: string;
  fila: FilaDia;
  turnosDelDia: TurnoAgenda[];
  datos: DatosPanel;
  /** Guarda de forma optimista (useTurnosOptimistas de la Agenda). */
  ejecutar: Ejecutar;
  /** Si se está reponiendo una sesión: un bloque libre abre directo el formulario con ese paciente. */
  reponiendo?: Reposicion | null;
  alCerrar: () => void;
  alGuardar: (aviso: string, mensaje?: MensajeListo) => void;
}) {
  const turnos = fila.tipo === "fuera" ? [fila.turno] : fila.turnos;
  // Los cancelados de este horario también se muestran: a "Canceló tarde" se le puede poner excepción.
  const liberados = fila.tipo === "bloque" ? fila.liberados.filter((t) => t.clase === "turno") : [];
  const [modo, setModo] = useState<Modo>(reponiendo && turnos.length === 0 ? "reservar" : "menu");
  const { abierto, cerrar, error, guardando, alAccion, finalizarSerie } = useAccionesTurno({ acciones: datos.acciones, ejecutar, alGuardar });
  const [sesionAbierta, setSesionAbierta] = useState<SesionAbierta | null>(null);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);
  const [finalizando, iniciarFinalizar] = useTransition();

  /** Turno fijo grupal: terminan las series de todos los chicos de la sesión. */
  function finalizarFijoDeLaSesion(turnosSesion: TurnoAgenda[]) {
    const t = turnosSesion[0];
    if (!t?.grupoId) return;
    const dia = tituloDia(t.fecha).split(" ")[0].toLowerCase();
    const texto = `¿Finalizar el turno fijo de ${nombresDeLaSesion(turnosSesion)} (${dia} ${horaCorta(t.inicio)})? Se borran los turnos futuros agendados de todos los chicos; los pasados quedan.`;
    if (!window.confirm(texto)) return;
    setErrorSesion(null);
    iniciarFinalizar(async () => {
      const r = await datos.sesion.finalizarSeriesDelGrupo(t.grupoId!);
      if (r.ok) alGuardar("Turno fijo de la sesión finalizado ✓");
      else setErrorSesion(r.error);
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

      {!abierto && sesionAbierta?.accion === "mover" && (
        <FormularioMover
          turno={sesionAbierta.turnos[0]}
          hoy={datos.hoy}
          acciones={datos.acciones}
          ejecutar={ejecutar}
          alVolver={() => setSesionAbierta(null)}
          sesion={{
            turnos: sesionAbierta.turnos,
            mover: (nuevaFecha, nuevoInicio) =>
              datos.sesion.moverGrupo(sesionAbierta.grupoId, { fecha, inicio: sesionAbierta.turnos[0].inicio }, nuevaFecha, nuevoInicio),
          }}
        />
      )}
      {!abierto && sesionAbierta?.accion === "cancelar" && (
        <FormularioCancelarSesion
          turnos={sesionAbierta.turnos}
          cancelar={() => datos.sesion.cancelarGrupo(sesionAbierta.grupoId, { fecha, inicio: sesionAbierta.turnos[0].inicio })}
          ejecutar={ejecutar}
          alVolver={() => setSesionAbierta(null)}
        />
      )}
      {abierto && (
        <FormularioTurno
          abierto={abierto}
          hoy={datos.hoy}
          horasAvisoMinimas={datos.horasAvisoMinimas}
          acciones={datos.acciones}
          ejecutar={ejecutar}
          alVolver={cerrar}
          alGuardar={alGuardar}
        />
      )}
      {!abierto && !sesionAbierta && modo === "menu" && (
        <>
          {agruparTurnos([...turnos, ...liberados]).map((item) => {
            const tarjeta = (t: TurnoAgenda, enSesion = false) => (
              <AccionesTurno
                key={t.id}
                turno={t}
                hoy={datos.hoy}
                ocupado={guardando || finalizando}
                alAccion={(a) => alAccion(t, a)}
                alFinalizarSerie={() => finalizarSerie(t, enSesion)}
                enSesion={enSesion}
              />
            );
            if (item.tipo === "turno") return tarjeta(item.turno);
            // Sesión doble o grupal: arriba lo de la sesión entera; abajo cada chico con sus acciones
            // (asistencia, cobro y nota son por chico; su Mover o Cancelar lo saca de la sesión).
            const accionesSesion = accionesDeLaSesion(item.turnos);
            const agendados = agendadosDeLaSesion(item.turnos, item.turnos[0]);
            return (
              <section key={item.grupoId} className="flex flex-col gap-2 rounded-lg border border-dashed p-2" aria-label={nombreSesion(item.turnos.length)}>
                <p className="px-1 text-sm font-medium">
                  {encabezadoGrupo(item.turnos[0].tipo, item.turnos.length)} · {item.turnos.length} chicos
                </p>
                {(accionesSesion.includes("mover_sesion") || accionesSesion.includes("cancelar_sesion")) && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-12"
                      disabled={guardando || finalizando}
                      onClick={() => setSesionAbierta({ accion: "mover", grupoId: item.grupoId, turnos: agendados })}
                    >
                      <ArrowRightLeft /> Mover sesión
                    </Button>
                    <Button
                      variant="outline"
                      className="h-12 text-destructive"
                      disabled={guardando || finalizando}
                      onClick={() => setSesionAbierta({ accion: "cancelar", grupoId: item.grupoId, turnos: agendados })}
                    >
                      <Ban /> Cancelar sesión
                    </Button>
                  </div>
                )}
                {accionesSesion.includes("finalizar_fijo") && (
                  <Button
                    variant="ghost"
                    className="h-12 text-destructive"
                    disabled={guardando || finalizando}
                    onClick={() => finalizarFijoDeLaSesion(item.turnos)}
                  >
                    <Repeat /> {finalizando ? "Finalizando…" : "Finalizar turno fijo de la sesión"}
                  </Button>
                )}
                {errorSesion && (
                  <p role="alert" className="px-1 text-sm text-destructive">
                    {errorSesion}
                  </p>
                )}
                {item.turnos.map((t) => tarjeta(t, true))}
              </section>
            );
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setModo("reservar")}>
              {turnos.length === 0 ? "Reservar" : "Agregar otro acá"}
            </Button>
            {turnos.length === 0 && (
              <Button variant="outline" className="h-12" onClick={() => setModo("fijo")}>
                <Repeat /> Turno fijo
              </Button>
            )}
            <Button variant="outline" className={cn("h-12", turnos.length === 0 && "col-span-2")} onClick={() => setModo("ocupado")}>
              Marcar ocupado
            </Button>
          </div>
        </>
      )}
      {!abierto && (modo === "reservar" || modo === "fijo" || modo === "ocupado") && (
        <FormularioAgendar
          modo={modo}
          reponiendo={modo === "reservar" ? reponiendo : null}
          fecha={fecha}
          inicio={fila.inicio}
          turnosDelDia={turnosDelDia}
          datos={datos}
          ejecutar={ejecutar}
          alVolver={() => setModo("menu")}
          alGuardar={alGuardar}
        />
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
  ejecutar,
  alVolver,
  alGuardar,
}: {
  modo: "reservar" | "fijo" | "ocupado";
  reponiendo?: Reposicion | null;
  fecha: string;
  inicio: string;
  turnosDelDia: TurnoAgenda[];
  datos: DatosPanel;
  /** Reservar y Marcar ocupado se guardan de forma optimista. */
  ejecutar: Ejecutar;
  alVolver: () => void;
  /** El turno fijo todavía espera al servidor (crea 8 semanas de turnos). */
  alGuardar: (aviso: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [paciente, setPaciente] = useState<PacienteParaReservar | null>(
    () => (reponiendo && datos.pacientes.find((p) => p.id === reponiendo.pacienteId)) || null,
  );
  const [nombreSuelto, setNombreSuelto] = useState<string | null>(null);
  // Sesión doble o grupal: los otros chicos, además de `paciente`.
  const [companeros, setCompaneros] = useState<PacienteParaReservar[]>([]);
  // Doble o grupal al Reservar o en un Turno fijo, con pacientes con ficha (cada chico necesita su
  // familia para el cobro). Reponer una sesión es siempre individual.
  const admiteGrupo = (modo === "reservar" || modo === "fijo") && !reponiendo && nombreSuelto === null;
  const tiposPaciente = datos.tipos.filter((t) => t.requiere_paciente && (admiteGrupo || t.cupo <= 1));
  const [tipoId, setTipoId] = useState(
    (reponiendo && tiposPaciente.find((t) => t.id === reponiendo.tipoId)?.id) ??
      tiposPaciente.find((t) => t.nombre === "Sesión")?.id ??
      tiposPaciente[0]?.id ??
      "",
  );
  const [motivo, setMotivo] = useState("");
  // Turno fijo: último día (opcional), siempre el mismo día de la semana.
  const [hasta, setHasta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmarServidor, setConfirmarServidor] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const tipo = datos.tipos.find((t) => t.id === tipoId) ?? null;
  const cupo = admiteGrupo && paciente ? (tipo?.cupo ?? 1) : 1;
  const enGrupo = cupo > 1;
  const chicos = paciente ? [paciente, ...companeros] : [];
  const elegidos = new Set(chicos.map((p) => p.id));
  const fin = horaFin(inicio, datos.duracion);
  const avisos = textosAvisos(
    avisosAlAgendar({ fecha, inicio, fin, modalidad: modo === "ocupado" ? null : (tipo?.modalidad ?? null) }, turnosDelDia, datos.trasladoMin),
    datos.trasladoMin,
  );
  const confirmar = confirmarServidor ?? avisos.superposicion;
  const coincidencias = buscar(datos.pacientes, busqueda, elegidos);
  const elegido = modo === "ocupado" || paciente || nombreSuelto !== null;

  function guardar() {
    setError(null);
    const base = { fecha, inicio, confirmado: !!confirmar };
    if (enGrupo && tipo && modo === "reservar") return guardarGrupo(base, tipo);
    const entrada =
      modo === "ocupado"
        ? { ...base, clase: "ocupado", motivo_ocupado: motivo }
        : paciente
          ? { ...base, clase: "turno", paciente_id: paciente.id, tipo_turno_id: tipoId, repone_a: reponiendo?.id ?? null }
          : { ...base, clase: "reservado", nombre_reserva: nombreSuelto ?? "", tipo_turno_id: tipoId || null };
    if (modo === "fijo") {
      // El turno fijo espera al servidor: crea los turnos de las próximas 8 semanas.
      if (!paciente) return;
      // Doble o grupal: una serie por chico, todas juntas (el servidor vuelve a revisar el cupo).
      if (enGrupo && tipo) {
        const grupo = validarGrupo(
          chicos.map((p) => p.id),
          tipo.cupo,
        );
        if (!grupo.ok) return setError(grupo.error);
      }
      const companerosIds = enGrupo ? companeros.map((p) => p.id) : [];
      iniciar(async () => {
        const r = await datos.acciones.crearSerie({
          ...base,
          paciente_id: paciente.id,
          companeros: companerosIds,
          tipo_turno_id: tipoId,
          hasta: hasta || null,
        });
        if (r.ok) alGuardar(enGrupo ? `Turno fijo de la ${nombreSesion(chicos.length).toLowerCase()} creado ✓` : "Turno fijo creado ✓");
        else if ("confirmar" in r) setConfirmarServidor(r.confirmar);
        else setError(r.error);
      });
      return;
    }

    // Reservar y Marcar ocupado: se ve al instante. Lo que falte se avisa acá, antes de cerrar.
    const validacion = validarReserva(entrada);
    if (!validacion.ok) return setError(validacion.error);
    const nuevo = turnoNuevo({
      id: idDePantalla(),
      fecha,
      inicio,
      fin,
      clase: entrada.clase as "turno" | "reservado" | "ocupado",
      paciente,
      nombreReserva: nombreSuelto ?? "",
      motivo,
      tipo,
    });
    ejecutar(
      { tipo: "agregar", turno: nuevo },
      async () => {
        const r = await datos.agendar(entrada);
        // Otro dispositivo agendó en ese horario justo antes: no se agenda encima sin preguntar.
        if (!r.ok && "confirmar" in r) return { ok: false, error: `${r.confirmar} Abrí el horario de nuevo si querés agendar igual.` };
        return r;
      },
      modo === "ocupado" ? "Marcado como ocupado ✓" : reponiendo ? "Sesión repuesta ✓" : "Agendado ✓",
    );
  }

  /** Sesión doble o grupal: un turno por chico, todos a la vez (se ve al instante). */
  function guardarGrupo(base: { fecha: string; inicio: string; confirmado: boolean }, tipoGrupo: TipoParaReservar) {
    const ids = chicos.map((p) => p.id);
    const grupo = validarGrupo(ids, tipoGrupo.cupo);
    if (!grupo.ok) return setError(grupo.error);
    const entrada = { ...base, clase: "grupo", paciente_ids: ids, tipo_turno_id: tipoGrupo.id };
    const validacion = validarReserva(entrada);
    if (!validacion.ok) return setError(validacion.error);
    const turnos = turnosNuevosDelGrupo({
      id: idDePantalla(),
      fecha,
      inicio,
      fin,
      pacientes: chicos,
      tipo: tipoGrupo,
    });
    ejecutar(
      { tipo: "agregar_grupo", turnos },
      async () => {
        const r = await datos.agendar(entrada);
        if (!r.ok && "confirmar" in r) return { ok: false, error: `${r.confirmar} Abrí el horario de nuevo si querés agendar igual.` };
        return r;
      },
      `${nombreSesion(chicos.length)} agendada ✓`,
    );
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

      {modo !== "ocupado" && !paciente && nombreSuelto === null && (
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
          {busqueda.trim() && modo === "reservar" && (
            <Button
              variant="ghost"
              className="h-12 justify-start"
              onClick={() => {
                // Sin ficha no hay sesión doble ni grupal: si el tipo elegido lo era, queda sin elegir.
                if ((tipo?.cupo ?? 1) > 1) setTipoId("");
                setNombreSuelto(busqueda.trim());
              }}
            >
              Reservar a “{busqueda.trim()}” sin ficha
            </Button>
          )}
        </div>
      )}

      {modo !== "ocupado" && (paciente || nombreSuelto !== null) && (
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
                  // En un grupo, "Quitar" al primero deja al siguiente en su lugar.
                  if (enGrupo && companeros.length > 0) {
                    setPaciente(companeros[0]);
                    setCompaneros(companeros.slice(1));
                    return;
                  }
                  setPaciente(null);
                  setNombreSuelto(null);
                }}
              >
                {enGrupo && companeros.length > 0 ? "Quitar" : "Cambiar"}
              </Button>
            )}
          </div>
          {enGrupo &&
            companeros.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                <span>
                  {p.nombre} {p.apellido ?? ""}
                </span>
                <Button variant="ghost" className="h-10" onClick={() => setCompaneros(companeros.filter((c) => c.id !== p.id))}>
                  Quitar
                </Button>
              </div>
            ))}
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
          {enGrupo && <AgregarChico cupo={cupo} chicos={chicos.length} pacientes={datos.pacientes} elegidos={elegidos} alElegir={(p) => setCompaneros([...companeros, p])} />}
          {modo === "fijo" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="hasta-serie">Hasta</Label>
              <Select id="hasta-serie" value={hasta} onChange={(e) => setHasta(e.target.value)}>
                <option value="">Sin fecha de fin</option>
                {fechasParaHasta(fecha).map((f) => (
                  <option key={f} value={f}>
                    {tituloDia(f)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Todos los {diasDeLaSemana(fecha)} a las {horaCorta(inicio)}, desde el{" "}
                {tituloDia(fecha).split(" ").slice(1).join(" ")}. Se agendan las próximas 8 semanas (salteando feriados) y se
                completan solas al abrir la agenda.
              </p>
            </div>
          )}
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
            {enviando
              ? "Guardando…"
              : confirmar
                ? modo === "fijo"
                  ? "Crear igual"
                  : "Agendar igual"
                : modo === "ocupado"
                  ? "Marcar ocupado"
                  : modo === "fijo"
                    ? enGrupo
                      ? `Crear turno fijo (${chicos.length} chicos)`
                      : "Crear turno fijo"
                    : enGrupo
                      ? `Agendar ${nombreSesion(chicos.length).toLowerCase()} (${chicos.length})`
                      : "Agendar"}
          </Button>
        )}
        <Button variant="ghost" onClick={alVolver} disabled={enviando}>
          Volver
        </Button>
      </div>
    </div>
  );
}

/** Hasta 6 pacientes que coinciden con la búsqueda, sin los que ya están elegidos. */
function buscar(pacientes: PacienteParaReservar[], busqueda: string, elegidos: Set<string>): PacienteParaReservar[] {
  if (!busqueda.trim()) return [];
  return filtrarPacientes(
    pacientes.filter((p) => !elegidos.has(p.id)).map((p) => ({ ...p, estado: "activo" })),
    { q: busqueda },
  ).slice(0, 6);
}

/** Sesión doble o grupal: buscar y sumar otro chico, hasta el cupo del tipo. */
function AgregarChico({
  cupo,
  chicos,
  pacientes,
  elegidos,
  alElegir,
}: {
  cupo: number;
  chicos: number;
  pacientes: PacienteParaReservar[];
  elegidos: Set<string>;
  alElegir: (p: PacienteParaReservar) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const coincidencias = buscar(pacientes, busqueda, elegidos);
  const ayuda = cupo === 2 ? "Sesión doble: 2 chicos, cada uno con su familia y su cobro." : `Sesión grupal: de 2 a ${cupo} chicos, cada uno con su familia y su cobro.`;
  if (chicos >= cupo) return <p className="text-xs text-muted-foreground">{ayuda}</p>;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="buscar-companero">{chicos < 2 ? "Agregá otro chico" : "Agregar otro chico (opcional)"}</Label>
      <Input
        id="buscar-companero"
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
              <button
                type="button"
                className="flex h-12 w-full items-center px-3 text-left active:bg-accent"
                onClick={() => {
                  alElegir(p);
                  setBusqueda("");
                }}
              >
                {p.nombre} {p.apellido}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{ayuda}</p>
    </div>
  );
}
