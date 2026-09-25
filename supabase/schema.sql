-- Ritmo — esquema para Supabase (se agrega al mismo proyecto que Nutri; tablas con prefijo rt_).
-- Las cuentas (auth.users) se comparten: la misma persona puede entrar a Nutri y a Ritmo.

-- Recordatorios, hábitos y pendientes en una sola tabla.
--   kind = 'reminder' → due_at (fecha y hora exacta, se notifica una vez)
--   kind = 'habit'    → se repite en days (0=domingo … 6=sábado); time_of_day opcional ('HH:MM')
--                       y moment ('manana' | 'tarde' | 'noche' | 'cualquiera') para agrupar la rutina
--   kind = 'todo'     → pendiente de un día (on_date), sin hora
create table if not exists public.rt_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reminder','habit','todo')),
  title text not null,
  emoji text,
  due_at timestamptz,
  time_of_day text,
  days int[] not null default '{0,1,2,3,4,5,6}',
  moment text not null default 'cualquiera',
  on_date date,
  done boolean not null default false,
  done_at timestamptz,
  notified boolean not null default false,
  last_notified_date date,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists rt_items_user on public.rt_items(user_id);
create index if not exists rt_items_due on public.rt_items(kind, notified, due_at);

-- Registro de hábitos cumplidos por día (para rachas).
create table if not exists public.rt_habit_log (
  item_id uuid not null references public.rt_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (item_id, day)
);

-- Suscripciones de notificaciones (un registro por dispositivo).
create table if not exists public.rt_push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null default 'America/Mexico_City',
  created_at timestamptz not null default now()
);

-- Configuración interna del servidor (llaves de notificaciones). Sin políticas: solo el servidor la lee.
create table if not exists public.rt_config (key text primary key, value text not null);

alter table public.rt_items enable row level security;
alter table public.rt_habit_log enable row level security;
alter table public.rt_push_subs enable row level security;
alter table public.rt_config enable row level security;

drop policy if exists rt_items_own on public.rt_items;
create policy rt_items_own on public.rt_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists rt_log_own on public.rt_habit_log;
create policy rt_log_own on public.rt_habit_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists rt_subs_own on public.rt_push_subs;
create policy rt_subs_own on public.rt_push_subs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
