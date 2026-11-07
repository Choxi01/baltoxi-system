import { Cargando } from "@/components/app/cargando";

// Mismo ancho que la ficha: esta página no tiene el layout de la app.
export default function CargandoFicha() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Cargando />
    </main>
  );
}
