// Avisos de Days: cumpleaños, citas, eventos y recordatorios.
// Cada evento trae sus avisos: {d:N,t:'HH:MM'} (N días antes a esa hora) o {m:N} (N minutos antes de la hora).
// Se compara en "minutos locales" de cada persona; ventana de 20 min por si el cron se atrasa. sent evita repetir.
const { pushToUser, localParts } = require('./_lib');

const pad = (n) => String(n).padStart(2, '0');
const dayIdx = (k) => Math.round(Date.parse(k + 'T00:00:00Z') / 864e5);
const fromIdx = (i) => new Date(i * 864e5).toISOString().slice(0, 10);
const toMin = (t) => { const [h, m] = String(t || '09:00').split(':').map(Number); return h * 60 + (m || 0); };
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function occurrences(ev, from, to) {
  const res = []; const base = ev.date; if (!base) return res;
  const [, bm, bd] = base.split('-').map(Number);
  if (ev.repeat === 'yearly') { for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) { const k = `${y}-${pad(bm)}-${pad(Math.min(bd, lastDay(y, bm)))}`; if (k >= from && k <= to && (ev.kind === 'birthday' || k >= base)) res.push(k); } }
  else if (ev.repeat === 'monthly') { let y = +from.slice(0, 4), m = +from.slice(5, 7); for (let i = 0; i < 3; i++) { const k = `${y}-${pad(m)}-${pad(Math.min(bd, lastDay(y, m)))}`; if (k > to) break; if (k >= from && k >= base) res.push(k); m++; if (m > 12) { m = 1; y++; } } }
  else if (ev.repeat === 'weekly') { let i = dayIdx(base); const f = dayIdx(from), t = dayIdx(to); if (i < f) i += Math.ceil((f - i) / 7) * 7; for (; i <= t; i += 7) res.push(fromIdx(i)); }
  else if (base >= from && base <= to) res.push(base);
  return res;
}
function fmtTime(t) { if (!t) return ''; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; }
function fmtDate(k) { try { const s = new Date(k + 'T12:00:00Z').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); return s.charAt(0).toUpperCase() + s.slice(1); } catch (e) { return k; } }
function message(ev, occ, alert, daysLeft) {
  const age = ev.kind === 'birthday' && ev.born_year ? +occ.slice(0, 4) - ev.born_year : null;
  const when = ev.time ? ` a las ${fmtTime(ev.time)}` : '';
  if (ev.kind === 'birthday') {
    if (daysLeft === 0) return { title: `Hoy: ${ev.title}`, body: age ? `Cumple ${age} años. Mándale un mensaje.` : 'No olvides felicitarle.' };
    return { title: `${ev.title} ${daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`}`, body: `${fmtDate(occ)}${age ? `, cumple ${age}` : ''}.` };
  }
  if (alert.m != null) {
    if (alert.m === 0) return { title: `Ahora: ${ev.title}`, body: ev.notes || 'Es la hora.' };
    const h = alert.m >= 60 ? `${alert.m / 60} ${alert.m === 60 ? 'hora' : 'horas'}` : `${alert.m} minutos`;
    return { title: `En ${h}: ${ev.title}`, body: `Hoy${when}.${ev.notes ? ' ' + ev.notes : ''}` };
  }
  if (daysLeft === 0) return { title: `Hoy: ${ev.title}`, body: ev.time ? `A las ${fmtTime(ev.time)}.` : 'Es hoy.' };
  if (daysLeft === 1) return { title: `Mañana: ${ev.title}`, body: `${fmtDate(occ)}${when}.` };
  return { title: `En ${daysLeft} días: ${ev.title}`, body: `${fmtDate(occ)}${when}.` };
}

async function daysTick(sb, tzByUser, subsOf) {
  let sent = 0;
  for (const uid of Object.keys(tzByUser)) {
    const subs = await subsOf(uid, 'days'); if (!subs.length) continue;
    const lp = localParts(tzByUser[uid]);
    const nowOrd = dayIdx(lp.date) * 1440 + lp.minutes;
    const { data: evs } = await sb.from('dy_events').select('*').eq('user_id', uid).eq('done', false);
    for (const ev of evs || []) {
      const alerts = Array.isArray(ev.alerts) ? ev.alerts : []; if (!alerts.length) continue;
      const maxD = Math.max(0, ...alerts.map((a) => a.d || 0));
      const occs = occurrences(ev, lp.date, fromIdx(dayIdx(lp.date) + maxD + 1));
      let sentMap = ev.sent || {}, changed = false;
      for (const occ of occs) {
        for (const a of alerts) {
          const fire = a.m != null ? dayIdx(occ) * 1440 + toMin(ev.time || '09:00') - a.m : (dayIdx(occ) - (a.d || 0)) * 1440 + toMin(a.t);
          const diff = nowOrd - fire;
          if (diff < 0 || diff >= 20) continue;
          const key = `${occ}|${a.m != null ? 'm' + a.m : 'd' + a.d}`;
          if (sentMap[key]) continue;
          sentMap[key] = 1; changed = true;
          const msg = message(ev, occ, a, dayIdx(occ) - dayIdx(lp.date));
          sent += await pushToUser(sb, subs, { ...msg, tag: ev.id + key, url: '/' });
        }
      }
      if (changed) {
        const keep = {}; const cutoff = fromIdx(dayIdx(lp.date) - 2);
        for (const [k, v] of Object.entries(sentMap)) if (k.slice(0, 10) >= cutoff) keep[k] = v;
        await sb.from('dy_events').update({ sent: keep }).eq('id', ev.id);
      }
    }
  }
  return sent;
}
module.exports = { daysTick, occurrences, message };
