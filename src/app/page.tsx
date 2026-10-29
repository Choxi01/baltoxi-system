import { Button } from "@/components/ui/button";

export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Consultorio</h1>
      <p className="max-w-sm text-muted-foreground">
        Agenda, expediente y cobros. Estamos en construcción: pronto vas a poder ingresar.
      </p>
      <Button size="touch" disabled>
        Ingresar
      </Button>
    </main>
  );
}
