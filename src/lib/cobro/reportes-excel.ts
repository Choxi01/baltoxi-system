// Excel de Reportes (docs/reglas-cobro.md sección 8). Solo totales: sin nombres de pacientes ni de
// tutores y sin datos clínicos (regla de oro 7).

import ExcelJS from "exceljs";

import { tituloMes } from "@/lib/agenda/calendario";
import { paramMes, type Reporte } from "./reportes";

const FORMATO_GS = "#,##0";
const FORMATO_HORAS = "0.00";

const horas = (h: number) => Math.round(h * 100) / 100;
const fechaCorta = (fecha: string) => fecha.split("-").reverse().join("/");

export const nombreExcelReportes = (mes: string) => `reportes-${paramMes(mes)}.xlsx`;

/** Arma el .xlsx. Números y no fórmulas: la vista previa del iPhone no calcula fórmulas. */
export async function armarExcelReportes(r: Reporte): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook();

  const resumen = libro.addWorksheet("Resumen");
  resumen.columns = [
    { header: tituloMes(r.mes), key: "concepto", width: 34 },
    { header: "Valor", key: "valor", width: 16 },
  ];
  const filas: { concepto: string; valor: number; formato: string }[] = [
    { concepto: `Generado hoy, ${fechaCorta(r.hoy)} (Gs.)`, valor: r.generadoHoy, formato: FORMATO_GS },
    { concepto: "Generado del mes (Gs.)", valor: r.generadoMes, formato: FORMATO_GS },
    ...(r.proyeccion === null ? [] : [{ concepto: "Proyección del mes (Gs.)", valor: r.proyeccion, formato: FORMATO_GS }]),
    { concepto: "Cobrado del mes (Gs.)", valor: r.cobradoMes, formato: FORMATO_GS },
    { concepto: "Pendiente del mes (Gs.)", valor: r.pendienteMes, formato: FORMATO_GS },
    { concepto: "Horas trabajadas", valor: horas(r.horasMes), formato: FORMATO_HORAS },
  ];
  for (const { concepto, valor, formato } of filas) {
    resumen.addRow({ concepto, valor }).getCell("valor").numFmt = formato;
  }

  const dias = libro.addWorksheet("Días del mes");
  dias.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Generado (Gs.)", key: "monto", width: 16, style: { numFmt: FORMATO_GS } },
    { header: "Acumulado (Gs.)", key: "acumulado", width: 16, style: { numFmt: FORMATO_GS } },
  ];
  let acumulado = 0;
  for (const d of r.dias) {
    acumulado += d.monto;
    dias.addRow({ fecha: fechaCorta(d.fecha), monto: d.monto, acumulado });
  }

  const meses = libro.addWorksheet("6 meses");
  meses.columns = [
    { header: "Mes", key: "mes", width: 18 },
    { header: "Generado (Gs.)", key: "generado", width: 16, style: { numFmt: FORMATO_GS } },
    { header: "Cobrado (Gs.)", key: "cobrado", width: 16, style: { numFmt: FORMATO_GS } },
    { header: "Pendiente (Gs.)", key: "pendiente", width: 16, style: { numFmt: FORMATO_GS } },
    { header: "Horas", key: "horas", width: 10, style: { numFmt: FORMATO_HORAS } },
  ];
  for (const m of r.comparacion) {
    meses.addRow({ ...m, mes: tituloMes(m.mes), horas: horas(m.horas) });
  }

  for (const hoja of [resumen, dias, meses]) {
    hoja.getRow(1).font = { bold: true };
    hoja.views = [{ state: "frozen", ySplit: 1 }];
  }

  return (await libro.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
