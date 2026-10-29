-- =====================================================================
-- 0002_documentos_storage.sql — Depósito privado de documentos
-- Fotos de cédula, análisis, informes y certificados.
-- Ruta de cada archivo: <consultorio_id>/<paciente_id o tutor_id>/<uuid>.<ext>
-- El bucket es PRIVADO: los archivos se abren con links firmados que
-- vencen (createSignedUrl, 5 minutos), nunca con URL pública.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

-- Solo se puede leer, subir o borrar dentro de la carpeta del consultorio propio.
create policy documentos_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos'
         and (storage.foldername(name))[1]::uuid in (select public.mis_consultorios()));

create policy documentos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos'
              and (storage.foldername(name))[1]::uuid in (select public.mis_consultorios()));

create policy documentos_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos'
         and (storage.foldername(name))[1]::uuid in (select public.mis_consultorios()));
