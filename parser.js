// Ritmo: convierte lo que dices en recordatorio, hábito o pendiente.
// Usa el intérprete compartido (speech-parser.js), que entiende frases como
// "jueves 4 pm doctor", "el 15 de octubre a las 10", "mañana 8:30 junta", "en 20 minutos sacar la ropa".
function parseDictation(text, now = new Date()) {
  const P = (typeof parseSpeech === 'function') ? parseSpeech : require('./speech-parser.js').parseSpeech;
  const p = P(text, now);
  const out = { kind: 'todo', title: p.title, due: null, time: null, days: [0, 1, 2, 3, 4, 5, 6], moment: p.moment || 'cualquiera', onDate: null };
  const pad = (n) => String(n).padStart(2, '0');
  const hourMoment = (t) => { const h = +t.slice(0, 2); return h < 12 ? 'manana' : h < 19 ? 'tarde' : 'noche'; };
  if (p.recurring && p.repeat !== 'yearly' && p.repeat !== 'monthly') {
    out.kind = 'habit'; out.days = p.days; out.time = p.time;
    if (out.moment === 'cualquiera' && p.time) out.moment = hourMoment(p.time);
  } else if (p.due) {
    out.kind = 'reminder'; out.due = p.due;
  } else if (p.date) {
    out.kind = 'reminder'; const [y, m, d] = p.date.split('-').map(Number); out.due = new Date(y, m - 1, d, 9, 0);
  } else if (p.moment && p.moment !== 'cualquiera') {
    out.kind = 'habit';
  } else {
    out.kind = 'todo'; out.onDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = { parseDictation };
