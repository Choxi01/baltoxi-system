import { describe, expect, it } from "vitest";
import { datosCancelacion, mostrarSeCobra, MOTIVO_AL_CANCELAR, pendientesDeReponer, validarNoSeCobra } from "./cancelacion";

// Los casos de clasificarCancelacion (2 a 5) están en src/lib/cobro/casos.test.ts.
const INICIO = new Date("2026-11-05T12:00:00Z");
const horasAntes = (h: number) => new Date(INICIO.getTime() - h * 3_600_000);

describe("datosCancelacion", () => {
  it("cancela la profesional: queda para reponer, sin aviso", () => {
    expect(datosCancelacion("profesional", { inicio: INICIO }, horasAntes(1), 48)).toEqual({
      estado: "cancelado_profesional",
      aviso_en: null,
      reponer: true,
    });
  });

  it("cancela la familia: guarda cuándo avisó y lo clasifica", () => {
    expect(datosCancelacion("familia", { inicio: INICIO }, horasAntes(72), 48)).toEqual({
      estado: "ausente_con_aviso",
      aviso_en: "2026-11-02T12:00:00.000Z",
      reponer: false,
    });
    expect(datosCancelacion("familia", { inicio: INICIO }, horasAntes(10), 48).estado).toBe("aviso_tardio");
  });
});

describe("datosCancelacion: ¿se cobra? (B9)", () => {
  const tarde = (motivo: string) => datosCancelacion("familia", { inicio: INICIO }, horasAntes(10), 48, { motivo });

  it("Se cobra: aviso tardío sin excepción (cobra la regla)", () => {
    expect(datosCancelacion("familia", { inicio: INICIO }, horasAntes(10), 48, null)).toEqual({
      estado: "aviso_tardio",
      aviso_en: "2026-11-05T02:00:00.000Z",
      reponer: false,
    });
  });

  it("No se cobra: sigue siendo aviso tardío, con excepción de 0% y el motivo escrito", () => {
    expect(tarde("  Acuerdo con la familia ")).toEqual({
      estado: "aviso_tardio",
      aviso_en: "2026-11-05T02:00:00.000Z",
      reponer: false,
      porcentaje_manual: 0,
      motivo_excepcion: "Acuerdo con la familia",
    });
  });

  it("No se cobra sin motivo: queda el de por defecto (la base exige uno)", () => {
    expect(tarde("").motivo_excepcion).toBe("Excepción al cancelar");
    expect(tarde("   ").motivo_excepcion).toBe("Excepción al cancelar");
  });

  it("con aviso a tiempo se ignora: no queda una excepción colgada", () => {
    const datos = datosCancelacion("familia", { inicio: INICIO }, horasAntes(72), 48, { motivo: "x" });
    expect(datos.estado).toBe("ausente_con_aviso");
    expect(datos).not.toHaveProperty("porcentaje_manual");
    expect(datos).not.toHaveProperty("motivo_excepcion");
  });

  it("si cancela la profesional se ignora", () => {
    expect(datosCancelacion("profesional", { inicio: INICIO }, horasAntes(1), 48, { motivo: "x" })).toEqual({
      estado: "cancelado_profesional",
      aviso_en: null,
      reponer: true,
    });
  });
});

describe("validarNoSeCobra", () => {
  it("sin 'No se cobra' no hay nada que validar", () => {
    expect(validarNoSeCobra(null)).toEqual({ ok: true, datos: null });
    expect(validarNoSeCobra(undefined)).toEqual({ ok: true, datos: null });
  });

  it("limpia el motivo y, si no hay uno que sirva, usa el de por defecto", () => {
    expect(validarNoSeCobra({ motivo: " Acuerdo " })).toEqual({ ok: true, datos: { motivo: "Acuerdo" } });
    expect(validarNoSeCobra({ motivo: "" })).toEqual({ ok: true, datos: { motivo: MOTIVO_AL_CANCELAR } });
    expect(validarNoSeCobra({ motivo: 5 })).toEqual({ ok: true, datos: { motivo: MOTIVO_AL_CANCELAR } });
  });

  it("rechaza un motivo de más de 200 letras, como Excepción", () => {
    expect(validarNoSeCobra({ motivo: "a".repeat(201) })).toEqual({ ok: false, error: "Motivo: hasta 200 letras." });
  });
});

describe("mostrarSeCobra", () => {
  it("canceló la familia, tarde y hay monto", () => {
    expect(mostrarSeCobra("familia", "aviso_tardio", 290_000)).toBe(true);
  });

  it("si no se pudo saber el monto o todavía no llegó, pregunta igual", () => {
    expect(mostrarSeCobra("familia", "aviso_tardio", "desconocido")).toBe(true);
    expect(mostrarSeCobra("familia", "aviso_tardio", undefined)).toBe(true);
  });

  it("sin nada para cobrar no pregunta: regla en 0% o tipo que no cobra", () => {
    expect(mostrarSeCobra("familia", "aviso_tardio", 0)).toBe(false);
    expect(mostrarSeCobra("familia", "aviso_tardio", null)).toBe(false);
  });

  it("con aviso a tiempo, si cancelé yo o sin elegir quién, no pregunta", () => {
    expect(mostrarSeCobra("familia", "ausente_con_aviso", 290_000)).toBe(false);
    expect(mostrarSeCobra("profesional", "aviso_tardio", 290_000)).toBe(false);
    expect(mostrarSeCobra(null, "aviso_tardio", 290_000)).toBe(false);
  });
});

describe("pendientesDeReponer", () => {
  const cancelado = (id: string) => ({ id, reponer: true, estado: "cancelado_profesional" });

  it("los cancelados por la profesional sin reposición", () => {
    expect(pendientesDeReponer([cancelado("a"), cancelado("b")], [{ repone_a: "a", estado: "agendado" }]).map((t) => t.id)).toEqual(["b"]);
  });

  it("si la reposición también se canceló, vuelve a la lista", () => {
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "ausente_con_aviso" }])).toHaveLength(1);
  });

  it("una reposición que ya pasó (vino o no vino) cuenta como repuesta", () => {
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "presente" }])).toEqual([]);
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "ausente_sin_aviso" }])).toEqual([]);
  });

  it("si la profesional cancela la reposición, queda una sola para reponer (la reposición)", () => {
    const reposicion = { id: "r", ...datosCancelacion("profesional", { inicio: INICIO }, horasAntes(1), 48) };
    const pendientes = pendientesDeReponer([cancelado("a"), reposicion], [{ repone_a: "a", estado: reposicion.estado }]);
    expect(pendientes.map((t) => t.id)).toEqual(["r"]);
  });

  it("una reposición agendada bloquea reponer de nuevo la misma sesión", () => {
    expect(pendientesDeReponer([cancelado("a")], [{ repone_a: "a", estado: "agendado" }])).toEqual([]);
  });

  it("ignora los que no son para reponer", () => {
    expect(pendientesDeReponer([{ id: "x", reponer: false, estado: "cancelado_profesional" }], [])).toEqual([]);
  });
});
