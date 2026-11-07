// Excel de "Para facturar" (docs/reglas-cobro.md sección 7). Solo datos administrativos (regla de oro 7).

import ExcelJS from "exceljs";

import { textoMedios, type FilaFacturar } from "./facturar";

const FORMATO_GS = "#,##0";

/** Arma el .xlsx. Monto e IVA van como números enteros; el documento, como texto (no es una cantidad). */
export async function armarExcelFacturar(filas: FilaFacturar[]): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Para facturar");
  hoja.columns = [
    { header: "Tutor", key: "tutor", width: 28 },
    { header: "Documento", key: "documento", width: 16 },
    { header: "Razón social", key: "razon_social", width: 30 },
    { header: "Email", key: "email", width: 30 },
    { header: "Monto (Gs.)", key: "monto", width: 14, style: { numFmt: FORMATO_GS } },
    { header: "IVA 10% (Gs.)", key: "iva", width: 14, style: { numFmt: FORMATO_GS } },
    { header: "Medios de pago", key: "medios", width: 24 },
    { header: "Concepto", key: "concepto", width: 60 },
  ];
  hoja.getRow(1).font = { bold: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  for (const f of filas) {
    hoja.addRow({
      tutor: f.tutor,
      documento: f.documento ?? "",
      razon_social: f.razon_social,
      email: f.email ?? "",
      monto: f.monto,
      iva: f.iva,
      medios: textoMedios(f.medios),
      concepto: f.concepto,
    });
  }

  if (filas.length > 0) {
    // Números y no fórmulas: la vista previa del iPhone no calcula fórmulas.
    const total = hoja.addRow({
      tutor: "Total",
      monto: filas.reduce((s, f) => s + f.monto, 0),
      iva: filas.reduce((s, f) => s + f.iva, 0),
    });
    total.font = { bold: true };
  }

  return (await libro.xlsx.writeBuffer()) as unknown as ArrayBuffer;
}
