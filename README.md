# Agenda, expediente y cobros para consultorios

App web de uso interno para consultorios de terapia: agenda que maneja la profesional (con botones
para copiar horarios libres), expediente de cada paciente (datos, tutores, anamnesis, notas,
documentos), asistencia y cobros, mensajes de WhatsApp listos para copiar, datos para facturar y
reportes. Las familias solo tienen una ficha online para actualizar datos y firmar el reglamento.

## Primeros pasos
1. Crear cuentas: GitHub, Supabase (2 proyectos: `pruebas` y `produccion`), Netlify.
   Producción pasa a Supabase Pro (US$25/mes) antes de cargar datos reales.
2. Crear este repo privado en GitHub, subir estos archivos e invitar al socio.
3. En GitHub > Settings > Branches: proteger `main` (Pull Request con 1 aprobación).
4. Instalar Node.js (LTS) y Claude Code; clonar el repo.
5. Seguir `docs/tareas.md` desde la tarea 0.1.

## Documentos
- `CLAUDE.md` — reglas del proyecto (Claude Code lo lee solo)
- `docs/agenda.md`, `docs/expediente.md`, `docs/reglas-cobro.md`, `docs/mensajes.md` — especificaciones
- `docs/tareas.md` — tareas con el pedido para Claude Code
- `supabase/migrations/` — base de datos y depósito privado de documentos
- `.github/workflows/backup.yml` — copia semanal cifrada
