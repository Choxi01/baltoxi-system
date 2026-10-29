# Agenda y cobros para consultorios

App web para consultorios de terapia: agenda con turnos fijos, asistencia, cobro según el estado
de cada turno, cuenta corriente por familia, cierre de mes con resumen por WhatsApp y datos para facturar.

## Primeros pasos
1. Crear cuentas gratis: GitHub, Supabase (2 proyectos: `pruebas` y `produccion`), Netlify.
2. Crear este repo privado en GitHub, subir estos archivos e invitar al socio.
3. En GitHub > Settings > Branches: proteger `main` (requiere Pull Request con 1 aprobación).
4. Instalar Node.js (versión LTS) y Claude Code; clonar el repo.
5. Seguir `docs/tareas.md` desde la tarea 0.1.

## Documentos
- `CLAUDE.md` — reglas del proyecto (Claude Code lo lee solo)
- `docs/tareas.md` — tareas con el pedido para Claude Code
- `docs/reglas-cobro.md` — especificación del motor de cobro y casos de prueba
- `supabase/migrations/0001_inicial.sql` — base de datos con seguridad por consultorio
- `.github/workflows/backup.yml` — backup semanal cifrado
