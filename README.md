# Ritmo — rutinas, hábitos y recordatorios

Anota con la voz ("mañana a las 7 ir al gym", "todos los días a las 8 tomar vitaminas",
"tender la cama en la mañana", "comprar leche") y Ritmo lo convierte en recordatorio, hábito
o pendiente. Te avisa con notificaciones a la hora indicada. Funciona en iPhone (instalada en
la pantalla de inicio), Android y computadora.

## Piezas
- `index.html` — la app (con la Luna, la mascota), `parser.js` — entiende lo que dictas (sin IA de pago).
- `sw.js` — recibe las notificaciones aunque la app esté cerrada.
- `api/tick.js` — lo llama Supabase cada minuto y manda los avisos que tocan.
- `api/vapid.js`, `api/test-push.js` — llaves de notificaciones y notificación de prueba.
- `supabase/schema.sql` — tablas (`rt_*`) en el mismo proyecto de Supabase que Nutri.
- `supabase/cron.sql` — programa la revisión cada minuto.

## Variables en Vercel
- `SUPABASE_URL` = https://xvncydijzordzwrilqai.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` = llave secreta *service_role* de Supabase (Project Settings → API).

Costo: $0 (Supabase, Vercel y el reconocimiento de voz del teléfono son gratis).
