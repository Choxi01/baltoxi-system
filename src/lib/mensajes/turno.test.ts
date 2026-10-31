import { describe, expect, it } from "vitest";
import { PLANTILLAS_POR_DEFECTO } from "./plantillas";
import { textoMensajeTurno } from "./turno";

describe("textoMensajeTurno", () => {
  it("cambio de turno con el día y la hora nuevos", () => {
    expect(
      textoMensajeTurno({
        plantilla: PLANTILLAS_POR_DEFECTO.cambio_turno,
        tutor: "Laura Prueba",
        paciente: "Tomás Andrés",
        fecha: "2026-11-05",
        hora: "09:45",
      }),
    ).toBe("Hola Laura, te confirmo el cambio: la sesión de Tomás pasa al jueves 5/11 a las 9:45.");
  });

  it("cancelación", () => {
    expect(
      textoMensajeTurno({
        plantilla: PLANTILLAS_POR_DEFECTO.cancelacion_turno,
        tutor: "Laura",
        paciente: "Sofi",
        fecha: "2026-11-02",
        hora: "15:00",
      }),
    ).toBe("Hola Laura, te aviso que la sesión de Sofi del lunes 2/11 a las 15:00 queda cancelada.");
  });
});
