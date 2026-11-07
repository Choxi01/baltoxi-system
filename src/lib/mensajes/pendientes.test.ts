import { describe, expect, it } from "vitest";
import {
  AVISO_SIN_MARCAR,
  cantidadSinEnviar,
  pendientesDelDia,
  rangoDeTurnos,
  type CargoPendientes,
  type DatosPendientes,
  type EnviadoPendientes,
  type PagoPendientes,
  type TurnoPendientes,
} from "./pendientes";
import { semanaIso } from "./monto";
import { PLANTILLAS_POR_DEFECTO } from "./plantillas";

// Datos inventados (regla de oro 8).
// Laura es responsable de Tomi y Sofi (plan mensual). Marta, de Juli (plan semanal), sin WhatsApp.
const LUNES_A_VIERNES = [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d }));

let n = 0;
const turno = (paciente_id: string, fecha: string, hora: string, estado = "agendado", clase = "turno"): TurnoPendientes => ({
  id: `turno-${++n}`,
  clase,
  estado,
  paciente_id,
  fecha,
  hora,
});
const cargo = (tutor_id: string, paciente_id: string | null, fecha: string, monto_gs = 290000, cobra_en_el_momento = false): CargoPendientes => ({
  id: `cargo-${++n}`,
  tutor_id,
  paciente_id,
  fecha,
  monto_gs,
  cobra_en_el_momento,
  estado: "presente",
  tipo: "Sesión",
});
const pago = (tutor_id: string, fecha: string, monto_gs: number): PagoPendientes => ({ id: `pago-${++n}`, tutor_id, fecha, monto_gs });

function datos(extra: Partial<DatosPendientes> = {}): DatosPendientes {
  return {
    plantillas: { ...PLANTILLAS_POR_DEFECTO },
    datosPago: "Alias 0000000",
    diaLimitePago: 10,
    horasAvisoMinimas: 24,
    tramos: LUNES_A_VIERNES,
    bloqueos: [],
    tutores: [
      { id: "t1", nombre: "Laura", apellido: "Prueba", telefono_wa: "595981000001" },
      { id: "t2", nombre: "Marta Elena", apellido: "Ejemplo", telefono_wa: null },
    ],
    pacientes: [
      { id: "p1", nombre: "Tomi", responsable_pago_id: "t1", plan_cobro: "mensual" },
      { id: "p2", nombre: "Sofi", responsable_pago_id: "t1", plan_cobro: "mensual" },
      { id: "p3", nombre: "Juli", responsable_pago_id: "t2", plan_cobro: "semanal" },
    ],
    turnos: [],
    cargos: [],
    pagos: [],
    enviados: [],
    ...extra,
  };
}

describe("recordatorios del próximo día de atención", () => {
  it("el viernes sugiere los del lunes, con hermanos en un solo mensaje", () => {
    const r = pendientesDelDia(
      "2026-10-30",
      datos({ turnos: [turno("p1", "2026-11-02", "15:45"), turno("p2", "2026-11-02", "15:00")] }),
    );
    expect(r.proximoDia).toBe("2026-11-02");
    expect(r.recordatorios).toHaveLength(1);
    expect(r.recordatorios[0]).toMatchObject({
      clave: "recordatorio_sesion",
      referencia: "2026-11-02",
      tutorId: "t1",
      tutor: "Laura Prueba",
      pacientes: "Sofi y Tomi",
      telefono: "595981000001",
      enviado: false,
      texto: "Hola Laura, te recuerdo la sesión de Sofi y Tomi el lunes 2/11 a las 15:00 y 15:45. ¡Nos vemos!",
    });
  });

  it("de lunes a jueves dice «mañana»", () => {
    const r = pendientesDelDia("2026-11-02", datos({ turnos: [turno("p1", "2026-11-03", "09:00")] }));
    expect(r.recordatorios[0].texto).toBe("Hola Laura, te recuerdo la sesión de Tomi mañana a las 9:00. ¡Nos vemos!");
  });

  it("la víspera de un feriado saltea el feriado", () => {
    const r = pendientesDelDia(
      "2026-12-07",
      datos({
        bloqueos: [{ desde: "2026-12-08", hasta: "2026-12-08", motivo: "Feriado" }],
        turnos: [turno("p1", "2026-12-08", "09:00"), turno("p2", "2026-12-09", "09:45")],
      }),
    );
    expect(r.proximoDia).toBe("2026-12-09");
    expect(r.recordatorios).toHaveLength(1);
    expect(r.recordatorios[0].pacientes).toBe("Sofi");
    expect(r.recordatorios[0].texto).toContain("el miércoles 9/12 a las 9:45");
  });

  it("una plantilla vieja con «mañana {dia}» un viernes no dice «mañana»", () => {
    const viejo = "Hola {tutor}, te recuerdo la sesión de {paciente} mañana {dia} a las {hora}. ¡Nos vemos!";
    const base = datos();
    const r = pendientesDelDia(
      "2026-10-30",
      { ...base, plantillas: { ...base.plantillas, recordatorio_sesion: viejo }, turnos: [turno("p1", "2026-11-02", "15:00")] },
    );
    expect(r.recordatorios[0].texto).toBe("Hola Laura, te recuerdo la sesión de Tomi el lunes 2/11 a las 15:00. ¡Nos vemos!");
    expect(r.recordatorios[0].texto).not.toContain("mañana");
  });

  it("solo turnos agendados con paciente (no cancelados ni reservados)", () => {
    const r = pendientesDelDia(
      "2026-11-02",
      datos({
        turnos: [
          turno("p1", "2026-11-03", "09:00", "ausente_con_aviso"),
          turno("p2", "2026-11-03", "09:00", "agendado", "reservado"),
          turno("p3", "2026-11-04", "09:00"),
        ],
      }),
    );
    expect(r.recordatorios).toEqual([]);
  });

  it("uno por tutor, ordenados por hora; tutor sin WhatsApp queda con teléfono null", () => {
    const r = pendientesDelDia(
      "2026-11-02",
      datos({ turnos: [turno("p1", "2026-11-03", "15:00"), turno("p3", "2026-11-03", "09:00")] }),
    );
    expect(r.recordatorios.map((f) => [f.tutor, f.telefono])).toEqual([
      ["Marta Elena Ejemplo", null],
      ["Laura Prueba", "595981000001"],
    ]);
    expect(r.recordatorios[0].texto).toContain("Hola Marta,");
  });

  it("si ya se mandó, sale tachado", () => {
    const enviados: EnviadoPendientes[] = [{ clave: "recordatorio_sesion", referencia: "2026-11-03", tutor_id: "t1", fecha: "2026-11-02" }];
    const r = pendientesDelDia("2026-11-02", datos({ turnos: [turno("p1", "2026-11-03", "09:00")], enviados }));
    expect(r.recordatorios[0].enviado).toBe(true);
    expect(cantidadSinEnviar(r)).toBe(0);
  });
});

describe("monto del período", () => {
  // Noviembre: Tomi el 6 y el 20, Sofi el 27 (viernes). Ya pagó Gs. 290.000.
  const noviembre = () =>
    datos({
      turnos: [
        turno("p1", "2026-11-06", "15:00", "presente"),
        turno("p1", "2026-11-20", "15:00", "presente"),
        turno("p2", "2026-11-27", "15:45", "presente"),
      ],
      cargos: [cargo("t1", "p1", "2026-11-06"), cargo("t1", "p1", "2026-11-20"), cargo("t1", "p2", "2026-11-27")],
      pagos: [pago("t1", "2026-11-10", 290000)],
    });

  it("el día del último turno del mes de cualquiera de los hermanos: un solo total (caso 22)", () => {
    const r = pendientesDelDia("2026-11-27", noviembre());
    expect(r.montos).toHaveLength(1);
    expect(r.montos[0]).toMatchObject({
      clave: "monto_periodo",
      referencia: "2026-11",
      pacientes: "Tomi y Sofi",
      texto: "Hola Laura, ¿cómo estás? Te paso el monto de las sesiones de noviembre: Gs. 580.000. Alias 0000000. ¡Gracias!",
    });
    expect(r.montos[0].aviso).toBeUndefined();
  });

  it("el día anterior no se sugiere", () => {
    expect(pendientesDelDia("2026-11-26", noviembre()).montos).toEqual([]);
  });

  it("un turno cancelado con aviso después no cambia cuál es el último", () => {
    const d = noviembre();
    d.turnos.push(turno("p1", "2026-11-30", "15:00", "ausente_con_aviso"));
    expect(pendientesDelDia("2026-11-27", d).montos).toHaveLength(1);
  });

  it("si queda un turno agendado después, hoy no es el último", () => {
    const d = noviembre();
    d.turnos.push(turno("p1", "2026-11-30", "15:00"));
    expect(pendientesDelDia("2026-11-27", d).montos).toEqual([]);
  });

  it("si hoy hay turnos sin marcar, avisa (falta su cargo)", () => {
    const d = noviembre();
    d.turnos[2] = { ...d.turnos[2], estado: "agendado" };
    d.cargos.pop();
    const r = pendientesDelDia("2026-11-27", d);
    expect(r.montos[0].aviso).toBe(AVISO_SIN_MARCAR);
    expect(r.montos[0].texto).toContain("Gs. 290.000");
  });

  it("total 0 o a favor: no se sugiere", () => {
    const d = noviembre();
    d.pagos = [pago("t1", "2026-11-10", 870000)];
    expect(pendientesDelDia("2026-11-27", d).montos).toEqual([]);
    d.pagos = [pago("t1", "2026-11-10", 1000000)];
    expect(pendientesDelDia("2026-11-27", d).montos).toEqual([]);
  });

  it("los pagos cubren primero lo más viejo (FIFO): una deuda de octubre no baja el total de noviembre", () => {
    const d = noviembre();
    d.cargos.unshift(cargo("t1", "p1", "2026-10-15"));
    // El pago de 290.000 cubre octubre: noviembre queda entero.
    expect(pendientesDelDia("2026-11-27", d).montos[0].texto).toContain("Gs. 870.000");
  });

  it("sin datos de pago no deja puntos sueltos", () => {
    const d = { ...noviembre(), datosPago: null };
    expect(pendientesDelDia("2026-11-27", d).montos[0].texto).toBe(
      "Hola Laura, ¿cómo estás? Te paso el monto de las sesiones de noviembre: Gs. 580.000. ¡Gracias!",
    );
  });

  it("plan semanal: el último turno de la semana (caso 20)", () => {
    const d = datos({
      turnos: [turno("p3", "2026-11-02", "09:00", "presente"), turno("p3", "2026-11-05", "09:00", "presente")],
      cargos: [cargo("t2", "p3", "2026-11-02"), cargo("t2", "p3", "2026-11-05")],
      pagos: [pago("t2", "2026-11-02", 290000)],
    });
    expect(pendientesDelDia("2026-11-04", d).montos).toEqual([]);
    const r = pendientesDelDia("2026-11-05", d);
    expect(r.montos).toHaveLength(1);
    expect(r.montos[0]).toMatchObject({
      referencia: "2026-W45",
      telefono: null,
      texto: "Hola Marta, ¿cómo estás? Te paso el monto de las sesiones de la semana del 2 al 6/11: Gs. 290.000. Alias 0000000. ¡Gracias!",
    });
  });

  it("semana que cruza de mes", () => {
    const d = datos({
      turnos: [turno("p3", "2026-12-04", "09:00", "presente")],
      cargos: [cargo("t2", "p3", "2026-12-04")],
    });
    expect(pendientesDelDia("2026-12-04", d).montos[0].texto).toContain("la semana del 30/11 al 4/12");
  });
});

describe("detalle del monto en la bandeja", () => {
  const conPago = () =>
    datos({
      turnos: [turno("p1", "2026-11-06", "15:00", "presente"), turno("p2", "2026-11-27", "15:45", "presente")],
      cargos: [cargo("t1", "p1", "2026-11-06"), cargo("t1", "p2", "2026-11-27")],
      pagos: [pago("t1", "2026-11-10", 290000)],
    });

  it("por defecto solo el total; con el interruptor suma las líneas de los dos hermanos", () => {
    const [fila] = pendientesDelDia("2026-11-27", conPago()).montos;
    expect(fila.texto).not.toContain("•");
    expect(fila.textoConDetalle).toBe(
      `${fila.texto}\n\n• 06/11 Tomi – Sesión – Gs. 290.000\n• 27/11 Sofi – Sesión – Gs. 290.000\n• Ya pagado – -Gs. 290.000`,
    );
  });

  it("los otros mensajes no tienen detalle", () => {
    const d = conPago();
    d.turnos.push(turno("p1", "2026-11-30", "09:00"));
    const r = pendientesDelDia("2026-11-27", d);
    expect(r.recordatorios[0].textoConDetalle).toBeUndefined();
  });

  it("plan mixto: la fila mensual no lista al hermano de plan semanal", () => {
    const d = conPago();
    d.pacientes[1] = { ...d.pacientes[1], plan_cobro: "semanal" };
    d.turnos = [turno("p1", "2026-11-27", "15:00", "presente")];
    d.cargos = [cargo("t1", "p1", "2026-11-27"), cargo("t1", "p2", "2026-11-27")];
    d.pagos = [];
    const [fila] = pendientesDelDia("2026-11-27", d).montos;
    expect(fila.textoConDetalle).toContain("Tomi");
    expect(fila.textoConDetalle).not.toContain("Sofi");
  });
});

describe("pagos atrasados", () => {
  const conDeuda = (enviados: EnviadoPendientes[] = []) =>
    datos({ cargos: [cargo("t1", "p1", "2026-10-15"), cargo("t1", "p1", "2026-11-05")], enviados });

  it("plan mensual: octubre impago, hoy 11/11 → recordatorio (caso 16)", () => {
    const r = pendientesDelDia("2026-11-11", conDeuda());
    expect(r.pagos).toHaveLength(1);
    expect(r.pagos[0]).toMatchObject({
      clave: "recordatorio_pago",
      referencia: "2026-11-11",
      pacientes: "Tomi",
      texto: "Hola Laura, ¿cómo estás? Te recuerdo que quedó pendiente el pago de octubre 2026: Gs. 290.000. Alias 0000000. ¡Gracias!",
    });
  });

  it("hoy 10/11 todavía no está atrasado (caso 17)", () => {
    expect(pendientesDelDia("2026-11-10", conDeuda()).pagos).toEqual([]);
  });

  it("cobra en el momento: atrasado al día siguiente (caso 18)", () => {
    const d = datos({ cargos: [cargo("t1", "p1", "2026-11-05", 280000, true)] });
    expect(pendientesDelDia("2026-11-05", d).pagos).toEqual([]);
    expect(pendientesDelDia("2026-11-06", d).pagos[0].texto).toContain("Gs. 280.000");
  });

  it("si ya pagó, no hay recordatorio", () => {
    const d = conDeuda();
    d.pagos = [pago("t1", "2026-11-01", 290000)];
    expect(pendientesDelDia("2026-11-11", d).pagos).toEqual([]);
  });

  it("máximo una vez por semana: enviado hace 3 días no se sugiere", () => {
    const r = pendientesDelDia("2026-11-11", conDeuda([{ clave: "recordatorio_pago", referencia: "2026-11-08", tutor_id: "t1", fecha: "2026-11-08" }]));
    expect(r.pagos).toEqual([]);
  });

  it("enviado hace 6 días tampoco; hace 7 sí", () => {
    const hace = (fecha: string) => [{ clave: "recordatorio_pago", referencia: fecha, tutor_id: "t1", fecha }];
    expect(pendientesDelDia("2026-11-11", conDeuda(hace("2026-11-05"))).pagos).toEqual([]);
    const r = pendientesDelDia("2026-11-11", conDeuda(hace("2026-11-04")));
    expect(r.pagos).toHaveLength(1);
    expect(r.pagos[0].enviado).toBe(false);
  });

  it("enviado hoy: sale tachado", () => {
    const r = pendientesDelDia("2026-11-11", conDeuda([{ clave: "recordatorio_pago", referencia: "2026-11-11", tutor_id: "t1", fecha: "2026-11-11" }]));
    expect(r.pagos[0].enviado).toBe(true);
  });

  it("el envío de otro tutor no cuenta", () => {
    const r = pendientesDelDia("2026-11-11", conDeuda([{ clave: "recordatorio_pago", referencia: "2026-11-08", tutor_id: "t2", fecha: "2026-11-08" }]));
    expect(r.pagos).toHaveLength(1);
  });

  it("varios meses vencidos", () => {
    const d = datos({ cargos: [cargo("t1", "p1", "2026-09-15"), cargo("t1", "p2", "2026-10-15")] });
    expect(pendientesDelDia("2026-11-11", d).pagos[0]).toMatchObject({
      pacientes: "Tomi y Sofi",
      texto: expect.stringContaining("septiembre y octubre 2026: Gs. 580.000"),
    });
  });
});

describe("datos clínicos", () => {
  it("ningún mensaje los incluye aunque vengan en los datos", () => {
    const d = datos({
      turnos: [turno("p1", "2026-11-12", "09:00"), turno("p1", "2026-11-11", "09:00", "presente")],
      cargos: [cargo("t1", "p1", "2026-10-15"), cargo("t1", "p1", "2026-11-11")],
    });
    // Como si la lectura trajera de más: no tiene que aparecer en ningún texto.
    d.pacientes = d.pacientes.map((p) => ({ ...p, motivo_consulta: "DATO CLINICO" }) as typeof p);
    const r = pendientesDelDia("2026-11-11", d);
    const textos = [...r.recordatorios, ...r.montos, ...r.pagos].map((f) => f.texto);
    expect(textos.length).toBeGreaterThan(0);
    for (const t of textos) expect(t).not.toContain("DATO CLINICO");
  });
});

describe("semanaIso y rangoDeTurnos", () => {
  it("semana ISO", () => {
    expect(semanaIso("2026-01-01")).toBe("2026-W01");
    expect(semanaIso("2026-11-05")).toBe("2026-W45");
    expect(semanaIso("2026-11-08")).toBe("2026-W45");
    expect(semanaIso("2026-12-31")).toBe("2026-W53");
    expect(semanaIso("2027-01-01")).toBe("2026-W53");
    expect(semanaIso("2027-01-04")).toBe("2027-W01");
  });

  it("rango: mes, semana y próximo día", () => {
    expect(rangoDeTurnos("2026-10-30", "2026-11-02")).toEqual({ desde: "2026-10-01", hasta: "2026-11-02" });
    expect(rangoDeTurnos("2026-12-01", "2026-12-02")).toEqual({ desde: "2026-11-30", hasta: "2026-12-31" });
  });
});
