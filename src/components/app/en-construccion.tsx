// Página provisoria para las secciones que todavía no se programaron.
export function EnConstruccion({ titulo, tarea }: { titulo: string; tarea: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      <p className="text-muted-foreground">En construcción (tarea {tarea}).</p>
    </div>
  );
}
