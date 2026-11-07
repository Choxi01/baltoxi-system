import type { NextRequest } from "next/server";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { listarParaFacturar } from "@/lib/cobro/datos-facturar";
import { mesValido, nombreExcel } from "@/lib/cobro/facturar";
import { armarExcelFacturar } from "@/lib/cobro/facturar-excel";
import { hoyEnAsuncion } from "@/lib/fechas";

// Descarga del Excel de "Para facturar". El layout no protege las rutas: se verifica la sesión acá.
export async function GET(request: NextRequest) {
  await exigirConsultorio();
  const mes = mesValido(request.nextUrl.searchParams.get("mes"), hoyEnAsuncion());
  if (!mes) return new Response("Mes inválido", { status: 400 });

  const { filas } = await listarParaFacturar(mes);
  return new Response(await armarExcelFacturar(filas), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreExcel(mes)}"`,
      "Cache-Control": "no-store",
    },
  });
}
