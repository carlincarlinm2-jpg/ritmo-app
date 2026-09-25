-- Preferencias de avisos de rutina (2 avisos por mañana, tarde y noche con los hábitos pendientes).
create table if not exists public.rt_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  routine jsonb,               -- {manana:{on,times:['07:00','10:30']}, tarde:{...}, noche:{...}}
  sent jsonb not null default '{}',  -- avisos ya mandados hoy (lo usa el servidor)
  updated_at timestamptz not null default now()
);
alter table public.rt_prefs enable row level security;
drop policy if exists rt_prefs_own on public.rt_prefs;
create policy rt_prefs_own on public.rt_prefs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
