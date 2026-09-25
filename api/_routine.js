// Avisos de rutina: a las horas elegidas (2 por momento del día) manda los hábitos que faltan de ese momento.
// La noche puede pasar de medianoche (ej. 00:30): entonces cuenta como el día anterior.
const { pushToUser, localParts } = require('./_lib');

const DEFAULTS = { manana: { on: true, times: ['07:00', '10:30'] }, tarde: { on: true, times: ['13:00', '16:30'] }, noche: { on: true, times: ['20:30', '23:30'] } };
const LABEL = { manana: 'de la mañana', tarde: 'de la tarde', noche: 'de la noche' };
const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
function prevDay(date) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }

async function routineTick(sb, tzByUser, subsOf) {
  let sent = 0;
  const users = Object.keys(tzByUser);
  if (!users.length) return 0;
  const { data: prefs } = await sb.from('rt_prefs').select('user_id,routine,sent').in('user_id', users);
  const byUser = Object.fromEntries((prefs || []).map((p) => [p.user_id, p]));
  for (const uid of users) {
    if (!(await subsOf(uid, 'ritmo')).length) continue; // solo quien activó avisos en Ritmo
    const lp = localParts(tzByUser[uid]);
    const pref = byUser[uid] || { routine: null, sent: {} };
    const routine = { ...DEFAULTS, ...(pref.routine || {}) };
    for (const moment of ['manana', 'tarde', 'noche']) {
      const cfg = routine[moment];
      if (!cfg || !cfg.on) continue;
      for (let idx = 0; idx < (cfg.times || []).length; idx++) {
        const t = toMin(cfg.times[idx]);
        if (lp.minutes < t || lp.minutes - t > 15) continue;
        // Después de medianoche (antes de las 5) cuenta como la noche del día anterior.
        const logical = t < 300 ? prevDay(lp.date) : lp.date;
        const wd = t < 300 ? (lp.weekday + 6) % 7 : lp.weekday;
        const key = `${logical}:${moment}:${idx}`;
        const sentMap = pref.sent || {};
        if (sentMap[key]) continue;
        const { data: hs } = await sb.from('rt_items').select('id,title,days').eq('user_id', uid).eq('app', 'ritmo').eq('kind', 'habit').eq('moment', moment);
        const todays = (hs || []).filter((h) => (h.days || []).includes(wd));
        // Marca como enviado (y limpia días viejos) aunque no haya pendientes, para no revisar de nuevo.
        const keep = Object.fromEntries(Object.entries(sentMap).filter(([k]) => k >= prevDay(lp.date)));
        keep[key] = true; pref.sent = keep;
        await sb.from('rt_prefs').upsert({ user_id: uid, routine: pref.routine || null, sent: keep });
        if (!todays.length) continue;
        const { data: logs } = await sb.from('rt_habit_log').select('item_id').eq('user_id', uid).eq('day', logical).in('item_id', todays.map((h) => h.id));
        const done = new Set((logs || []).map((l) => l.item_id));
        const pending = todays.filter((h) => !done.has(h.id));
        if (!pending.length) continue;
        const names = pending.slice(0, 4).map((h) => h.title).join(', ') + (pending.length > 4 ? ` y ${pending.length - 4} más` : '');
        const n = pending.length;
        const title = idx === 0 ? `Tu rutina ${LABEL[moment]}: ${n} ${n === 1 ? 'pendiente' : 'pendientes'}` : `Todavía ${n === 1 ? 'te falta 1 hábito' : 'te faltan ' + n + ' hábitos'} ${LABEL[moment]}`;
        sent += await pushToUser(sb, await subsOf(uid, 'ritmo'), { title, body: names, tag: 'routine-' + moment, url: '/?view=today' });
      }
    }
  }
  return sent;
}
module.exports = { routineTick, DEFAULTS };
