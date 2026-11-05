-- =====================================================================
-- 0010_documentos_limites.sql — Límites del bucket de documentos (tarea A7)
-- La app achica las fotos a JPEG y sube los PDF tal cual, hasta 15 MB
-- (src/lib/documentos/reglas.ts: MIMES_GUARDADOS y MAXIMO_BYTES).
-- El bucket mismo rechaza lo demás, por si alguien sube sin pasar por la app.
-- Si cambian esos valores en la app, cambiar acá con una migración nueva.
-- =====================================================================

update storage.buckets
set file_size_limit = 15728640,  -- 15 MB
    allowed_mime_types = array['image/jpeg', 'application/pdf']
where id = 'documentos';
