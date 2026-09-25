-- Revisa cada minuto si hay avisos que mandar (llama a la API de Ritmo en Vercel).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('ritmo-tick') where exists (select 1 from cron.job where jobname = 'ritmo-tick');
select cron.schedule('ritmo-tick', '* * * * *', $$ select net.http_get('https://hola-ritmo.vercel.app/api/tick') $$);
