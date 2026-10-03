// Avisos de Fluent (inglés): recordatorio diario a la hora elegida si aún no practica, y a las 9:30 pm si su racha está en riesgo.
const { pushToUser, localParts } = require('./_lib');
const toMin = (t) => { const [h, m] = String(t || '19:00').split(':').map(Number); return h * 60 + (m || 0); };
const MSG = [
  ['¿Practicamos inglés?', 'Kiko te espera con tu lección de hoy. Son solo 5 minutos.'],
  ['Time for English!', 'Una lección rápida y sigues avanzando.'],
  ['Tu meta de hoy te espera', 'Haz una lección o un repaso con Kiko.'],
];
async function fluentTick(sb, tzByUser, subsOf) {
  let sent = 0;
  const users = Object.keys(tzByUser); if (!users.length) return 0;
  const { data: rows } = await sb.from('en_state').select('user_id,last_day,streak,remind_time,sent').in('user_id', users);
  for (const r of rows || []) {
    const subs = await subsOf(r.user_id, 'fluent'); if (!subs.length) continue;
    const lp = localParts(tzByUser[r.user_id]);
    if (r.last_day === lp.date) continue; // ya practicó hoy
    const sentMap = r.sent || {}; const todo = [];
    const rt = toMin(r.remind_time); if (lp.minutes >= rt && lp.minutes - rt < 20 && !sentMap[lp.date + ':daily']) todo.push('daily');
    const risk = 21 * 60 + 30; if ((r.streak || 0) > 0 && lp.minutes >= risk && lp.minutes - risk < 20 && !sentMap[lp.date + ':risk']) todo.push('risk');
    for (const kind of todo) {
      const keep = {}; for (const [k, v] of Object.entries(sentMap)) if (k.slice(0, 10) >= lp.date) keep[k] = v; keep[lp.date + ':' + kind] = 1;
      await sb.from('en_state').update({ sent: keep }).eq('user_id', r.user_id); Object.assign(sentMap, keep);
      const [title, body] = kind === 'risk' ? [`Tu racha de ${r.streak} días está en riesgo`, 'Haz una lección rápida antes de dormir para no perderla.'] : MSG[new Date().getDate() % MSG.length];
      sent += await pushToUser(sb, subs, { title, body, tag: 'fluent-' + kind, url: '/' });
    }
  }
  return sent;
}
module.exports = { fluentTick };
