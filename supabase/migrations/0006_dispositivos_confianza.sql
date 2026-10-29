-- =====================================================================
-- 0006_dispositivos_confianza.sql — Dispositivo de confianza
-- En un navegador donde ya se puso el código del Autenticador, por 30 días
-- alcanza con email y contraseña. La base sigue protegiendo los datos:
-- solo los muestra si la sesión tiene el código (aal2) o si el servidor la
-- marcó como de confianza al reconocer la llave del dispositivo.
-- Estas tablas son del usuario (no del consultorio) y SOLO las toca el
-- servidor con la service role: RLS activado y sin políticas.
-- =====================================================================

-- Una fila por navegador recordado. La llave vive solo en una cookie
-- httpOnly del navegador; acá se guarda su huella (sha256), nunca la llave.
create table public.dispositivos_confianza (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  llave_hash text not null unique,
  creado_en  timestamptz not null default now(),
  vence_en   timestamptz not null
);
create index dispositivos_confianza_usuario on public.dispositivos_confianza (user_id);

-- Sesiones que entraron sin código gracias a un dispositivo de confianza.
-- Se borran solas cuando se cierra la sesión (cascade desde auth.sessions).
create table public.sesiones_confianza (
  session_id     uuid primary key references auth.sessions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  dispositivo_id uuid not null references public.dispositivos_confianza(id) on delete cascade,
  creado_en      timestamptz not null default now()
);

alter table public.dispositivos_confianza enable row level security;
alter table public.sesiones_confianza enable row level security;
revoke all on public.dispositivos_confianza, public.sesiones_confianza from anon, authenticated;

-- ¿La sesión actual puede ver datos? Con código, o marcada de confianza
-- por un dispositivo que todavía no venció.
create or replace function public.sesion_verificada()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or exists (
           select 1
           from public.sesiones_confianza s
           join public.dispositivos_confianza d on d.id = s.dispositivo_id
           where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
             and s.user_id = auth.uid()
             and d.vence_en > now())
$$;

revoke execute on function public.sesion_verificada() from public, anon;
grant execute on function public.sesion_verificada() to authenticated;

-- Reemplaza la exigencia de 0005 (solo aal2) por sesion_verificada().
create or replace function public.mis_consultorios()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select consultorio_id from public.miembros
  where user_id = auth.uid()
    and public.sesion_verificada()
$$;

alter policy miembro_ver on public.miembros
  using (user_id = auth.uid() and public.sesion_verificada());
