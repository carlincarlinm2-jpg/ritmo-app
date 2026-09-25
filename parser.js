// Entiende frases en español dictadas por voz y las convierte en recordatorio, hábito o pendiente.
// Todo corre en el teléfono (sin IA de pago). Ejemplos:
//   "mañana a las 7 ir al gym"                → recordatorio, mañana 07:00
//   "recuérdame en 20 minutos sacar la ropa"  → recordatorio, ahora + 20 min
//   "todos los días a las 8 tomar vitaminas"  → hábito diario 08:00
//   "tender la cama en la mañana"             → hábito de la rutina de la mañana
//   "los lunes y miércoles a las 6 de la tarde natación" → hábito lun/mié 18:00
//   "comprar leche"                           → pendiente de hoy
const RT_NUM = {un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,quince:15,veinte:20,treinta:30,cuarenta:40,'cuarenta y cinco':45,media:30};
const RT_DAYS = {domingo:0,domingos:0,lunes:1,martes:2,miercoles:3,miércoles:3,jueves:4,viernes:5,sabado:6,sábado:6,sabados:6,sábados:6};
function rtNum(w){if(w==null)return null;w=String(w).trim();return /^\d+$/.test(w)?+w:(RT_NUM[w]??null)}
function parseDictation(text, now = new Date()) {
  let t = ' ' + String(text || '').trim().replace(/\s+/g, ' ') + ' ';
  const low = () => t.toLowerCase();
  const cut = (re) => { t = t.replace(re, ' '); };
  const out = { kind: 'todo', title: '', due: null, time: null, days: [0,1,2,3,4,5,6], moment: 'cualquiera', onDate: null };
  let date = null, h = null, m = 0, rel = null, recurring = false, days = null;

  // --- repetición ---
  if (/\b(todos los d[ií]as|diario|diariamente|cada d[ií]a|todas las (mañanas|noches|tardes))\b/i.test(t)) { recurring = true; cut(/\b(todos los d[ií]as|diario|diariamente|cada d[ií]a)\b/ig); }
  if (/\bentre semana\b/i.test(t)) { recurring = true; days = [1,2,3,4,5]; cut(/\bentre semana\b/ig); }
  if (/\b(fines? de semana)\b/i.test(t)) { recurring = true; days = [0,6]; cut(/\b(los )?fines? de semana\b/ig); }
  const multi = low().match(/\b(?:todos los |cada |los )((?:(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)(?:,| y | e |\s)*)+)/i);
  if (multi) { recurring = true; days = [...new Set(multi[1].split(/,| y | e |\s/).map(w=>RT_DAYS[w.trim()]).filter(d=>d!=null))].sort(); cut(new RegExp(multi[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i')); }

  // --- momento del día ---
  const mom = low().match(/\b(?:en la |por la |todas las |a la )(mañana|mañanas|tarde|tardes|noche|noches)\b/i);
  let momentWord = null;
  if (mom) { momentWord = mom[1].replace(/s$/,''); }

  // --- tiempo relativo ---
  const r = low().match(/\ben (un|una|media|\d+|dos|tres|cuatro|cinco|diez|quince|veinte|treinta|cuarenta)\s*(minutos?|mins?|horas?|hrs?)\b/i);
  if (r) { const n = rtNum(r[1]); const unit = /h/.test(r[2]) ? 60 : 1; rel = (r[1]==='media' ? 30 : n * unit); cut(new RegExp(r[0], 'i')); }
  if (/\ben media hora\b/i.test(t)) { rel = 30; cut(/\ben media hora\b/ig); }

  // --- fecha ---
  if (/\bpasado mañana\b/i.test(t)) { date = new Date(now); date.setDate(date.getDate() + 2); cut(/\bpasado mañana\b/ig); }
  else if (/\bmañana\b/i.test(t) && !/\b(en la|por la|de la|todas las|a la) mañana\b/i.test(t)) { date = new Date(now); date.setDate(date.getDate() + 1); cut(/\bmañana\b/i); }
  if (/\bhoy\b/i.test(t)) { date = new Date(now); cut(/\bhoy\b/ig); }
  if (!recurring) {
    const wd = low().match(/\b(?:el |este |próximo |proximo )?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i);
    if (wd) { const target = RT_DAYS[wd[1]]; date = new Date(now); let add = (target - date.getDay() + 7) % 7; if (add === 0) add = 7; date.setDate(date.getDate() + add); cut(new RegExp(wd[0], 'i')); }
  }

  // --- hora ---
  let hm = low().match(/\b(?:a las|a la|a eso de las|como a las|las)\s+(\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?:(?::|\s?y\s?)(\d{1,2}|media|cuarto|quince|treinta))?\s*(de la mañana|de la tarde|de la noche|de la madrugada|a\.?\s?m\.?|p\.?\s?m\.?|am|pm|hrs|horas)?/i);
  if (hm) {
    h = rtNum(hm[1]); const mins = hm[2]; m = mins == null ? 0 : mins === 'media' ? 30 : mins === 'cuarto' ? 15 : rtNum(mins) || 0;
    const suf = (hm[3] || '').toLowerCase();
    if (/tarde|noche|p\.?\s?m/.test(suf) && h < 12) h += 12;
    if (/mañana|madrugada|a\.?\s?m/.test(suf) && h === 12) h = 0;
    if (!suf && momentWord && (momentWord === 'tarde' || momentWord === 'noche') && h < 12) h += 12;
    cut(new RegExp(hm[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i'));
  } else if (/\b(al )?mediod[ií]a\b/i.test(t)) { h = 12; m = 0; cut(/\b(a )?(al )?mediod[ií]a\b/ig); }
  if (mom) cut(new RegExp('\\b(en la|por la|todas las|a la) ' + mom[1] + '\\b', 'i'));
  cut(/\bde la (mañana|tarde|noche)\b/ig);

  // --- limpieza del título ---
  t = t.replace(/\b(recu[eé]rdame|recordarme|recordar|av[ií]same|acu[eé]rdame|pon(me)? (un )?recordatorio( de| para)?|agrega(r)?|anota(r)?|que tengo que|tengo que|que|de que)\b/ig, ' ')
       .replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
  out.title = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';

  // --- decidir tipo ---
  const pad = (n) => String(n).padStart(2, '0');
  if (momentWord) out.moment = momentWord === 'mañana' ? 'manana' : momentWord;
  if (recurring || (momentWord && h == null && !date && rel == null)) {
    out.kind = 'habit'; if (days) out.days = days;
    if (h != null) { out.time = `${pad(h)}:${pad(m)}`; if (!momentWord) out.moment = h < 12 ? 'manana' : h < 19 ? 'tarde' : 'noche'; }
  } else if (rel != null) {
    out.kind = 'reminder'; out.due = new Date(now.getTime() + rel * 60000);
  } else if (h != null) {
    out.kind = 'reminder';
    const suffixed = hm && hm[3];
    if (!suffixed && h >= 1 && h <= 11) {
      // Sin "de la mañana/tarde": de 1 a 6 casi siempre es de la tarde; si no, la siguiente hora que viene.
      if (date) { out.due = new Date(date); out.due.setHours(h <= 6 ? h + 12 : h, m, 0, 0); }
      else {
        const base = new Date(now), cands = [];
        for (const add of [0, 1]) for (const hh of (h <= 6 ? [h + 12, h] : [h, h + 12])) { const d = new Date(base); d.setDate(d.getDate() + add); d.setHours(hh, m, 0, 0); cands.push(d); }
        out.due = cands.filter((d) => d > now).sort((a, b) => a - b).find((d) => !(h <= 6 && d.getHours() === h)) || cands.find((d) => d > now);
      }
    } else {
      const d = date ? new Date(date) : new Date(now); d.setHours(h, m, 0, 0);
      if (!date && d <= now) d.setDate(d.getDate() + 1);
      out.due = d;
    }
  } else {
    out.kind = 'todo'; const d = date || now; out.onDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = { parseDictation };
