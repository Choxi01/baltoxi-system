// Skeleton mientras el servidor trae los datos de una sección.
// Lo usan el layout de (app) y los loading.tsx de cada sección: así, al tocar el
// menú, la sección nueva aparece al instante (Next 16, navegación instantánea).
export function Cargando() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden className="h-8 w-40 rounded-md bg-muted motion-safe:animate-pulse" />
      <div aria-hidden className="flex flex-col gap-3">
        <div className="h-16 rounded-lg bg-muted motion-safe:animate-pulse" />
        <div className="h-16 rounded-lg bg-muted motion-safe:animate-pulse" />
        <div className="h-16 rounded-lg bg-muted motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
