-- Propósitos "días sin…" (dejar Sabritas, fumar, refresco…). Cada día se marca: lo logré (clean) o recaí.
create table if not exists public.rt_quits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  icon text,
  why text,
  start_date date not null default current_date,
  money_per_day numeric,
  created_at timestamptz not null default now()
);
create table if not exists public.rt_quit_log (
  quit_id uuid not null references public.rt_quits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  clean boolean not null,
  primary key (quit_id, day)
);
alter table public.rt_quits enable row level security;
alter table public.rt_quit_log enable row level security;
drop policy if exists rt_quits_own on public.rt_quits;
create policy rt_quits_own on public.rt_quits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists rt_quit_log_own on public.rt_quit_log;
create policy rt_quit_log_own on public.rt_quit_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
