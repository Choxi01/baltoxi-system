import { describe, expect, it } from "vitest";
import {
  ERROR_EXCEPCION_REPETIDA,
  validarConsultorio,
  validarExcepcion,
  validarReglas,
  validarTarifa,
  validarTipoTurno,
} from "./validacion";

function formulario(datos: Record<string, string>) {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries(datos)) fd.set(clave, valor);
  return fd;
}

const consultorio = (datos: Record<string, string> = {}) =>
  formulario({
    nombre: "Consultorio Prueba",
    horas_aviso_minimas: "48",
    dia_limite_pago: "10",
    concepto_factura: "Servicios de fonoaudiología",
    ...datos,
  });

describe("validarConsultorio", () => {
  it("acepta lo mínimo", () => {
    expect(validarConsultorio(consultorio())).toMatchObject({
      ok: true,
      datos: { nombre: "Consultorio Prueba", ruc: null, dv: null, profesional: null, horas_aviso_minimas: 48, dia_limite_pago: 10 },
    });
  });

  it("calcula el DV del RUC si no lo escriben", () => {
    const r = validarConsultorio(consultorio({ ruc: "1.000.001" }));
    expect(r.ok && r.datos).toMatchObject({ ruc: "1000001", dv: "1" });
  });

  it("avisa si el DV no coincide", () => {
    const r = validarConsultorio(consultorio({ ruc: "1000001", dv: "5" }));
    expect(!r.ok && r.errores.dv).toBe("El DV no coincide: para ese RUC es 1.");
  });

  it("borra el DV si no hay RUC", () => {
    const r = validarConsultorio(consultorio({ dv: "3" }));
    expect(r.ok && r.datos.dv).toBeNull();
  });

  it("rechaza día límite fuera de 1 a 28", () => {
    for (const dia of ["0", "29", "", "10.5"]) {
      const r = validarConsultorio(consultorio({ dia_limite_pago: dia }));
      expect(!r.ok && r.errores.dia_limite_pago).toBe("Elegí un día entre 1 y 28.");
    }
  });

  it("rechaza horas de aviso no enteras", () => {
    const r = validarConsultorio(consultorio({ horas_aviso_minimas: "-1" }));
    expect(!r.ok && r.errores.horas_aviso_minimas).toBeTruthy();
  });

  it("pide nombre y concepto", () => {
    const r = validarConsultorio(consultorio({ nombre: "  ", concepto_factura: "" }));
    expect(!r.ok && r.errores).toMatchObject({
      nombre: "Escribí el nombre del consultorio.",
      concepto_factura: "Escribí el concepto de la factura.",
    });
  });
});

describe("validarTarifa", () => {
  it.each(["290.000", "Gs. 290.000", "290000", " 290.000 "])("lee %s como 290000", (monto) => {
    expect(validarTarifa(formulario({ nombre: "Regular", monto_gs: monto }))).toEqual({
      ok: true,
      datos: { nombre: "Regular", monto_gs: 290000 },
    });
  });

  it("acepta 0", () => {
    const r = validarTarifa(formulario({ nombre: "Colegio", monto_gs: "0" }));
    expect(r.ok && r.datos.monto_gs).toBe(0);
  });

  it.each(["290.000,5", "", "-100", "abc"])("rechaza %s", (monto) => {
    const r = validarTarifa(formulario({ nombre: "Regular", monto_gs: monto }));
    expect(!r.ok && r.errores.monto_gs).toBe("Escribí el monto en guaraníes, sin decimales (ej. 290.000).");
  });

  it("pide el nombre", () => {
    const r = validarTarifa(formulario({ nombre: "", monto_gs: "1" }));
    expect(!r.ok && r.errores.nombre).toBe("Escribí el nombre de la tarifa.");
  });
});

const tipo = (datos: Record<string, string> = {}) =>
  formulario({ nombre: "Sesión", modalidad: "consultorio", color: "durazno", tarifa_id: "", genera_cobro: "on", requiere_paciente: "on", ...datos });

describe("validarTipoTurno", () => {
  it("tarifa vacía es la del paciente y los checkboxes se leen", () => {
    expect(validarTipoTurno(tipo())).toEqual({
      ok: true,
      datos: {
        nombre: "Sesión",
        modalidad: "consultorio",
        color: "durazno",
        tarifa_id: null,
        cobra_en_el_momento: false,
        genera_cobro: true,
        requiere_paciente: true,
      },
    });
  });

  it("acepta una tarifa fija", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const r = validarTipoTurno(tipo({ tarifa_id: id }));
    expect(r.ok && r.datos.tarifa_id).toBe(id);
  });

  it("un tipo que no lleva paciente no puede generar cobro", () => {
    const r = validarTipoTurno(tipo({ requiere_paciente: "" }));
    expect(!r.ok && r.errores.genera_cobro).toBe("Un tipo sin paciente no puede generar cobro.");
  });

  it("acepta un tipo sin paciente y sin cobro", () => {
    const r = validarTipoTurno(tipo({ nombre: "Reunión de equipo", modalidad: "online", requiere_paciente: "", genera_cobro: "" }));
    expect(r.ok && r.datos).toMatchObject({ requiere_paciente: false, genera_cobro: false });
  });

  it("no cobra en el momento si no genera cobro", () => {
    const r = validarTipoTurno(tipo({ cobra_en_el_momento: "on", genera_cobro: "" }));
    expect(!r.ok && r.errores.cobra_en_el_momento).toBe("Para cobrar en el momento, el tipo tiene que generar cobro.");
  });

  it("rechaza un color que no está en la paleta", () => {
    for (const color of ["", "fucsia"]) {
      const r = validarTipoTurno(tipo({ color }));
      expect(!r.ok && r.errores.color).toBe("Elegí un color.");
    }
  });

  it("rechaza modalidad desconocida y nombre vacío", () => {
    const r = validarTipoTurno(tipo({ nombre: " ", modalidad: "playa" }));
    expect(!r.ok && r.errores).toMatchObject({ nombre: "Escribí el nombre del tipo de turno.", modalidad: "Elegí dónde se hace." });
  });
});

const reglas = (datos: Record<string, string> = {}) =>
  formulario({
    presente: "100",
    ausente_con_aviso: "0",
    aviso_tardio: "100",
    ausente_sin_aviso: "100",
    cancelado_profesional: "0",
    reprogramado: "0",
    ...datos,
  });

describe("validarReglas", () => {
  it("acepta 0 y 100", () => {
    expect(validarReglas(reglas())).toEqual({
      ok: true,
      datos: { presente: 100, ausente_con_aviso: 0, aviso_tardio: 100, ausente_sin_aviso: 100, cancelado_profesional: 0, reprogramado: 0 },
    });
  });

  it.each(["101", "-1", "50.5", "", "abc"])("rechaza %s", (valor) => {
    const r = validarReglas(reglas({ aviso_tardio: valor }));
    expect(!r.ok && r.errores.aviso_tardio).toBe("Porcentaje entero de 0 a 100.");
  });
});

const PACIENTE = "00000000-0000-4000-8000-0000000000aa";
const excepcion = (datos: Record<string, string> = {}) =>
  formulario({ paciente_id: PACIENTE, estado: "aviso_tardio", porcentaje: "50", ...datos });

describe("validarExcepcion", () => {
  it("acepta una excepción nueva", () => {
    expect(validarExcepcion(excepcion(), [])).toEqual({
      ok: true,
      datos: { paciente_id: PACIENTE, estado: "aviso_tardio", porcentaje: 50 },
    });
  });

  it("no repite paciente + estado", () => {
    const r = validarExcepcion(excepcion(), [{ paciente_id: PACIENTE, estado: "aviso_tardio" }]);
    expect(!r.ok && r.errores.estado).toBe(ERROR_EXCEPCION_REPETIDA);
  });

  it("el mismo paciente puede tener otro estado", () => {
    const r = validarExcepcion(excepcion(), [{ paciente_id: PACIENTE, estado: "ausente_sin_aviso" }]);
    expect(r.ok).toBe(true);
  });

  it("rechaza porcentaje fuera de 0 a 100, sin paciente y estado agendado", () => {
    const r = validarExcepcion(excepcion({ paciente_id: "", estado: "agendado", porcentaje: "150" }), []);
    expect(!r.ok && r.errores).toMatchObject({
      paciente_id: "Elegí un paciente.",
      estado: "Elegí un estado.",
      porcentaje: "Porcentaje entero de 0 a 100.",
    });
  });
});
