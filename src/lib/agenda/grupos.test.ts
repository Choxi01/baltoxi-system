import { describe, expect, it } from "vitest";
import { agruparTurnos, encabezadoGrupo, nombreSesion, textoGrupo, turnosDelGrupo, validarGrupo } from "./grupos";
import type { TurnoAgenda } from "./turnos";

// Datos inventados.
const LUNES = "2026-11-02";
const turno = (id: string, datos: Partial<TurnoAgenda> = {}): TurnoAgenda => ({
  id,
  clase: "turno",
  estado: "agendado",
  fecha: LUNES,
  inicio: "09:00",
  fin: "09:45",
  titulo: "Paciente Inventado",
  tipo: "Sesión doble",
  serieId: null,
  grupoId: null,
  tipoId: "tipo-doble",
  pacienteId: `paciente-${id}`,
  modalidad: "consultorio",
  color: null,
  porcentajeManual: null,
  ...datos,
});

describe("validarGrupo", () => {
  it("acepta de 2 al cupo del tipo", () => {
    expect(validarGrupo(["a", "b"], 2)).toEqual({ ok: true });
    expect(validarGrupo(["a", "b", "c"], 4)).toEqual({ ok: true });
    expect(validarGrupo(["a", "b", "c", "d"], 4)).toEqual({ ok: true });
  });

  it("pide al menos 2 chicos", () => {
    expect(validarGrupo(["a"], 4)).toEqual({ ok: false, error: "Elegí al menos 2 chicos." });
    expect(validarGrupo([], 2)).toEqual({ ok: false, error: "Elegí al menos 2 chicos." });
  });

  it("no pasa del cupo del tipo", () => {
    expect(validarGrupo(["a", "b", "c"], 2)).toEqual({ ok: false, error: "Una sesión doble es de 2 chicos." });
    expect(validarGrupo(["a", "b", "c", "d"], 3)).toEqual({ ok: false, error: "Este tipo de turno es de hasta 3 chicos." });
  });

  it("no repite chicos", () => {
    expect(validarGrupo(["a", "a"], 2)).toEqual({ ok: false, error: "Hay un chico repetido." });
  });

  it("un tipo individual no arma grupos", () => {
    expect(validarGrupo(["a", "b"], 1)).toEqual({ ok: false, error: "Ese tipo de turno es individual: elegí un tipo doble o grupal." });
  });
});

describe("turnosDelGrupo", () => {
  it("un turno por chico, con el mismo tipo, horario y grupo", () => {
    const filas = turnosDelGrupo({
      consultorioId: "c1",
      grupoId: "g1",
      pacienteIds: ["p1", "p2", "p3"],
      tipoTurnoId: "tipo-grupal",
      inicio: "2026-11-02T12:00:00.000Z",
      fin: "2026-11-02T12:45:00.000Z",
    });
    expect(filas).toHaveLength(3);
    expect(filas.map((f) => f.paciente_id)).toEqual(["p1", "p2", "p3"]);
    for (const f of filas) {
      expect(f).toEqual({
        consultorio_id: "c1",
        clase: "turno",
        paciente_id: f.paciente_id,
        tipo_turno_id: "tipo-grupal",
        grupo_id: "g1",
        inicio: "2026-11-02T12:00:00.000Z",
        fin: "2026-11-02T12:45:00.000Z",
      });
    }
  });
});

describe("agruparTurnos", () => {
  it("junta los turnos con el mismo grupo, día y hora en un solo item, en el lugar del primero", () => {
    const turnos = [turno("a", { grupoId: "g1" }), turno("x"), turno("b", { grupoId: "g1" })];
    expect(agruparTurnos(turnos)).toEqual([
      { tipo: "grupo", grupoId: "g1", turnos: [turnos[0], turnos[2]] },
      { tipo: "turno", turno: turnos[1] },
    ]);
  });

  it("los individuales, reservados y ocupados quedan como están", () => {
    const turnos = [turno("a"), turno("r", { clase: "reservado", pacienteId: null }), turno("o", { clase: "ocupado", pacienteId: null })];
    expect(agruparTurnos(turnos).map((i) => i.tipo)).toEqual(["turno", "turno", "turno"]);
  });

  it("si del grupo queda un solo chico, se ve como individual", () => {
    const solo = turno("a", { grupoId: "g1" });
    expect(agruparTurnos([solo])).toEqual([{ tipo: "turno", turno: solo }]);
  });

  it("mismo grupo pero otra hora u otro día: no se juntan", () => {
    const turnos = [turno("a", { grupoId: "g1" }), turno("b", { grupoId: "g1", inicio: "09:45", fin: "10:30" }), turno("c", { grupoId: "g1", fecha: "2026-11-03" })];
    expect(agruparTurnos(turnos).map((i) => i.tipo)).toEqual(["turno", "turno", "turno"]);
  });

  it("dos grupos distintos a la misma hora son dos rectángulos", () => {
    const turnos = [turno("a", { grupoId: "g1" }), turno("b", { grupoId: "g2" }), turno("c", { grupoId: "g1" }), turno("d", { grupoId: "g2" })];
    expect(agruparTurnos(turnos).map((i) => (i.tipo === "grupo" ? i.grupoId : i.turno.id))).toEqual(["g1", "g2"]);
  });
});

describe("textoGrupo y nombreSesion", () => {
  it("doble: los nombres de pila", () => {
    expect(textoGrupo([{ titulo: "Juan Inventado" }, { titulo: "Pedro Prueba" }])).toBe("Juan + Pedro");
  });

  it("doble con el mismo nombre: nombre y apellido", () => {
    expect(textoGrupo([{ titulo: "Juan Inventado" }, { titulo: "Juan Prueba" }])).toBe("Juan Inventado + Juan Prueba");
  });

  it("3 o 4 chicos: Grupal y la cantidad (según los que quedan, no el cupo)", () => {
    const t = (titulo: string) => ({ titulo });
    expect(textoGrupo([t("Ana A"), t("Bea B"), t("Caro C")])).toBe("Grupal · 3");
    expect(textoGrupo([t("Ana A"), t("Bea B"), t("Caro C"), t("Dani D")])).toBe("Grupal · 4");
  });

  it("encabezado sin repetir el nombre del tipo", () => {
    expect(encabezadoGrupo("Sesión doble", 2)).toBe("Sesión doble");
    expect(encabezadoGrupo("Sesión grupal", 3)).toBe("Sesión grupal");
    expect(encabezadoGrupo(null, 2)).toBe("Sesión doble");
    expect(encabezadoGrupo("Taller de juego", 4)).toBe("Sesión grupal · Taller de juego");
    // Una grupal donde quedan 2: dice que es doble y de qué tipo.
    expect(encabezadoGrupo("Sesión grupal", 2)).toBe("Sesión doble · Sesión grupal");
  });

  it("clase de sesión según la cantidad", () => {
    expect(nombreSesion(2)).toBe("Sesión doble");
    expect(nombreSesion(3)).toBe("Sesión grupal");
    expect(nombreSesion(4)).toBe("Sesión grupal");
  });
});
