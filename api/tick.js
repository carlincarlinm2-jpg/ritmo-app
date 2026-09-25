// GET /api/tick — lo llama Supabase (pg_cron) cada minuto.
// Envía: 1) recordatorios cuya hora ya llegó, 2) hábitos con hora cuyo momento llegó hoy.
// Es seguro llamarlo de más: cada aviso se marca como enviado y no se repite.
const { admin, getVapid, pushToUser, localParts, APP_URL } = require('./_lib');
const { lanaTick } = require('./_lana');

module.exports = async (req, res) => {
  try {
    const sb = admin();
    await getVapid(sb);
    let sent = 0;

    // 1) Recordatorios vencidos (de las últimas 12 h, para no mandar avisos viejísimos tras una caída).
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data: due } = await sb.from('rt_items').select('id,user_id,title,emoji,app').eq('kind', 'reminder').eq('notified', false).eq('done', false).lte('due_at', new Date().toISOString()).gte('due_at', since).limit(200);
    const subsCache = {};
    const subsOf = async (uid, app = 'ritmo') => subsCache[uid + app] || (subsCache[uid + app] = (await sb.from('rt_push_subs').select('*').eq('user_id', uid).eq('app', app)).data || []);
    for (const r of due || []) {
      await sb.from('rt_items').update({ notified: true }).eq('id', r.id);
      const app = r.app || 'ritmo';
      sent += await pushToUser(sb, await subsOf(r.user_id, app), { title: `${r.emoji ? r.emoji + ' ' : ''}${r.title}`, body: 'Es la hora de tu recordatorio.', tag: r.id, url: app === 'ritmo' ? '/?view=reminders' : APP_URL[app] + '/' });
    }
    // Recordatorios más viejos que 12 h sin avisar: se marcan como avisados sin mandar nada.
    await sb.from('rt_items').update({ notified: true }).eq('kind', 'reminder').eq('notified', false).lt('due_at', since);

    // 2) Hábitos con hora, según la zona horaria de cada dispositivo.
    const { data: subs } = await sb.from('rt_push_subs').select('user_id,tz');
    const tzByUser = {};
    for (const s of subs || []) tzByUser[s.user_id] = tzByUser[s.user_id] || s.tz;
    const users = Object.keys(tzByUser);
    if (users.length) {
      const { data: habits } = await sb.from('rt_items').select('id,user_id,title,emoji,time_of_day,days,last_notified_date,moment,app').eq('kind', 'habit').not('time_of_day', 'is', null).in('user_id', users);
      for (const h of habits || []) {
        const lp = localParts(tzByUser[h.user_id]);
        const [hh, mm] = String(h.time_of_day).split(':').map(Number);
        const t = hh * 60 + mm;
        if (!(h.days || []).includes(lp.weekday)) continue;
        if (h.last_notified_date === lp.date) continue;
        if (lp.minutes < t || lp.minutes - t > 15) continue;
        const { data: doneToday } = await sb.from('rt_habit_log').select('day').eq('item_id', h.id).eq('day', lp.date).maybeSingle();
        await sb.from('rt_items').update({ last_notified_date: lp.date }).eq('id', h.id);
        if (doneToday) continue;
        const app = h.app || 'ritmo';
        sent += await pushToUser(sb, await subsOf(h.user_id, app), { title: `${h.emoji ? h.emoji + ' ' : ''}${h.title}`, body: (app === 'nutri' ? 'Tu brócoli te lo recuerda 🥦' : 'Tu hábito de hoy. ¡Tú puedes!'), tag: h.id + lp.date, url: app === 'ritmo' ? '/?view=today' : APP_URL[app] + '/' });
      }
    }
    // 3) Lana: fechas de pago y de corte (si falla, no afecta los demás avisos).
    try { sent += await lanaTick(sb, tzByUser, subsOf); } catch (e) { console.error('lana tick', e.message); }
    res.status(200).json({ ok: true, sent });
  } catch (e) {
    console.error('tick error', e);
    res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : 'Error interno' });
  }
};
