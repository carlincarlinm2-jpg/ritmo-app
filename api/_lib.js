// Utilidades compartidas del servidor: cliente de Supabase con permisos de servidor
// y llaves VAPID para Web Push (se generan solas la primera vez y se guardan en rt_config).
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

function admin() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { const e = new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.'); e.statusCode = 500; throw e; }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getVapid(sb) {
  const read = async () => {
    const { data } = await sb.from('rt_config').select('key,value').in('key', ['vapid_public', 'vapid_private']);
    const m = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    return m.vapid_public && m.vapid_private ? { publicKey: m.vapid_public, privateKey: m.vapid_private } : null;
  };
  let v = await read();
  if (!v) {
    const k = webpush.generateVAPIDKeys();
    // ignoreDuplicates: si dos llamadas llegan al mismo tiempo, gana la primera y ambas usan la misma llave.
    await sb.from('rt_config').upsert([{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }], { onConflict: 'key', ignoreDuplicates: true });
    v = await read();
  }
  webpush.setVapidDetails('mailto:ritmo@example.com', v.publicKey, v.privateKey);
  return v;
}

// Manda una notificación a todas las suscripciones de un usuario; borra las que ya no existen.
async function pushToUser(sb, subs, payload) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await sb.from('rt_push_subs').delete().eq('id', s.id);
      else console.error('push error', err.statusCode, err.body);
    }
  }
  return sent;
}

// Fecha, hora y día de la semana "locales" de una zona horaria.
function localParts(tz, d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday];
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, minutes: +p.hour * 60 + +p.minute, weekday: wd };
}

module.exports = { admin, getVapid, pushToUser, localParts };
