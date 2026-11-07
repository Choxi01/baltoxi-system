import type { NextRequest } from "next/server";

import { inicioDeMes, lunesDe } from "@/lib/agenda/calendario";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { obtenerReporte } from "@/lib/cobro/datos-reportes";
import { mesValido } from "@/lib/cobro/reportes";
import { armarExcelReportes, nombreExcelReportes } from "@/lib/cobro/reportes-excel";
import { hoyEnAsuncion } from "@/lib/fechas";

// Descarga del Excel de Reportes. El layout no protege las rutas: se verifica la sesión acá.
export async function GET(request: NextRequest) {
  await exigirConsultorio();
  const ahora = new Date();
  const hoy = hoyEnAsuncion(ahora);
  const pedido = request.nextUrl.searchParams.get("mes");
  const mes = pedido === null ? inicioDeMes(hoy) : mesValido(pedido, hoy);
  if (!mes) return new Response("Mes inválido", { status: 400 });

  const reporte = await obtenerReporte({ mes, semana: lunesDe(hoy), hoy, ahora });
  return new Response(await armarExcelReportes(reporte), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreExcelReportes(mes)}"`,
      "Cache-Control": "no-store",
    },
  });
}
