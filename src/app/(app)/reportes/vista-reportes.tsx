import { ChevronLeft, ChevronRight, Download } from "lucide-react";

import { Pestanas } from "@/components/app/pestanas";
import { Button } from "@/components/ui/button";
import { inicioDeMes, tituloMes } from "@/lib/agenda/calendario";
import { formatoGs } from "@/lib/cobro/formato";
import { paramMes, textoHoras, type Reporte } from "@/lib/cobro/reportes";
import { EnlacePeriodo } from "./enlace-periodo";
import { GraficoBarras, GraficoLineas } from "./graficos";
import { VistaSemana } from "./vista-semana";

const textoTurnos = (n: number) => (n === 1 ? "1 turno" : `${n} turnos`);

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

export function VistaReportes({ reporte: r, pestana }: { reporte: Reporte; pestana: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <EnlacePeriodo parametro="mes" valor={paramMes(inicioDeMes(r.mes, -1))} etiqueta="Mes anterior">
          <ChevronLeft className="size-5" />
        </EnlacePeriodo>
        <p className="min-w-0 flex-1 text-center font-medium">{tituloMes(r.mes)}</p>
        {r.esMesActual ? (
          <span className="size-11 shrink-0" />
        ) : (
          <EnlacePeriodo parametro="mes" valor={paramMes(inicioDeMes(r.mes, 1))} etiqueta="Mes siguiente">
            <ChevronRight className="size-5" />
          </EnlacePeriodo>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tarjeta titulo="Generado hoy" valor={formatoGs(r.generadoHoy)} />
        <Tarjeta titulo="Generado del mes" valor={formatoGs(r.generadoMes)} />
        {r.proyeccion !== null && <Tarjeta titulo="Proyección del mes" valor={formatoGs(r.proyeccion)} />}
        <Tarjeta titulo="Cobrado del mes" valor={formatoGs(r.cobradoMes)} />
        <Tarjeta titulo="Pendiente del mes" valor={formatoGs(r.pendienteMes)} />
        <Tarjeta titulo="Horas trabajadas" valor={textoHoras(r.horasMes)} />
      </dl>

      {(r.sinMarcar > 0 || (r.proyeccion !== null && r.sinTarifa > 0)) && (
        <div role="status" className="flex flex-col gap-1 text-sm text-muted-foreground">
          {r.sinMarcar > 0 && <p>{textoTurnos(r.sinMarcar)} de días pasados sin marcar: no suman al generado ni a la proyección.</p>}
          {r.proyeccion !== null && r.sinTarifa > 0 && <p>{textoTurnos(r.sinTarifa)} sin tarifa: no suman a la proyección.</p>}
        </div>
      )}

      <Button asChild variant="outline" size="touch">
        <a href={`/reportes/excel?mes=${paramMes(r.mes)}`} download>
          <Download /> Descargar Excel
        </a>
      </Button>

      <Pestanas
        etiqueta="Vistas del reporte"
        inicial={pestana}
        pestanas={[
          { id: "semana", titulo: "Semana", contenido: <VistaSemana key={r.semana.lunes} semana={r.semana} hoy={r.hoy} /> },
          {
            id: "mes",
            titulo: "Mes",
            contenido: (
              <div className="flex flex-col gap-2 pt-4">
                <GraficoLineas key={r.mes} serie={r.serie} dias={r.dias} hoy={r.hoy} />
                {r.proyeccion !== null && r.tasa > 0 && (
                  <p className="text-sm text-muted-foreground">
                    La proyección descuenta {Math.round(r.tasa * 100)}% de ausencias sin cobro de los últimos meses.
                  </p>
                )}
              </div>
            ),
          },
          { id: "meses", titulo: "6 meses", contenido: <GraficoBarras meses={r.comparacion} mesElegido={r.mes} /> },
        ]}
      />
    </div>
  );
}
