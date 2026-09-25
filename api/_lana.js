// Avisos de Lana (finanzas): fecha límite de pago (3 días antes, 1 día antes y el día) y fecha de corte.
// Se revisa a partir de las 9:00 hora local de cada persona; notified_key evita repetir el mismo aviso.
const { pushToUser, localParts, APP_URL } = require('./_lib');

const mxn = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1..12
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function dayIn(y, m, day) { return Math.min(day, lastDay(y, m)); }
function diffDays(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

// Próxima fecha de pago (hoy o después) para un día del mes.
function nextDue(today, payDay) {
  let [y, m] = today.split('-').map(Number);
  for (let i = 0; i < 2; i++) {
    const d = ymd(y, m, dayIn(y, m, payDay));
    if (d >= today) return d;
    m++; if (m > 12) { m = 1; y++; }
  }
  return null;
}

async function lanaTick(sb, tzByUser, subsOf) {
  let sent = 0;
  const users = Object.keys(tzByUser);
  if (!users.length) return 0;
  const { data: accs } = await sb.from('fz_accounts').select('*').eq('archived', false).eq('notify', true).in('user_id', users);
  for (const a of accs || []) {
    const lp = localParts(tzByUser[a.user_id]);
    if (lp.minutes < 9 * 60) continue; // desde las 9:00
    const today = lp.date;
    const [y, m] = today.split('-').map(Number);
    const msgs = [];
    if (a.pay_day) {
      const due = nextDue(today, a.pay_day);
      const left = due ? diffDays(today, due) : 99;
      const cycle = due && due.slice(0, 7);
      const owes = a.kind !== 'card' || Number(a.balance) > 0 || (a.plans || []).length;
      if ([3, 1, 0].includes(left) && a.paid_cycle !== cycle && owes) {
        const when = left === 0 ? 'hoy es tu día límite de pago' : left === 1 ? 'pagas mañana' : 'pagas en 3 días';
        let body;
        if (a.kind === 'card') body = [a.no_interest_payment ? 'Para no generar intereses: ' + mxn(a.no_interest_payment) : null, a.min_payment ? 'Mínimo: ' + mxn(a.min_payment) : null].filter(Boolean).join(' · ') || 'Revisa cuánto te toca pagar.';
        else body = a.monthly_payment ? 'Mensualidad: ' + mxn(a.monthly_payment) : 'No se te olvide.';
        msgs.push({ key: today + ':pay', title: `${a.name}: ${when}`, body });
      }
    }
    if (a.kind === 'card' && a.cut_day && today === ymd(y, m, dayIn(y, m, a.cut_day))) {
      msgs.push({ key: today + ':cut', title: `${a.name}: hoy es tu fecha de corte`, body: 'Lo que compres desde mañana entra en el siguiente periodo.' });
    }
    for (const msg of msgs) {
      if ((a.notified_key || '').split(',').includes(msg.key)) continue;
      const keys = (a.notified_key || '').split(',').filter((k) => k.startsWith(today)).concat(msg.key).join(',');
      await sb.from('fz_accounts').update({ notified_key: keys }).eq('id', a.id);
      a.notified_key = keys;
      sent += await pushToUser(sb, await subsOf(a.user_id, 'lana'), { title: msg.title, body: msg.body, tag: a.id + msg.key, url: APP_URL.lana + '/' });
    }
  }
  return sent;
}
module.exports = { lanaTick, nextDue };
