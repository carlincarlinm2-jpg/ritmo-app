-- Permite que Nutri use el mismo sistema de avisos: cada recordatorio y cada dispositivo
-- sabe a qué app pertenece ('ritmo' o 'nutri'), así no se mezclan.
alter table public.rt_items add column if not exists app text not null default 'ritmo';
alter table public.rt_push_subs add column if not exists app text not null default 'ritmo';
create index if not exists rt_items_app on public.rt_items(user_id, app);
