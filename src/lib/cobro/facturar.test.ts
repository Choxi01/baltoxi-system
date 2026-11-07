import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { armarParaFacturar, mesSinTerminar, mesValido, nombreExcel, textoDeshacer, textoMedios, validarNumeroFactura, type FilaFacturar, type TutorFactura } from "./facturar";
import { armarExcelFacturar } from "./facturar-excel";
import type { Cargo, Pago } from "./tipos";

// Datos inventados (regla de oro 8).
const CONCEPTO = "Servicios de fonoaudiología";

const tutor = (id: string, nombre: string, extra: Partial<TutorFactura> = {}): TutorFactura => ({
  id,
  nombre,
  apellido: "Prueba",
  email: null,
  doc_tipo: "CI",
  doc_numero: "1111111",
  dv: null,
  razon_social: null,
  ...extra,
});
const cargo = (id: string, tutor_id: string, fecha: string, monto_gs: number): Cargo => ({ id, tutor_id, fecha, monto_gs });
const pago = (id: string, tutor_id: string, fecha: string, monto_gs: number, extra: Partial<Pago> = {}): Pago => ({
  id,
  tutor_id,
  fecha,
  monto_gs,
  medio: "efectivo",
  factura_id: null,
  ...extra,
});

const armar = (pagos: Pago[], cargos: Cargo[], tutores: TutorFactura[] = [tutor("a", "Ana"), tutor("b", "Beto")]) =>
  armarParaFacturar({ mes: "2026-11-01", pagos, cargos, tutores, conceptoFactura: CONCEPTO });

describe("armarParaFacturar", () => {
  it("una fila por tutor, ordenadas por nombre", () => {
    const filas = armar([pago("p1", "b", "2026-11-02", 100), pago("p2", "a", "2026-11-03", 200), pago("p3", "b", "2026-11-04", 50)], []);
    expect(filas.map((f) => [f.tutor, f.monto])).toEqual([
      ["Ana Prueba", 200],
      ["Beto Prueba", 150],
    ]);
  });

  it("los pagos de una familia no cubren cargos de otra", () => {
    const filas = armar(
      [pago("pb", "b", "2026-11-02", 290000)],
      [cargo("ca", "a", "2026-08-10", 290000), cargo("cb", "b", "2026-10-10", 290000)],
    );
    expect(filas[0].concepto).toBe(`${CONCEPTO} – sesiones de octubre 2026`);
  });

  it("deja afuera lo ya facturado y otros meses, pero los usa para FIFO", () => {
    const filas = armar(
      [
        pago("viejo", "a", "2026-10-05", 290000, { factura_id: "f1" }),
        pago("facturado", "a", "2026-11-01", 100, { factura_id: "f2" }),
        pago("nuevo", "a", "2026-11-10", 290000),
      ],
      [cargo("sep", "a", "2026-09-10", 290000), cargo("oct", "a", "2026-10-10", 290100)],
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ monto: 290000, pago_ids: ["nuevo"], concepto: `${CONCEPTO} – sesiones de octubre 2026` });
  });

  it("pago adelantado sin cargos: el concepto va sin meses", () => {
    expect(armar([pago("p", "a", "2026-11-02", 290000)], [])[0].concepto).toBe(CONCEPTO);
  });

  it("un ajuste negativo cubre primero y el pago no nombra ese mes", () => {
    const filas = armar(
      [pago("p", "a", "2026-11-02", 290000)],
      [cargo("ajuste", "a", "2026-08-01", -290000), cargo("sep", "a", "2026-09-10", 290000), cargo("oct", "a", "2026-10-10", 290000)],
    );
    expect(filas[0]).toMatchObject({ monto: 290000, concepto: `${CONCEPTO} – sesiones de octubre 2026` });
  });

  it("meses de dos años", () => {
    const filas = armar([pago("p", "a", "2026-11-02", 580000)], [cargo("dic", "a", "2025-12-10", 290000), cargo("ene", "a", "2026-01-10", 290000)]);
    expect(filas[0].concepto).toBe(`${CONCEPTO} – sesiones de diciembre 2025 y enero 2026`);
  });

  it("razón social y nombre del tutor van separados", () => {
    const filas = armar([pago("p", "a", "2026-11-02", 100)], [], [tutor("a", "Ana", { razon_social: "Empresa Inventada SA" })]);
    expect(filas[0]).toMatchObject({ tutor: "Ana Prueba", razon_social: "Empresa Inventada SA" });
  });
});

describe("textoMedios", () => {
  it("nombres para mostrar", () => {
    expect(textoMedios(["efectivo", "transferencia"])).toBe("Efectivo, Transferencia");
  });
});

describe("mesValido", () => {
  const hoy = "2026-11-06";
  it("devuelve el primer día", () => {
    expect(mesValido("2026-10", hoy)).toBe("2026-10-01");
    expect(mesValido("2026-11", hoy)).toBe("2026-11-01");
  });
  it("rechaza meses futuros y basura", () => {
    for (const v of ["2026-12", "2026-13", "2026-00", "2026-1", "hola", "", undefined, ["2026-10"]]) expect(mesValido(v, hoy)).toBeNull();
  });
});

describe("mesSinTerminar", () => {
  it("el último día del mes ya no avisa", () => {
    expect(mesSinTerminar("2026-11-01", "2026-11-29")).toBe(true);
    expect(mesSinTerminar("2026-11-01", "2026-11-30")).toBe(false);
    expect(mesSinTerminar("2026-10-01", "2026-11-06")).toBe(false);
  });
});

describe("validarNumeroFactura", () => {
  it("acepta con o sin guiones y siempre guarda con guiones", () => {
    expect(validarNumeroFactura(" 001-001-0000123 ")).toEqual({ ok: true, numero: "001-001-0000123" });
    expect(validarNumeroFactura("0010010000123")).toEqual({ ok: true, numero: "001-001-0000123" });
  });
  it("rechaza números incompletos", () => {
    for (const n of ["", "123", "001-001-123", "001-001-00001234", "abc-def-ghijklm"]) expect(validarNumeroFactura(n).ok).toBe(false);
  });
});

describe("textoDeshacer", () => {
  it("dice que no anula la factura en Marangatu", () => {
    expect(textoDeshacer("001-001-0000123")).toContain("Esto no anula la factura en Marangatu: solo la saca de la app");
  });
});

describe("Excel", () => {
  const fila = (extra: Partial<FilaFacturar> = {}): FilaFacturar => ({
    tutor_id: "a",
    tutor: "Ana Prueba",
    doc_tipo: "RUC",
    documento: "1234567-8",
    razon_social: "Ana Prueba",
    email: "ana@ejemplo.com",
    monto: 1450000,
    iva: 131818,
    medios: ["transferencia", "efectivo"],
    concepto: `${CONCEPTO} – sesiones de septiembre y octubre 2026`,
    pago_ids: ["p"],
    ...extra,
  });

  async function leer(filas: FilaFacturar[]) {
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await armarExcelFacturar(filas));
    return libro.getWorksheet("Para facturar")!;
  }

  it("columnas, montos enteros y fila de total", async () => {
    const hoja = await leer([fila(), fila({ tutor: "Beto Prueba", monto: 290000, iva: 26364, documento: null, email: null })]);
    expect((hoja.getRow(1).values as unknown[]).slice(1)).toEqual([
      "Tutor", "Documento", "Razón social", "Email", "Monto (Gs.)", "IVA 10% (Gs.)", "Medios de pago", "Concepto",
    ]);
    expect((hoja.getRow(2).values as unknown[]).slice(1)).toEqual([
      "Ana Prueba", "1234567-8", "Ana Prueba", "ana@ejemplo.com", 1450000, 131818, "Transferencia, Efectivo",
      `${CONCEPTO} – sesiones de septiembre y octubre 2026`,
    ]);
    expect(hoja.getRow(4).getCell("A").value).toBe("Total");
    expect(hoja.getRow(4).getCell("E").value).toBe(1740000);
    expect(hoja.getRow(4).getCell("F").value).toBe(158182);
  });

  it("un texto que empieza con = no se vuelve fórmula", async () => {
    const hoja = await leer([fila({ razon_social: "=1+1" })]);
    expect(hoja.getRow(2).getCell("C").value).toBe("=1+1");
  });

  it("sin filas no hay total", async () => {
    expect((await leer([])).rowCount).toBe(1);
  });

  it("el nombre del archivo lleva solo el mes", () => {
    expect(nombreExcel("2026-11-01")).toBe("para-facturar-2026-11.xlsx");
  });
});
