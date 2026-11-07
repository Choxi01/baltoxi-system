import { describe, expect, it } from "vitest";
import { montoPeriodo, rangoMes, rangoSemana } from "@/lib/cobro/periodo";
import { imputarPagos } from "@/lib/cobro/saldo";
import {
  AVISO_PERIODO_SIN_MARCAR,
  armarMonto,
  lineaDetalle,
  montosDeTutor,
  opcionesPeriodo,
  periodoInicial,
  textoDetalle,
  type CargoDetalle,
} from "./monto";
import { PLANTILLAS_POR_DEFECTO } from "./plantillas";

// Datos inventados (regla de oro 8).
let n = 0;
const cargo = (fecha: string, extra: Partial<CargoDetalle> = {}): CargoDetalle => ({
  id: `cargo-${++n}`,
  fecha,
  monto_gs: 290000,
  paciente: "Tomi",
  estado: "presente",
  tipo: "Sesión",
  ...extra,
});
const pago = (fecha: string, monto_gs: number) => ({ id: `pago-${++n}`, fecha, monto_gs });
type PagoPrueba = ReturnType<typeof pago>;

const OCTUBRE = rangoMes("2026-10-15");

function detalle(cargos: CargoDetalle[], pagos: PagoPrueba[] = [], rango = OCTUBRE) {
  return textoDetalle({ cargos, imputacion: imputarPagos({ cargos, pagos }), ...rango, horasAvisoMinimas: 24 });
}

function armar(cargos: CargoDetalle[], pagos: PagoPrueba[] = [], plantilla = PLANTILLAS_POR_DEFECTO.monto_periodo) {
  return armarMonto({
    plantilla,
    tutor: "Laura",
    paciente: "Tomi",
    periodo: "octubre",
    datosPago: "Alias 0000000",
    cargos,
    imputacion: imputarPagos({ cargos, pagos }),
    rango: OCTUBRE,
    horasAvisoMinimas: 24,
  });
}

/** Suma los montos de las líneas: "• … – Gs. 290.000" o "• Ya pagado – -Gs. 290.000". */
const sumaLineas = (texto: string) =>
  texto.split("\n").reduce((s, l) => {
    const m = /(-?)Gs\. ([\d.]+)$/.exec(l)!;
    return s + (m[1] ? -1 : 1) * Number(m[2].replace(/\./g, ""));
  }, 0);

describe("lineaDetalle", () => {
  it("como en docs/mensajes.md", () => {
    expect(lineaDetalle(cargo("2026-10-03"), 24)).toBe("• 03/10 Tomi – Sesión – Gs. 290.000");
    expect(lineaDetalle(cargo("2026-10-10", { estado: "aviso_tardio" }), 24)).toBe("• 10/10 Tomi – Canceló con menos de 24 h – Gs. 290.000");
  });

  it("las horas salen de la configuración", () => {
    expect(lineaDetalle(cargo("2026-10-10", { estado: "aviso_tardio" }), 48)).toContain("Canceló con menos de 48 h");
  });

  it("usa el tipo de turno y el nombre de pila", () => {
    expect(lineaDetalle(cargo("2026-10-03", { tipo: "Sesión a domicilio", paciente: "María José" }), 24)).toBe(
      "• 03/10 María – Sesión a domicilio – Gs. 290.000",
    );
  });

  it("cada estado con su texto", () => {
    const texto = (estado: string) => lineaDetalle(cargo("2026-10-03", { estado, monto_gs: 0 }), 24);
    expect(texto("ausente_sin_aviso")).toContain("– No vino –");
    expect(texto("ausente_con_aviso")).toContain("– Canceló con aviso –");
    expect(texto("cancelado_profesional")).toContain("– Cancelada por la profesional –");
  });

  it("un ajuste sin paciente", () => {
    expect(lineaDetalle(cargo("2026-10-05", { paciente: null, estado: null, tipo: null, monto_gs: 50000 }), 24)).toBe("• 05/10 Ajuste – Gs. 50.000");
  });

  it('"No se cobra" al cancelar tarde (B9): aviso tardío en Gs. 0', () => {
    expect(lineaDetalle(cargo("2026-10-10", { estado: "aviso_tardio", monto_gs: 0 }), 24)).toBe("• 10/10 Tomi – Canceló con menos de 24 h – Gs. 0");
  });
});

describe("textoDetalle", () => {
  it("ordena por fecha y deja afuera lo que no es del período", () => {
    const cargos = [cargo("2026-10-20"), cargo("2026-10-03"), cargo("2026-09-30"), cargo("2026-11-01")];
    expect(detalle(cargos)).toBe("• 03/10 Tomi – Sesión – Gs. 290.000\n• 20/10 Tomi – Sesión – Gs. 290.000");
  });

  it("hermanos el mismo día: por nombre", () => {
    const cargos = [cargo("2026-10-03", { paciente: "Tomi" }), cargo("2026-10-03", { paciente: "Sofi" })];
    expect(detalle(cargos).split("\n")[0]).toContain("Sofi");
  });

  it("cancelaciones en Gs. 0 sí van, un reprogramado no", () => {
    const cargos = [
      cargo("2026-10-03", { estado: "ausente_con_aviso", monto_gs: 0 }),
      cargo("2026-10-10", { estado: "reprogramado", monto_gs: 0 }),
      cargo("2026-10-12"),
    ];
    const texto = detalle(cargos);
    expect(texto).toContain("03/10");
    expect(texto).not.toContain("10/10");
    expect(texto).toContain("12/10");
  });

  it("un reprogramado que sí se cobró (regla cambiada) va, para que la cuenta cierre", () => {
    expect(detalle([cargo("2026-10-10", { estado: "reprogramado" })])).toContain("Reprogramada");
  });

  it('"Ya pagado" solo cuenta lo imputado a este período', () => {
    // El pago de 400.000 cubre septiembre (290.000) y 110.000 de octubre.
    const cargos = [cargo("2026-09-20"), cargo("2026-10-03")];
    expect(detalle(cargos, [pago("2026-10-05", 400000)])).toBe("• 03/10 Tomi – Sesión – Gs. 290.000\n• Ya pagado – -Gs. 110.000");
  });

  it("sin pagos no hay línea de pagado", () => {
    expect(detalle([cargo("2026-10-03")])).not.toContain("Ya pagado");
  });
});

describe("las líneas suman el total", () => {
  it("monto semanal: 2 sesiones y ya pagó 290.000 (caso 20)", () => {
    const cargos = [cargo("2026-11-09"), cargo("2026-11-12")];
    const pagos = [pago("2026-11-09", 290000)];
    const imputacion = imputarPagos({ cargos, pagos });
    const rango = rangoSemana("2026-11-12");
    expect(montoPeriodo({ cargos, imputacion, ...rango })).toBe(290000);
    expect(sumaLineas(detalle(cargos, pagos, rango))).toBe(290000);
  });

  it("dos hermanos: un solo total (caso 22)", () => {
    const cargos = [cargo("2026-10-03", { paciente: "Tomi" }), cargo("2026-10-05", { paciente: "Sofi" })];
    expect(armar(cargos)!.total).toBe(580000);
    expect(sumaLineas(detalle(cargos))).toBe(580000);
  });

  it("con pago parcial, deuda vieja, aviso tardío en 0 y reprogramado", () => {
    const cargos = [
      cargo("2026-09-20"),
      cargo("2026-10-03"),
      cargo("2026-10-10", { estado: "aviso_tardio", monto_gs: 0 }),
      cargo("2026-10-14", { estado: "reprogramado", monto_gs: 0 }),
      cargo("2026-10-17", { monto_gs: 142778 }),
    ];
    const pagos = [pago("2026-10-05", 350000)];
    expect(sumaLineas(detalle(cargos, pagos))).toBe(armar(cargos, pagos)!.total);
  });

  it("un ajuste negativo cuenta una sola vez", () => {
    const cargos = [cargo("2026-10-03"), cargo("2026-10-05", { paciente: null, estado: null, tipo: null, monto_gs: -50000 })];
    expect(armar(cargos)!.total).toBe(240000);
    expect(sumaLineas(detalle(cargos))).toBe(240000);
    expect(detalle(cargos)).toContain("Ya pagado – -Gs. 50.000");
  });
});

describe("armarMonto", () => {
  const sinDetalle = "Hola Laura, ¿cómo estás? Te paso el monto de las sesiones de octubre: Gs. 290.000. Alias 0000000. ¡Gracias!";

  it("plantilla sin {detalle}: las líneas van al final", () => {
    const r = armar([cargo("2026-10-03")])!;
    expect(r.texto).toBe(sinDetalle);
    expect(r.textoConDetalle).toBe(`${sinDetalle}\n\n• 03/10 Tomi – Sesión – Gs. 290.000`);
  });

  it("plantilla con {detalle}: las líneas van ahí, y apagado no queda nada", () => {
    const r = armar([cargo("2026-10-03")], [], "Hola {tutor}: {total}\n\n{detalle}\n\n{datos_pago}")!;
    expect(r.texto).toBe("Hola Laura: Gs. 290.000\n\nAlias 0000000");
    expect(r.textoConDetalle).toBe("Hola Laura: Gs. 290.000\n\n• 03/10 Tomi – Sesión – Gs. 290.000\n\nAlias 0000000");
  });

  it("total 0 o a favor: null", () => {
    expect(armar([cargo("2026-10-03")], [pago("2026-10-03", 290000)])).toBeNull();
    expect(armar([cargo("2026-10-03")], [pago("2026-10-03", 500000)])).toBeNull();
    expect(armar([cargo("2026-10-03", { estado: "ausente_con_aviso", monto_gs: 0 })])).toBeNull();
  });

  it("no usa motivos ni conceptos aunque vengan en los datos (regla de oro 7)", () => {
    const c = {
      ...cargo("2026-10-10", { estado: "aviso_tardio" }),
      concepto: "DATO CLINICO",
      motivo: "DATO CLINICO",
      motivo_excepcion: "DATO CLINICO",
    };
    expect(armar([c])!.textoConDetalle).not.toContain("DATO CLINICO");
  });
});

describe("opcionesPeriodo", () => {
  it("esta semana, este mes y el mes pasado, con las referencias de la bandeja", () => {
    expect(opcionesPeriodo("2026-11-06")).toEqual([
      {
        id: "semana",
        titulo: "Esta semana",
        rango: { desde: "2026-11-02", hasta: "2026-11-08" },
        referencia: "2026-W45",
        periodo: "la semana del 2 al 6/11",
      },
      { id: "mes", titulo: "Este mes", rango: { desde: "2026-11-01", hasta: "2026-11-30" }, referencia: "2026-11", periodo: "noviembre" },
      { id: "mes_pasado", titulo: "Mes pasado", rango: { desde: "2026-10-01", hasta: "2026-10-31" }, referencia: "2026-10", periodo: "octubre" },
    ]);
  });

  it("en enero, el mes pasado es diciembre del año anterior", () => {
    expect(opcionesPeriodo("2027-01-15")[2]).toMatchObject({ referencia: "2026-12", periodo: "diciembre" });
  });
});

describe("montosDeTutor", () => {
  const base = {
    hoy: "2026-11-06",
    tutor: { id: "t1", nombre: "Laura María", tutor: "Laura María Prueba", telefono: "595981000001" },
    plantilla: PLANTILLAS_POR_DEFECTO.monto_periodo,
    datosPago: "Alias 0000000",
    horasAvisoMinimas: 24,
    cargos: [] as CargoDetalle[],
    pagos: [] as PagoPrueba[],
    fechasSinMarcar: [] as string[],
    referenciasEnviadas: [] as string[],
  };
  const de = (lista: ReturnType<typeof montosDeTutor>, id: string) => lista.find((m) => m.id === id)!;

  it("total de la familia por período, con los hermanos juntos", () => {
    const r = montosDeTutor({
      ...base,
      cargos: [cargo("2026-10-20", { paciente: "Sofi" }), cargo("2026-11-03", { paciente: "Tomi" }), cargo("2026-11-04", { paciente: "Sofi" })],
    });
    expect(de(r, "mes").mensaje).toMatchObject({
      clave: "monto_periodo",
      referencia: "2026-11",
      tutorId: "t1",
      tutor: "Laura María Prueba",
      telefono: "595981000001",
      texto: "Hola Laura, ¿cómo estás? Te paso el monto de las sesiones de noviembre: Gs. 580.000. Alias 0000000. ¡Gracias!",
    });
    expect(de(r, "mes_pasado").mensaje?.texto).toContain("octubre: Gs. 290.000");
  });

  it("{paciente} une a los hermanos con cargos en el período", () => {
    const r = montosDeTutor({
      ...base,
      plantilla: "{paciente}: {total}",
      cargos: [cargo("2026-11-03", { paciente: "Tomi" }), cargo("2026-11-04", { paciente: "Sofi" })],
    });
    expect(de(r, "mes").mensaje?.texto).toBe("Tomi y Sofi: Gs. 580.000");
  });

  it("sin nada para cobrar, el mensaje es null", () => {
    expect(montosDeTutor(base).every((m) => m.mensaje === null)).toBe(true);
  });

  it("marca lo ya enviado por referencia", () => {
    const r = montosDeTutor({ ...base, cargos: [cargo("2026-11-03")], referenciasEnviadas: ["2026-11"] });
    expect(de(r, "mes").enviado).toBe(true);
    expect(de(r, "semana").enviado).toBe(false);
  });

  it("avisa si hay turnos sin marcar hasta hoy, no por los que todavía no pasaron", () => {
    const r = montosDeTutor({ ...base, fechasSinMarcar: ["2026-10-29", "2026-11-20"] });
    expect(de(r, "mes_pasado").aviso).toBe(AVISO_PERIODO_SIN_MARCAR);
    expect(de(r, "mes").aviso).toBeUndefined();
  });
});

describe("periodoInicial", () => {
  const con = (...ids: string[]) =>
    (["semana", "mes", "mes_pasado"] as const).map((id) => ({ id, mensaje: ids.includes(id) ? ({} as never) : null }));

  it("el del plan de la familia", () => {
    expect(periodoInicial(con("semana", "mes"), ["mensual"])).toBe("mes");
    expect(periodoInicial(con("semana", "mes"), ["semanal"])).toBe("semana");
    expect(periodoInicial(con("semana", "mes"), ["semanal", "mensual"])).toBe("mes");
  });

  it("si ahí no hay nada, uno con algo para cobrar", () => {
    expect(periodoInicial(con("mes_pasado"), ["mensual"])).toBe("mes_pasado");
  });

  it("sin nada en ninguno, el del plan", () => {
    expect(periodoInicial(con(), ["semanal"])).toBe("semana");
  });
});
