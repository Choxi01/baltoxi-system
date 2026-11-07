import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import type { CriterioAusencias, CriterioHoras } from "./criterios-reportes";
import { CRITERIO_AUSENCIAS, CRITERIO_HORAS } from "./criterios-reportes";
import {
  armarReporte,
  comparacionMeses,
  detallePorDia,
  generadoPorDia,
  horasDelRango,
  horasTrabajadas,
  marcasEje,
  mesValido,
  montoCorto,
  montosAgendadosRestantes,
  pendienteDelRango,
  pendientesPorCargo,
  proyeccionMes,
  semanaReporte,
  semanaValida,
  serieMes,
  subtituloFila,
  tasaAusenciasSinCobro,
  tasaDelMes,
  textoHoras,
  textoSinMonto,
  type CargoReporte,
  type TurnoReporte,
} from "./reportes";
import { armarExcelReportes, nombreExcelReportes } from "./reportes-excel";

// Todos los datos son inventados (regla de oro 8).

const TARIFAS = [{ id: "regular", nombre: "Regular", monto_gs: 290000 }];
const TIPO = { tarifa_id: null, genera_cobro: true, cobra_en_el_momento: false, requiere_paciente: true, modalidad: "consultorio" as const };
const PACIENTE = { tarifa_id: "regular", monto_override_gs: null };

let n = 0;
const cargo = (fecha: string, monto_gs: number, extra: Partial<CargoReporte> = {}): CargoReporte => ({
  id: `c${++n}`,
  tutor_id: "t1",
  turno_id: null,
  tipo: "sesion",
  fecha,
  monto_gs,
  ...extra,
});

const turno = (fecha: string, extra: Partial<TurnoReporte> = {}, hora = "10:00", horaFin = "10:45"): TurnoReporte => ({
  id: `u${++n}`,
  clase: "turno",
  estado: "agendado",
  inicio: `${fecha}T${hora}:00-03:00`,
  fin: `${fecha}T${horaFin}:00-03:00`,
  motivo_ocupado: null,
  tipoTurno: TIPO,
  paciente: PACIENTE,
  ...extra,
});

const ocupado = (fecha: string, motivo: string, hora = "10:00", horaFin = "11:00") =>
  turno(fecha, { clase: "ocupado", motivo_ocupado: motivo, tipoTurno: null, paciente: null }, hora, horaFin);

describe("generado por día y semana", () => {
  it("suma cada día", () => {
    const cargos = [cargo("2026-11-02", 290000), cargo("2026-11-02", 280000), cargo("2026-11-03", 350000)];
    expect(generadoPorDia(cargos, ["2026-11-02", "2026-11-03", "2026-11-04"]).map((d) => d.monto)).toEqual([570000, 350000, 0]);
  });

  it("muestra lunes a viernes si no hay más", () => {
    const { dias } = semanaReporte({ semana: "2026-11-02", cargos: [], diasConHorario: [1, 2, 3, 4, 5] });
    expect(dias.map((d) => d.fecha)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("un sábado sin horario que generó aparece, y el total da igual a la suma de los días", () => {
    const cargos = [cargo("2026-11-02", 290000), cargo("2026-11-07", 350000)];
    const { dias, total } = semanaReporte({ semana: "2026-11-02", cargos, diasConHorario: [1, 2, 3, 4, 5] });
    expect(dias.at(-1)).toEqual({ fecha: "2026-11-07", monto: 350000 });
    expect(total).toBe(640000);
    expect(dias.reduce((s, d) => s + d.monto, 0)).toBe(total);
  });

  it("un sábado con horario aparece aunque esté en 0", () => {
    const { dias } = semanaReporte({ semana: "2026-11-02", cargos: [], diasConHorario: [1, 6] });
    expect(dias.map((d) => d.fecha)).toContain("2026-11-07");
  });
});

describe("pendiente del mes", () => {
  it("imputa FIFO: el pago cubre primero lo más viejo", () => {
    const cargos = [cargo("2026-09-10", 580000), cargo("2026-10-10", 870000)];
    const pagos = [{ id: "p1", tutor_id: "t1", fecha: "2026-11-01", monto_gs: 1000000 }];
    const pendientes = pendientesPorCargo({ cargos, pagos });
    expect(pendienteDelRango(pendientes, "2026-09-01", "2026-09-30")).toBe(0);
    expect(pendienteDelRango(pendientes, "2026-10-01", "2026-10-31")).toBe(450000);
  });

  it("el pago de un tutor no cubre la deuda de otro", () => {
    const cargos = [cargo("2026-10-05", 290000, { tutor_id: "t1" }), cargo("2026-10-06", 290000, { tutor_id: "t2" })];
    const pagos = [{ id: "p1", tutor_id: "t1", fecha: "2026-10-30", monto_gs: 500000 }];
    expect(pendienteDelRango(pendientesPorCargo({ cargos, pagos }), "2026-10-01", "2026-10-31")).toBe(290000);
  });

  it("un ajuste negativo baja el pendiente una sola vez", () => {
    const cargos = [cargo("2026-10-05", 290000), cargo("2026-10-20", -40000, { tipo: "ajuste" })];
    expect(pendienteDelRango(pendientesPorCargo({ cargos, pagos: [] }), "2026-10-01", "2026-10-31")).toBe(250000);
  });
});

describe("agendados que quedan", () => {
  const armar = (turnos: TurnoReporte[], hoy = "2026-11-10") => montosAgendadosRestantes({ turnos, tarifas: TARIFAS, mes: "2026-11-01", hoy });

  it("cuenta desde hoy inclusive; los de días pasados quedan sin marcar", () => {
    const r = armar([turno("2026-11-09"), turno("2026-11-10"), turno("2026-11-20")]);
    expect(r.restantes.map((x) => x.fecha)).toEqual(["2026-11-10", "2026-11-20"]);
    expect(r.sinMarcar).toBe(1);
  });

  it("un paciente sin tarifa se saltea y se cuenta, sin romper el reporte", () => {
    const r = armar([turno("2026-11-20", { paciente: { tarifa_id: null, monto_override_gs: null } }), turno("2026-11-21")]);
    expect(r.restantes).toHaveLength(1);
    expect(r.sinTarifa).toBe(1);
  });

  it("deja afuera reservados, ocupados, tipos sin cobro, ya marcados y otros meses", () => {
    const r = armar([
      turno("2026-11-20", { clase: "reservado", paciente: null }),
      ocupado("2026-11-20", "Trámite"),
      turno("2026-11-20", { tipoTurno: { ...TIPO, genera_cobro: false } }),
      turno("2026-11-20", { estado: "presente" }),
      turno("2026-12-01"),
    ]);
    expect(r).toEqual({ restantes: [], sinMarcar: 0, sinTarifa: 0 });
  });

  it("usa la zona de Asunción: las 23:00 del 31/10 no son de noviembre aunque en UTC ya sea 1/11", () => {
    const t = turno("2026-10-31", {}, "23:00", "23:45");
    expect(new Date(t.inicio).toISOString().slice(0, 10)).toBe("2026-11-01");
    expect(armar([t], "2026-10-01").restantes).toEqual([]);
  });
});

describe("tasa del mes", () => {
  const historia = (fecha: string, cantidad: number, estado: TurnoReporte["estado"], monto: number) => {
    const turnos = Array.from({ length: cantidad }, () => turno(fecha, { estado }));
    return { turnos, cargos: turnos.map((t) => cargo(fecha, monto, { turno_id: t.id })) };
  };

  it("mira los 3 meses anteriores y no el mes del reporte", () => {
    const vinieron = historia("2026-08-10", 18, "presente", 290000);
    const faltaron = historia("2026-10-10", 2, "ausente_con_aviso", 0);
    const delMes = historia("2026-11-02", 20, "ausente_con_aviso", 0);
    const viejos = historia("2026-07-31", 20, "ausente_con_aviso", 0);
    const todos = [vinieron, faltaron, delMes, viejos];
    const tasa = tasaDelMes({ turnos: todos.flatMap((h) => h.turnos), cargos: todos.flatMap((h) => h.cargos), mes: "2026-11-01" });
    expect(tasa).toBeCloseTo(0.1);
  });

  it("un tipo sin cobro (sin cargo) no cuenta como ausencia", () => {
    const vinieron = historia("2026-10-10", 20, "presente", 290000);
    const sinCargo = Array.from({ length: 5 }, () => turno("2026-10-11", { estado: "presente" }));
    expect(tasaDelMes({ turnos: [...vinieron.turnos, ...sinCargo], cargos: vinieron.cargos, mes: "2026-11-01" })).toBe(0);
  });

  it("el criterio se puede cambiar sin tocar la función", () => {
    const turnos = [
      ...Array(18).fill({ estado: "presente", monto_cargo: 290000 }),
      ...Array(2).fill({ estado: "cancelado_profesional", monto_cargo: 0 }),
    ];
    expect(tasaAusenciasSinCobro(turnos)).toBeCloseTo(0.1);
    const sinLaProfesional: CriterioAusencias = { ...CRITERIO_AUSENCIAS, estadosFuera: ["agendado", "reprogramado", "cancelado_profesional"], historiaMinima: 18 };
    expect(tasaAusenciasSinCobro(turnos, sinLaProfesional)).toBe(0);
  });
});

describe("serie del mes", () => {
  const cargos = [cargo("2026-11-02", 290000), cargo("2026-11-05", 290000)];
  const restantes = [
    { fecha: "2026-11-10", monto: 290000 },
    { fecha: "2026-11-20", monto: 290000 },
  ];

  it("el último punto da igual que proyeccionMes", () => {
    const serie = serieMes({ mes: "2026-11-01", hoy: "2026-11-06", cargos, restantes, tasa: 0.1 });
    expect(serie).toHaveLength(30);
    expect(serie.at(-1)!.proyeccion).toBe(proyeccionMes({ generado: 580000, montosBaseAgendados: [290000, 290000], tasa: 0.1 }));
  });

  it("lo real llega hasta hoy y la punteada arranca en hoy desde el mismo punto", () => {
    const serie = serieMes({ mes: "2026-11-01", hoy: "2026-11-06", cargos, restantes, tasa: 0 });
    expect(serie[4]).toEqual({ fecha: "2026-11-05", real: 580000, proyeccion: null });
    expect(serie[5]).toEqual({ fecha: "2026-11-06", real: 580000, proyeccion: 580000 });
    expect(serie[6].real).toBeNull();
    expect(serie[9].proyeccion).toBe(870000);
  });

  it("hoy último día del mes: no hay días para proyectar", () => {
    const serie = serieMes({ mes: "2026-11-01", hoy: "2026-11-30", cargos, restantes: [], tasa: 0 });
    expect(serie.filter((p) => p.proyeccion !== null)).toHaveLength(1);
  });

  it("un mes pasado no tiene proyección", () => {
    const serie = serieMes({ mes: "2026-10-01", hoy: "2026-11-06", cargos: [cargo("2026-10-31", 290000)], restantes: [], tasa: 0 });
    expect(serie.every((p) => p.proyeccion === null)).toBe(true);
    expect(serie.at(-1)!.real).toBe(290000);
  });
});

describe("horas trabajadas", () => {
  const ahora = new Date("2026-11-30T12:00:00-03:00");
  const horas = (turnos: TurnoReporte[], criterio?: CriterioHoras) => horasDelRango(turnos, "2026-11-01", "2026-11-30", ahora, criterio);

  it("el motivo cuenta con o sin acento y con mayúsculas", () => {
    expect(horas([ocupado("2026-11-10", "Reunión de equipo")])).toBe(1);
    expect(horas([ocupado("2026-11-10", "reunion con la escuela")])).toBe(1);
    expect(horas([ocupado("2026-11-10", "COLEGIO")])).toBe(1);
  });

  it("otro motivo no suma", () => {
    expect(horas([ocupado("2026-11-10", "Trámite en el banco")])).toBe(0);
  });

  it("solo suma lo que ya terminó", () => {
    expect(horasDelRango([ocupado("2026-11-20", "Reunión")], "2026-11-01", "2026-11-30", new Date("2026-11-10T12:00:00-03:00"))).toBe(0);
  });

  it("suma los presentes y deja afuera las ausencias y otros meses", () => {
    const turnos = [
      turno("2026-11-10", { estado: "presente" }),
      turno("2026-11-11", { estado: "ausente_sin_aviso" }),
      turno("2026-10-30", { estado: "presente" }),
    ];
    expect(horas(turnos)).toBe(0.75);
  });

  it("el criterio se puede cambiar sin tocar la función", () => {
    const palabras: CriterioHoras = { ...CRITERIO_HORAS, palabrasOcupado: ["tramite"] };
    expect(horas([ocupado("2026-11-10", "Trámite en el banco")], palabras)).toBe(1);
    const conTardios: CriterioHoras = { ...CRITERIO_HORAS, estadosTurno: ["presente", "aviso_tardio"] };
    expect(horasTrabajadas([turno("2026-11-10", { estado: "aviso_tardio" })], conTardios)).toBe(0.75);
  });
});

describe("comparación de 6 meses", () => {
  it("termina en el mes elegido y cruza el año", () => {
    const meses = comparacionMeses({
      mes: "2026-02-01",
      cargos: [cargo("2025-09-15", 290000), cargo("2026-02-15", 350000), cargo("2025-08-31", 999000)],
      pagos: [{ fecha: "2026-01-10", monto_gs: 290000 }],
      pendientes: [{ fecha: "2026-02-15", pendiente: 350000 }],
      turnos: [],
      ahora: new Date("2026-02-20T12:00:00-03:00"),
    });
    expect(meses.map((m) => m.mes)).toEqual(["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
    expect(meses[0].generado).toBe(290000);
    expect(meses[4].cobrado).toBe(290000);
    expect(meses[5]).toMatchObject({ generado: 350000, pendiente: 350000 });
  });
});

describe("detalle del día", () => {
  const base = { fecha: "2026-11-02", estado: "presente" as const, inicio: "10:00", tipo: "Sesión", porcentajeManual: null };

  it("muestra los turnos con paciente y su monto, sin reservados ni ocupados", () => {
    const detalle = detallePorDia(
      [
        { ...base, id: "a", clase: "turno", titulo: "Niño Inventado" },
        { ...base, id: "b", clase: "ocupado", titulo: "Motivo privado", tipo: null },
        { ...base, id: "c", clase: "reservado", titulo: "Fulano de Prueba", tipo: null },
      ],
      [cargo("2026-11-02", 290000, { turno_id: "a" })],
    );
    expect(detalle["2026-11-02"]).toHaveLength(1);
    expect(detalle["2026-11-02"][0]).toMatchObject({ paciente: "Niño Inventado", monto: 290000 });
  });

  it("un turno sin marcar no tiene monto ni estado", () => {
    const detalle = detallePorDia([{ ...base, estado: "agendado", id: "a", clase: "turno", titulo: "Niño Inventado" }], []);
    const fila = detalle["2026-11-02"][0];
    expect(fila.monto).toBeNull();
    expect(subtituloFila(fila)).toBe("Sesión");
    expect(textoSinMonto(fila)).toBe("Sin marcar");
  });

  it("el estado explica por qué un turno da Gs. 0, como en la agenda", () => {
    const detalle = detallePorDia(
      [
        { ...base, id: "a", clase: "turno", titulo: "Niño Inventado", estado: "ausente_sin_aviso", porcentajeManual: 0 },
        { ...base, id: "b", clase: "turno", titulo: "Niña Inventada", estado: "aviso_tardio" },
      ],
      [cargo("2026-11-02", 0, { turno_id: "a" }), cargo("2026-11-02", 290000, { turno_id: "b" })],
    );
    expect(detalle["2026-11-02"].map(subtituloFila)).toEqual(["Sesión · No vino · Excepción 0%", "Sesión · Canceló tarde"]);
  });

  it("un turno marcado de un tipo que no genera cobro dice que no tiene cargo", () => {
    const detalle = detallePorDia([{ ...base, id: "a", clase: "turno", titulo: "Niño Inventado" }], []);
    expect(textoSinMonto(detalle["2026-11-02"][0])).toBe("Sin cargo");
  });

  it("un ajuste aparece sin texto libre, para que la suma del día cierre", () => {
    const detalle = detallePorDia([], [cargo("2026-11-02", -40000, { tipo: "ajuste" })]);
    expect(detalle["2026-11-02"][0]).toMatchObject({ tipo: "Ajuste", monto: -40000, hora: null, paciente: null });
  });
});

describe("parámetros de la dirección", () => {
  const hoy = "2026-11-06";

  it("mes", () => {
    expect(mesValido("2026-10", hoy)).toBe("2026-10-01");
    expect(mesValido("2026-11", hoy)).toBe("2026-11-01");
    expect(mesValido("2026-12", hoy)).toBeNull();
    expect(mesValido("2026-13", hoy)).toBeNull();
    expect(mesValido("noviembre", hoy)).toBeNull();
    expect(mesValido(["2026-10"], hoy)).toBeNull();
    expect(mesValido(undefined, hoy)).toBeNull();
  });

  it("semana", () => {
    expect(semanaValida("2026-10-28", hoy)).toBe("2026-10-26");
    expect(semanaValida("2026-02-31", hoy)).toBe("2026-11-02");
    expect(semanaValida("cualquier-cosa", hoy)).toBe("2026-11-02");
    expect(semanaValida(undefined, hoy)).toBe("2026-11-02");
  });
});

describe("textos y eje", () => {
  it("horas", () => {
    expect(textoHoras(32.25)).toBe("32 h 15 min");
    expect(textoHoras(2)).toBe("2 h");
    expect(textoHoras(0)).toBe("0 h");
    expect(textoHoras(1.9999)).toBe("2 h");
  });

  it("montos cortos", () => {
    expect(montoCorto(500000)).toBe("500 mil");
    expect(montoCorto(2500000)).toBe("2,5 M");
    expect(montoCorto(0)).toBe("0");
  });

  it("las marcas del eje son redondas, cubren el máximo y son pocas", () => {
    for (const maximo of [1, 290000, 1000000, 4205000, 9999999, 123456789]) {
      const marcas = marcasEje(maximo);
      expect(marcas[0]).toBe(0);
      expect(marcas.at(-1)!).toBeGreaterThanOrEqual(maximo);
      expect(marcas.length).toBeLessThanOrEqual(5);
    }
    expect(marcasEje(0)).toEqual([0, 100000]);
  });
});

describe("reporte completo y Excel", () => {
  const MOTIVO = "Motivo privado inventado";
  const armar = (mes = "2026-11-01") =>
    armarReporte({
      mes,
      semana: "2026-11-02",
      hoy: "2026-11-06",
      ahora: new Date("2026-11-06T12:00:00-03:00"),
      cargos: [cargo("2026-11-02", 290000), cargo("2026-11-06", 290000), cargo("2026-10-15", 350000)],
      pagos: [{ id: "p1", tutor_id: "t1", fecha: "2026-11-03", monto_gs: 350000 }],
      turnos: [turno("2026-11-20"), ocupado("2026-11-03", `Reunión. ${MOTIVO}`)],
      tarifas: TARIFAS,
      diasConHorario: [1, 2, 3, 4, 5],
      turnosSemana: [
        { id: "x", clase: "turno", estado: "presente", fecha: "2026-11-02", inicio: "10:00", titulo: "Niño Inventado", tipo: "Sesión", porcentajeManual: null },
        { id: "y", clase: "ocupado", estado: "agendado", fecha: "2026-11-03", inicio: "10:00", titulo: MOTIVO, tipo: null, porcentajeManual: null },
      ],
    });

  it("calcula las tarjetas del mes", () => {
    expect(armar()).toMatchObject({
      esMesActual: true,
      generadoHoy: 290000,
      generadoMes: 580000,
      proyeccion: 870000,
      cobradoMes: 350000,
      pendienteMes: 580000,
      horasMes: 1,
    });
  });

  it("un mes pasado no tiene proyección", () => {
    expect(armar("2026-10-01")).toMatchObject({ esMesActual: false, proyeccion: null, generadoMes: 350000 });
  });

  it("el motivo de un bloque ocupado no sale hacia el navegador", () => {
    expect(JSON.stringify(armar())).not.toContain(MOTIVO);
  });

  it("el Excel tiene las 3 hojas con montos enteros y sin nombres ni motivos", async () => {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await armarExcelReportes(armar()));
    expect(libro.worksheets.map((h) => h.name)).toEqual(["Resumen", "Días del mes", "6 meses"]);

    const textos: string[] = [];
    libro.eachSheet((hoja) => hoja.eachRow((fila) => fila.eachCell((celda) => textos.push(String(celda.value)))));
    expect(textos.join(" ")).not.toContain("Inventado");

    const resumen = libro.getWorksheet("Resumen")!;
    expect(resumen.getRow(3).getCell(2).value).toBe(580000);
    const dias = libro.getWorksheet("Días del mes")!;
    expect(dias.rowCount).toBe(31);
    expect(dias.getRow(31).getCell(3).value).toBe(580000);
    expect(libro.getWorksheet("6 meses")!.getRow(7).getCell(2).value).toBe(580000);
  });

  it("nombre del archivo", () => {
    expect(nombreExcelReportes("2026-11-01")).toBe("reportes-2026-11.xlsx");
  });
});
