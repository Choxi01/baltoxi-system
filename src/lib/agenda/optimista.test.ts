import { describe, expect, it } from "vitest";
import type { Tramo } from "./bloques";
import { aplicarCambio, idMovido, turnoNuevo, turnosNuevosDelGrupo } from "./optimista";
import { armarDia, type TurnoAgenda } from "./turnos";

// Datos inventados.
const LUNES = "2026-11-02";
const MARTES = "2026-11-03";
const HORARIO: Tramo[] = [{ dia_semana: 1, desde: "09:00", hasta: "11:15" }, { dia_semana: 2, desde: "09:00", hasta: "11:15" }];

const turno = (id: string, inicio: string, datos: Partial<TurnoAgenda> = {}): TurnoAgenda => ({
  id,
  clase: "turno",
  estado: "agendado",
  fecha: LUNES,
  inicio,
  fin: inicio === "09:00" ? "09:45" : inicio === "09:45" ? "10:30" : "11:15",
  titulo: "Paciente Inventado",
  tipo: "Sesión",
  serieId: null,
  grupoId: null,
  tipoId: "tipo-1",
  pacienteId: "paciente-1",
  modalidad: "consultorio",
  color: null,
  porcentajeManual: null,
  ...datos,
});
const libres = (turnos: TurnoAgenda[], fecha = LUNES) => armarDia(fecha, HORARIO, 45, [], turnos).libres;

describe("aplicarCambio", () => {
  it("Vino y No vino cambian el estado, sacan la excepción y marcan que se está guardando", () => {
    const antes = [turno("a", "09:00", { porcentajeManual: 50 })];
    const vino = aplicarCambio(antes, { tipo: "asistencia", id: "a", accion: "vino" });
    expect(vino[0]).toMatchObject({ estado: "presente", porcentajeManual: null, guardando: true });
    const noVino = aplicarCambio(antes, { tipo: "asistencia", id: "a", accion: "no_vino" });
    expect(noVino[0].estado).toBe("ausente_sin_aviso");
  });

  it("Volver a agendado y Quitar excepción", () => {
    const antes = [turno("a", "09:00", { estado: "presente", porcentajeManual: 0 })];
    expect(aplicarCambio(antes, { tipo: "asistencia", id: "a", accion: "agendado" })[0]).toMatchObject({ estado: "agendado", porcentajeManual: null });
    // Quitar excepción no cambia el estado.
    expect(aplicarCambio(antes, { tipo: "asistencia", id: "a", accion: "quitar_excepcion" })[0]).toMatchObject({ estado: "presente", porcentajeManual: null });
  });

  it("Excepción: cambia el porcentaje y deja el estado", () => {
    const antes = [turno("a", "09:00", { estado: "aviso_tardio" })];
    expect(aplicarCambio(antes, { tipo: "excepcion", id: "a", porcentaje: 50 })[0]).toMatchObject({ estado: "aviso_tardio", porcentajeManual: 50 });
  });

  it("el botón Cobrar ahora se esconde mientras se guarda (el monto puede cambiar)", () => {
    const antes = [turno("a", "09:00", { estado: "presente", cobro: { tutorId: "t", tutorNombre: "Tutor Inventado", pendiente: 290000, deudaAnterior: 0 } })];
    expect(aplicarCambio(antes, { tipo: "excepcion", id: "a", porcentaje: 0 })[0].cobro).toBeUndefined();
  });

  it("Cancelar: el estado que viene y el horario queda libre", () => {
    const antes = [turno("a", "09:00"), turno("b", "09:45")];
    expect(libres(antes)).toBe(1);
    const despues = aplicarCambio(antes, { tipo: "cancelar", id: "a", estado: "cancelado_profesional" });
    expect(despues[0].estado).toBe("cancelado_profesional");
    expect(libres(despues)).toBe(2);
  });

  it("Cancelar con No se cobra: la tarjeta ya muestra la excepción de 0%", () => {
    const antes = [turno("a", "09:00")];
    expect(aplicarCambio(antes, { tipo: "cancelar", id: "a", estado: "aviso_tardio", porcentaje: 0 })[0]).toMatchObject({
      estado: "aviso_tardio",
      porcentajeManual: 0,
      guardando: true,
    });
  });

  it("Cancelar con Se cobra: sin excepción", () => {
    const antes = [turno("a", "09:00")];
    expect(aplicarCambio(antes, { tipo: "cancelar", id: "a", estado: "aviso_tardio" })[0].porcentajeManual).toBeNull();
  });

  it("Quitar: el turno desaparece", () => {
    const antes = [turno("a", "09:00", { clase: "reservado", pacienteId: null }), turno("b", "09:45")];
    expect(aplicarCambio(antes, { tipo: "quitar", id: "a" }).map((t) => t.id)).toEqual(["b"]);
  });

  it("Mover con paciente: el original queda reprogramado y aparece uno nuevo, sin turno fijo", () => {
    const antes = [turno("a", "09:00", { serieId: "serie-1", porcentajeManual: 50 })];
    const despues = aplicarCambio(antes, { tipo: "mover", id: "a", fecha: MARTES, inicio: "09:45", fin: "10:30" });
    expect(despues).toHaveLength(2);
    expect(despues[0]).toMatchObject({ id: "a", estado: "reprogramado", fecha: LUNES, guardando: true });
    expect(despues[1]).toMatchObject({
      id: idMovido("a"),
      estado: "agendado",
      fecha: MARTES,
      inicio: "09:45",
      fin: "10:30",
      pacienteId: "paciente-1",
      tipoId: "tipo-1",
      serieId: null,
      grupoId: null,
      porcentajeManual: null,
      guardando: true,
    });
    // El lunes queda libre y el martes ocupa un bloque.
    expect(libres(despues, LUNES)).toBe(3);
    expect(libres(despues, MARTES)).toBe(2);
  });

  it("Mover un reservado u ocupado: cambia de lugar, sin crear otro", () => {
    const antes = [turno("a", "10:30", { clase: "ocupado", pacienteId: null }), turno("b", "09:45")];
    const despues = aplicarCambio(antes, { tipo: "mover", id: "a", fecha: LUNES, inicio: "09:00", fin: "09:45" });
    expect(despues.map((t) => [t.id, t.inicio])).toEqual([["a", "09:00"], ["b", "09:45"]]);
    expect(despues[0]).toMatchObject({ estado: "agendado", guardando: true });
  });

  it("no toca la lista original ni los otros turnos; un id que no está no cambia nada", () => {
    const antes = [turno("a", "09:00"), turno("b", "09:45")];
    const copia = structuredClone(antes);
    const despues = aplicarCambio(antes, { tipo: "asistencia", id: "a", accion: "vino" });
    expect(antes).toEqual(copia);
    expect(despues[1]).toBe(antes[1]);
    expect(aplicarCambio(antes, { tipo: "quitar", id: "otro" })).toBe(antes);
  });
});

describe("Reservar y Cobrar ahora", () => {
  const SESION = { id: "tipo-1", nombre: "Sesión", modalidad: "consultorio" };

  it("turnoNuevo arma el turno como lo devuelve el servidor", () => {
    expect(
      turnoNuevo({ id: "n1", fecha: LUNES, inicio: "09:45", fin: "10:30", clase: "turno", paciente: { id: "p1", nombre: "Paciente", apellido: "Inventado" }, tipo: SESION }),
    ).toMatchObject({ clase: "turno", estado: "agendado", titulo: "Paciente Inventado", tipo: "Sesión", tipoId: "tipo-1", pacienteId: "p1", modalidad: "consultorio", serieId: null });
    expect(turnoNuevo({ id: "n2", fecha: LUNES, inicio: "09:45", fin: "10:30", clase: "reservado", nombreReserva: "Nombre Suelto", tipo: null })).toMatchObject({
      titulo: "Nombre Suelto",
      tipo: null,
      pacienteId: null,
    });
    // Un ocupado no lleva tipo aunque el formulario tenga uno elegido.
    expect(turnoNuevo({ id: "n3", fecha: LUNES, inicio: "09:45", fin: "10:30", clase: "ocupado", motivo: "Trámite", tipo: SESION })).toMatchObject({
      titulo: "Trámite",
      tipo: null,
      tipoId: null,
      modalidad: null,
    });
  });

  it("Reservar: el turno aparece en su lugar y ocupa el bloque", () => {
    const antes = [turno("a", "09:00"), turno("b", "10:30")];
    const nuevo = turnoNuevo({ id: "n1", fecha: LUNES, inicio: "09:45", fin: "10:30", clase: "reservado", nombreReserva: "Nombre Suelto" });
    const despues = aplicarCambio(antes, { tipo: "agregar", turno: nuevo });
    expect(despues.map((t) => t.id)).toEqual(["a", "n1", "b"]);
    expect(despues[1].guardando).toBe(true);
    expect(libres(antes)).toBe(1);
    expect(libres(despues)).toBe(0);
  });

  it("Reservar una sesión doble: un turno por chico con el mismo grupo, y ocupan un solo bloque", () => {
    const antes = [turno("a", "09:00"), turno("b", "10:30")];
    const nuevos = turnosNuevosDelGrupo({
      id: "g1",
      fecha: LUNES,
      inicio: "09:45",
      fin: "10:30",
      pacientes: [
        { id: "p1", nombre: "Juan", apellido: "Inventado" },
        { id: "p2", nombre: "Pedro", apellido: "Prueba" },
      ],
      tipo: { id: "tipo-doble", nombre: "Sesión doble", modalidad: "consultorio", color: "durazno" },
    });
    expect(nuevos).toEqual([
      expect.objectContaining({ id: "g1-0", grupoId: "g1", pacienteId: "p1", titulo: "Juan Inventado", tipoId: "tipo-doble", color: "durazno" }),
      expect.objectContaining({ id: "g1-1", grupoId: "g1", pacienteId: "p2", titulo: "Pedro Prueba", tipoId: "tipo-doble" }),
    ]);
    const despues = aplicarCambio(antes, { tipo: "agregar_grupo", turnos: nuevos });
    expect(despues.map((t) => t.id)).toEqual(["a", "g1-0", "g1-1", "b"]);
    expect(despues.filter((t) => t.grupoId === "g1").every((t) => t.guardando)).toBe(true);
    expect(libres(despues)).toBe(0);
    expect(antes).toHaveLength(2);
  });

  it("Mover a un chico de una sesión doble lo saca del grupo", () => {
    const antes = [turno("a", "09:00", { grupoId: "g1" }), turno("b", "09:00", { grupoId: "g1", pacienteId: "paciente-2" })];
    const despues = aplicarCambio(antes, { tipo: "mover", id: "a", fecha: MARTES, inicio: "09:00", fin: "09:45" });
    expect(despues.find((t) => t.id === idMovido("a"))?.grupoId).toBeNull();
    expect(despues.find((t) => t.id === "b")?.grupoId).toBe("g1");
  });

  it("Cobrar ahora: el botón se va y el turno queda guardando, sin cambiar el estado", () => {
    const antes = [turno("a", "09:00", { estado: "presente", cobro: { tutorId: "t", tutorNombre: "Tutor Inventado", pendiente: 290000, deudaAnterior: 0 } })];
    expect(aplicarCambio(antes, { tipo: "cobrado", id: "a" })[0]).toMatchObject({ estado: "presente", cobro: undefined, guardando: true });
  });
});
