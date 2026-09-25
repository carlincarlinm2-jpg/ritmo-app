// Utilidades compartidas del servidor: cliente de Supabase con permisos de servidor
// y llaves VAPID para Web Push (se generan solas la primera vez y se guardan en rt_config).
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

function admin() {
  // Quita espacios y saltos de línea en cualquier parte (a veces se cuelan al copiar la llave).
  const url = (process.env.SUPABASE_URL || '').replace(/\s+/g, ''), key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\s+/g, '');
  if (!url || !key) { const e = new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.'); e.statusCode = 500; throw e; }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getVapid(sb) {
  const read = async () => {
    const { data, error } = await sb.from('rt_config').select('key,value').in('key', ['vapid_public', 'vapid_private']);
    if (error) { console.error('rt_config read', error.message); const e = new Error('No se pudo conectar con la base de datos.'); e.statusCode = 500; throw e; }
    const m = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    return m.vapid_public && m.vapid_private ? { publicKey: m.vapid_public, privateKey: m.vapid_private } : null;
  };
  let v = await read();
  if (!v) {
    const k = webpush.generateVAPIDKeys();
    // ignoreDuplicates: si dos llamadas llegan al mismo tiempo, gana la primera y ambas usan la misma llave.
    const { error: upErr } = await sb.from('rt_config').upsert([{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }], { onConflict: 'key', ignoreDuplicates: true });
    if (upErr) { console.error('rt_config write', upErr.message); const e = new Error('No se pudo conectar con la base de datos.'); e.statusCode = 500; throw e; }
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

// Nutri usa este mismo servidor de avisos desde su propio dominio.
const APP_URL = { ritmo: 'https://hola-ritmo.vercel.app', nutri: 'https://hola-nutri.vercel.app', lana: 'https://hola-lana.vercel.app' };
const ALLOWED = ['https://hola-ritmo.vercel.app', 'https://hola-nutri.vercel.app', 'https://nutri-app-sage-sigma.vercel.app', 'https://ritmo-app-wheat.vercel.app', 'https://hola-lana.vercel.app'];
const ALLOWED_RE = /^https:\/\/lana-[a-z0-9-]*\.vercel\.app$/;
function cors(req, res) {
  const o = req.headers.origin;
  if (o && (ALLOWED.includes(o) || ALLOWED_RE.test(o))) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

module.exports = { admin, getVapid, pushToUser, localParts, cors, APP_URL };
