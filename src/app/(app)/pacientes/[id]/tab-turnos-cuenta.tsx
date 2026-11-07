import Link from "next/link";

import { ListaMovimientos, ResumenCuenta } from "@/components/app/cuenta-movimientos";
import { Button } from "@/components/ui/button";
import { horaCorta } from "@/lib/agenda/bloques";
import { fechaCorta, type Cuenta } from "@/lib/cobro/cuenta";
import { textoDiaMensaje } from "@/lib/mensajes/plantillas";
import { textoAsistencia, type TurnoPaciente } from "@/lib/pacientes/turnos";

// Pestaña "Turnos y cuenta" (docs/expediente.md): solo lectura. Los pagos se cargan en Cobros.
export function TabTurnosCuenta({
  proximos,
  historial,
  responsable,
}: {
  proximos: TurnoPaciente[];
  historial: TurnoPaciente[];
  /** Cuenta del responsable de pago; null si el paciente no tiene. */
  responsable: { tutor: { id: string; nombre: string }; cuenta: Cuenta } | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="proximos-turnos" className="flex flex-col gap-2">
        <h2 id="proximos-turnos" className="text-lg font-semibold">
          Próximos turnos
        </h2>
        {proximos.length === 0 ? (
          <p className="text-muted-foreground">No tiene turnos agendados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {proximos.map((t) => (
              <li key={t.id} className="rounded-lg border p-3">
                <p className="font-medium first-letter:uppercase">
                  {textoDiaMensaje(t.fecha)} · {horaCorta(t.hora)}
                </p>
                {t.tipo && <p className="text-sm text-muted-foreground">{t.tipo}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="historial-asistencia" className="flex flex-col gap-2">
        <h2 id="historial-asistencia" className="text-lg font-semibold">
          Historial de asistencia
        </h2>
        {historial.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay turnos pasados.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {historial.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="tabular-nums">
                    {fechaCorta(t.fecha)} · {horaCorta(t.hora)}
                  </p>
                  {t.tipo && <p className="text-sm text-muted-foreground">{t.tipo}</p>}
                </div>
                <span className="shrink-0 text-sm font-medium">{textoAsistencia(t.estado)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="cuenta-responsable" className="flex flex-col gap-3">
        <h2 id="cuenta-responsable" className="text-lg font-semibold">
          Cuenta del responsable
        </h2>
        {responsable ? (
          <>
            <p className="text-sm text-muted-foreground">{responsable.tutor.nombre} · incluye a todos sus hijos</p>
            <ResumenCuenta cuenta={responsable.cuenta} />
            <Button asChild size="touch" variant="outline">
              <Link href={`/cobros/${responsable.tutor.id}`}>Ver cuenta completa</Link>
            </Button>
            <ListaMovimientos movimientos={responsable.cuenta.movimientos} />
          </>
        ) : (
          <p className="text-muted-foreground">Este paciente no tiene responsable de pago: elegilo en la pestaña Tutores.</p>
        )}
      </section>
    </div>
  );
}
