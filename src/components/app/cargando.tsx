// "Cargando…" mientras el servidor trae los datos de una sección.
// Lo usan el layout de (app) y los loading.tsx de cada sección: así, al tocar el
// menú, la sección nueva aparece al instante (Next 16, navegación instantánea).
export function Cargando() {
  return (
    <p role="status" className="text-muted-foreground">
      Cargando…
    </p>
  );
}
