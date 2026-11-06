import type { EstadoFicha } from "@/lib/ficha/acciones";
import type { FichaFamilia } from "@/lib/ficha/servidor";
import { FormularioHijo, FormularioOtroTutor, FormularioTutorFicha } from "./formularios";

// Lo que ve la familia. SOLO datos administrativos (regla de oro 10): los datos llegan ya
// filtrados de cargarFicha (src/lib/ficha/servidor.ts).

type Accion = (anterior: EstadoFicha, formulario: FormData) => Promise<EstadoFicha>;

export function VistaFicha({
  ficha,
  hoy,
  guardarTutor,
  guardarHijo,
  agregarOtro,
}: {
  ficha: FichaFamilia;
  hoy: string;
  guardarTutor: Accion;
  guardarHijo: (pacienteId: string) => Accion;
  agregarOtro: Accion;
}) {
  const { tutor, consultorio, hijos, otros } = ficha;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{[consultorio.nombre, consultorio.profesional].filter(Boolean).join(" · ")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {tutor.nombre}</h1>
        <p className="text-muted-foreground">
          Revisá y completá tus datos y los de {hijos.length === 1 ? "tu hijo o hija" : "tus hijos"}. Cada parte se guarda con su botón.
        </p>
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="titulo-tutor">
        <h2 id="titulo-tutor" className="text-lg font-semibold">
          Tus datos
        </h2>
        <FormularioTutorFicha accion={guardarTutor} valores={tutor} />
      </section>

      {hijos.map((h) => (
        <section key={h.id} className="flex flex-col gap-4" aria-labelledby={`titulo-${h.id}`}>
          <h2 id={`titulo-${h.id}`} className="text-lg font-semibold">
            {h.nombre} <span className="text-sm font-normal text-muted-foreground">({h.parentesco})</span>
          </h2>
          <FormularioHijo accion={guardarHijo(h.id)} valores={h} hoy={hoy} />
        </section>
      ))}

      <section className="flex flex-col gap-4" aria-labelledby="titulo-otros">
        <h2 id="titulo-otros" className="text-lg font-semibold">
          Otros tutores
        </h2>
        {otros.length === 0 ? (
          <p className="text-muted-foreground">Por ahora sos el único tutor cargado.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {otros.map((o, i) => (
              <li key={i} className="text-sm">
                {o.nombre} <span className="text-muted-foreground">· {o.parentesco} de {o.hijo}</span>
              </li>
            ))}
          </ul>
        )}
        <FormularioOtroTutor accion={agregarOtro} />
      </section>

      <p className="text-center text-xs text-muted-foreground">Este link es personal: no lo compartas.</p>
    </main>
  );
}

/** Link inválido, tutor dado de baja o demasiados intentos: sin decir cuál (no ayuda a adivinar). */
export function FichaNoDisponible({ demasiados }: { demasiados: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{demasiados ? "Demasiados intentos" : "Este link no es válido"}</h1>
      <p className="text-muted-foreground">
        {demasiados ? "Probá de nuevo en una hora." : "Revisá que esté completo o pedile uno nuevo al consultorio."}
      </p>
    </main>
  );
}
