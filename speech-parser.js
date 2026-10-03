// Intérprete de frases en español (dictadas o escritas). Todo corre en el teléfono, sin IA de pago.
// parseSpeech("jueves a las 4 pm ir al doctor") →
//   { kind:'appointment', title:'Ir al doctor', date:'2026-10-08', time:'16:00', due:Date, repeat:'none', ... }
// Lo usan Days (calendario) y Ritmo (rutinas y recordatorios).
(function (root) {
  const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, 'dieciséis': 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, 'veintidós': 22, veintitres: 23, 'veintitrés': 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, 'veintiséis': 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, 'treinta y uno': 31, cuarenta: 40, cincuenta: 50, sesenta: 60, primero: 1, media: 30 };
  const NUMW = '(?:\\d{1,4}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|primero)';
  const HOURW = '(\\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
  const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12, ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };
  const MONTHW = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';
  const WD = { domingo: 0, domingos: 0, lunes: 1, martes: 2, miercoles: 3, 'miércoles': 3, jueves: 4, viernes: 5, sabado: 6, 'sábado': 6, sabados: 6, 'sábados': 6 };
  const WDW = '(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?)';
  const num = (w) => { if (w == null) return null; w = String(w).trim().toLowerCase(); return /^\d+$/.test(w) ? +w : (NUM[w] ?? null); };
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function parseSpeech(text, now = new Date()) {
    let t = ' ' + String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\b([ap])\.?\s?m\.?(?=\s|$|,)/gi, (m, a) => a.toLowerCase() + 'm')   // "p. m." "p.m." → pm
      .replace(/(\d)\s?(hrs?|horas)\b/gi, '$1 hrs')
      .replace(/(\d{1,2})\.(\d{2})\b/g, '$1:$2')                                       // 4.30 → 4:30
      .trim() + ' ';
    const low = () => t.toLowerCase();
    const cut = (re) => { t = t.replace(re, ' '); };
    const cutStr = (s) => cut(new RegExp(reEsc(s), 'i'));
    const out = { kind: 'todo', title: '', date: null, time: null, due: null, repeat: 'none', days: [0, 1, 2, 3, 4, 5, 6], moment: 'cualquiera', rel: null, age: null, alerts: [], recurring: false, explicitDate: false };

    // ---- tipo por palabras clave (no se quitan del texto) ----
    const L0 = low();
    if (/\b(cumplea[ñn]os|cumple|aniversario)\b/.test(L0)) { out.kind = 'birthday'; out.repeat = 'yearly'; }
    else if (/\b(doctor|doctora|dentista|m[eé]dico|cita|consulta|ginec[oó]log|pediatra|an[aá]lisis|laboratorio|terapia|psic[oó]log|nutri[oó]log|oculista|vacuna|estudios|chequeo|tr[aá]mite|sat\b|banco)\b/.test(L0)) out.kind = 'appointment';
    else if (/\b(fiesta|boda|bautizo|reuni[oó]n|junta|evento|concierto|viaje|vuelo|partido|cena con|comida con|graduaci[oó]n|baby shower|posada|despedida|entrevista|examen|clase de)\b/.test(L0)) out.kind = 'event';

    // ---- avisos pedidos en la frase: "avísame un día antes", "recuérdame 2 horas antes", "con una semana de anticipación" ----
    const alertRe = new RegExp(`\\b(?:y\\s+)?(?:av[ií]same|recu[eé]rdame|aviso|recordatorio)?\\s*(?:con\\s+)?${NUMW}?\\s*(minutos?|horas?|d[ií]as?|semanas?)\\s*(?:antes|de anticipaci[oó]n)\\b`, 'gi');
    let am; while ((am = alertRe.exec(low()))) {
      const n = num((am[0].match(new RegExp(NUMW, 'i')) || [])[0]) || 1; const u = am[1];
      if (/min/.test(u)) out.alerts.push({ m: n }); else if (/hora/.test(u)) out.alerts.push({ m: n * 60 }); else if (/sem/.test(u)) out.alerts.push({ d: n * 7, t: '09:00' }); else out.alerts.push({ d: n, t: '09:00' });
    }
    if (out.alerts.length) cut(alertRe);
    if (/\b(?:y\s+)?(?:av[ií]same|recu[eé]rdame)\s+(?:el\s+)?(?:mismo d[ií]a|ese d[ií]a)\b/i.test(t)) { out.alerts.push({ d: 0, t: '08:00' }); cut(/\b(?:y\s+)?(?:av[ií]same|recu[eé]rdame)\s+(?:el\s+)?(?:mismo d[ií]a|ese d[ií]a)\b/ig); }

    // ---- edad: "cumple 60", "cumple 60 años", "cumple sus 30" ----
    const ag = low().match(/\b(?:cumple|cumplir[aá]|va a cumplir)\s+(?:sus\s+)?(\d{1,3})\s*(?:a[ñn]os)?\b/);
    if (ag) { out.age = +ag[1]; cutStr(ag[0]); }
    const born = low().match(/\bnaci[oó] en (\d{4})\b/);
    if (born) { out.bornYear = +born[1]; cutStr(born[0]); }

    // ---- repetición ----
    if (/\b(todos los d[ií]as|diario|diariamente|cada d[ií]a|todas las (ma[ñn]anas|noches|tardes))\b/i.test(t)) { out.recurring = true; out.repeat = 'daily'; cut(/\b(todos los d[ií]as|diario|diariamente|cada d[ií]a)\b/ig); }
    if (/\bentre semana\b/i.test(t)) { out.recurring = true; out.repeat = 'weekly'; out.days = [1, 2, 3, 4, 5]; cut(/\bentre semana\b/ig); }
    if (/\b(los )?fines? de semana\b/i.test(t)) { out.recurring = true; out.repeat = 'weekly'; out.days = [0, 6]; cut(/\b(los )?fines? de semana\b/ig); }
    const multi = low().match(new RegExp(`\\b(?:todos los |cada |los )((?:${WDW}(?:,| y | e |\\s)*)+)`, 'i'));
    if (multi) { out.recurring = true; out.repeat = 'weekly'; out.days = [...new Set(multi[1].split(/,| y | e |\s/).map((w) => WD[w.trim()]).filter((d) => d != null))].sort(); cutStr(multi[0]); }
    if (/\b(cada a[ñn]o|cada año|anual(mente)?|todos los a[ñn]os)\b/i.test(t)) { out.repeat = 'yearly'; cut(/\b(cada a[ñn]o|anual(mente)?|todos los a[ñn]os)\b/ig); }
    if (/\b(cada mes|mensual(mente)?|todos los meses)\b/i.test(t)) { out.repeat = 'monthly'; cut(/\b(cada mes|mensual(mente)?|todos los meses)\b/ig); }
    if (/\b(cada semana|semanal(mente)?|todas las semanas)\b/i.test(t)) { out.repeat = 'weekly'; out.days = [now.getDay()]; cut(/\b(cada semana|semanal(mente)?|todas las semanas)\b/ig); }

    // ---- momento del día ----
    let momentWord = null;
    const mom = low().match(/\b(?:en la |por la |todas las |a la |de la |esta )(ma[ñn]anas?|tardes?|noches?|madrugada)\b/i);
    if (mom) momentWord = mom[1].replace(/s$/, '').replace('manana', 'mañana');

    // ---- tiempo relativo: "en 20 minutos", "en 2 horas", "en 3 días", "dentro de una semana" ----
    const r = low().match(new RegExp(`\\b(?:en|dentro de)\\s+(${NUMW}|media)\\s*(minutos?|mins?|horas?|hrs?|d[ií]as?|semanas?|mes(?:es)?)\\b`, 'i'));
    let relDays = null;
    if (r) { const n = r[1] === 'media' ? 0.5 : num(r[1]) || 1; const u = r[2];
      if (/^m(in)/.test(u)) out.rel = n; else if (/^h/.test(u)) out.rel = n * 60; else if (/^d/.test(u)) relDays = n; else if (/^s/.test(u)) relDays = n * 7; else relDays = n * 30;
      cutStr(r[0]); }
    if (/\ben media hora\b/i.test(t)) { out.rel = 30; cut(/\ben media hora\b/ig); }

    // ---- fecha ----
    let date = null;
    const mk = (y, m, d) => new Date(y, m - 1, d);
    if (relDays != null) { date = new Date(now); date.setDate(date.getDate() + Math.round(relDays)); }
    if (/\bpasado ma[ñn]ana\b/i.test(t)) { date = new Date(now); date.setDate(date.getDate() + 2); cut(/\bpasado ma[ñn]ana\b/ig); }
    else if (/\bma[ñn]ana\b/i.test(t) && !/\b(en la|por la|de la|todas las|a la|esta|las) ma[ñn]anas?\b/i.test(t)) { date = new Date(now); date.setDate(date.getDate() + 1); cut(/\bma[ñn]ana\b/i); }
    if (/\bhoy\b/i.test(t)) { date = new Date(now); cut(/\bhoy\b/ig); }
    if (/\besta noche\b/i.test(t)) { date = date || new Date(now); momentWord = 'noche'; }
    if (/\bpr[oó]xima semana|semana que viene\b/i.test(t) && !date) { date = new Date(now); date.setDate(date.getDate() + ((8 - date.getDay()) % 7 || 7)); cut(/\b(la )?(pr[oó]xima semana|semana que viene)\b/ig); }
    if (/\bfin de mes\b/i.test(t)) { date = new Date(now.getFullYear(), now.getMonth() + 1, 0); cut(/\b(a )?fin de mes\b/ig); }
    // "15 de octubre", "el día 3 de marzo de 2027", "1o de enero", "primero de mayo"
    const dm = low().match(new RegExp(`\\b(?:el\\s+)?(?:d[ií]a\\s+)?(\\d{1,2}|primero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta)(?:o|º)?\\s+(?:de\\s+)?${MONTHW}(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`, 'i'));
    if (dm) {
      const d = num(dm[1]), m = MONTHS[dm[2]]; let y = dm[3] ? +dm[3] : now.getFullYear();
      let cand = mk(y, m, d); if (!dm[3] && dkey(cand) < dkey(now)) cand = mk(y + 1, m, d);
      date = cand; out.explicitDate = true; cutStr(dm[0]);
    } else {
      // "15/10", "15/10/2026", "15-10"
      const sl = low().match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
      if (sl && +sl[2] <= 12 && +sl[1] <= 31) {
        let y = sl[3] ? (+sl[3] < 100 ? 2000 + +sl[3] : +sl[3]) : now.getFullYear(); let cand = mk(y, +sl[2], +sl[1]);
        if (!sl[3] && dkey(cand) < dkey(now)) cand = mk(y + 1, +sl[2], +sl[1]);
        date = cand; out.explicitDate = true; cutStr(sl[0]);
      }
    }
    // día de la semana: "el jueves", "este viernes", "el próximo lunes", "jueves 8"
    if (!out.recurring || out.repeat === 'yearly') {
      const wd = low().match(new RegExp(`\\b(?:el |este |esta |pr[oó]ximo |proximo |el pr[oó]ximo |el siguiente )?${WDW}(?:\\s+(\\d{1,2})(?!\\s*(?::|am|pm|hrs|de la)))?(?:\\s+que viene)?\\b`, 'i'));
      if (wd && !date) {
        const target = WD[wd[1].toLowerCase()];
        if (wd[2]) { // "jueves 8" → día 8 (este mes o el siguiente)
          const n = +wd[2]; let cand = mk(now.getFullYear(), now.getMonth() + 1, n); if (dkey(cand) < dkey(now)) cand = mk(now.getFullYear(), now.getMonth() + 2, n); date = cand;
        } else {
          date = new Date(now); let add = (target - date.getDay() + 7) % 7; if (add === 0) add = 7;
          date.setDate(date.getDate() + add);
        }
        cutStr(wd[0]);
      }
    }
    // "el 15" / "el día 15" (solo el número, sin mes): este mes o el siguiente
    if (!date) {
      const dn = low().match(/\bel (?:d[ií]a )?(\d{1,2})(?!\s*(?::|am|pm|hrs|de la|y media|y cuarto|\d))\b/);
      if (dn && +dn[1] >= 1 && +dn[1] <= 31) {
        const n = +dn[1]; let cand = mk(now.getFullYear(), now.getMonth() + 1, n); if (dkey(cand) < dkey(now)) cand = mk(now.getFullYear(), now.getMonth() + 2, n);
        date = cand; out.explicitDate = true; cutStr(dn[0]);
      }
    }

    // ---- hora ----
    let h = null, m = 0, hasSuffix = false, suf = '';
    const minW = '(\\d{2}|media|cuarto|quince|treinta|cuarenta y cinco)';
    const sufW = '(de la ma[ñn]ana|de la tarde|de la noche|de la madrugada|am|pm|hrs|en punto)';
    let hm = low().match(new RegExp(`\\b(?:a las|a la|a eso de las|como a las|tipo|las|sobre las)\\s+${HOURW}(?:(?::|\\s?y\\s?)${minW})?(?:\\s+menos\\s+(cuarto|diez|cinco|veinte))?\\s*${sufW}?`, 'i'));
    if (!hm) hm = low().match(new RegExp(`\\b${HOURW}(?::${minW})\\s*${sufW}?`, 'i'));               // 8:30, 16:00
    if (!hm) hm = low().match(new RegExp(`\\b${HOURW}(?:\\s?y\\s?${minW})?\\s*(de la ma[ñn]ana|de la tarde|de la noche|de la madrugada|am|pm|hrs)\\b`, 'i')); // 4 pm, 4 y media de la tarde
    if (hm) {
      h = num(hm[1]); const mins = hm[2];
      m = mins == null ? 0 : mins === 'media' ? 30 : mins === 'cuarto' ? 15 : mins === 'cuarenta y cinco' ? 45 : num(mins) || 0;
      const menos = hm[3] && hm.length > 4 ? hm[3] : null; const sIdx = hm.length - 1; suf = (hm[sIdx] || '').toLowerCase();
      if (menos && /cuarto|diez|cinco|veinte/.test(menos)) { const sub = { cuarto: 15, diez: 10, cinco: 5, veinte: 20 }[menos]; h = (h + 23) % 24; m = 60 - sub; }
      hasSuffix = !!suf && suf !== 'en punto';
      if (/tarde|noche|pm/.test(suf) && h < 12) h += 12;
      if (/ma[ñn]ana|madrugada|am/.test(suf) && h === 12) h = 0;
      if (!hasSuffix && momentWord && /tarde|noche/.test(momentWord) && h < 12) h += 12;
      if (!hasSuffix && /hrs/.test(suf)) hasSuffix = true;
      cutStr(hm[0]);
    } else if (/\b(al |a )?mediod[ií]a\b/i.test(t)) { h = 12; m = 0; hasSuffix = true; cut(/\b(a )?(al )?mediod[ií]a\b/ig); }
    else if (/\bmedianoche\b/i.test(t)) { h = 23; m = 59; hasSuffix = true; cut(/\b(a )?(la )?medianoche\b/ig); }
    if (mom) cut(new RegExp('\\b(en la|por la|todas las|a la|de la|esta) ' + mom[1] + '\\b', 'i'));
    cut(/\bde la (ma[ñn]ana|tarde|noche)\b/ig);

    // Hora sin "am/pm": de 1 a 6 casi siempre es de la tarde; 7 a 11 de la mañana (salvo "tarde/noche").
    if (h != null && !hasSuffix && h >= 1 && h <= 11) {
      if (h <= 6) h += 12;
    }
    if (h != null) out.time = `${pad(h)}:${pad(m)}`;

    // ---- limpieza del título ----
    t = t.replace(/\b(recu[eé]rdame|recordarme|recordar|av[ií]same|acu[eé]rdame|ag[eé]ndame|agend(?:a|ar)|apunta(?:r)?|anota(?:r)?|agrega(?:r)?|pon(?:me|er)?(?: un)?(?: recordatorio| aviso)?(?: de| para| que)?|que tengo que|tengo que|tengo|hay que|que|de que)\b/ig, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^(\s*(el|la|los|las|a|de|del|en|para|y|es|,|\.)\s+)+/i, '')
      .replace(/(\s+(el|la|a|de|del|en|para|y|es|,))+\s*$/i, '')
      .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
    out.title = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';

    // ---- armar fecha final ----
    if (momentWord) out.moment = /ma[ñn]ana|madrugada/.test(momentWord) ? 'manana' : momentWord;
    if (out.rel != null && !date) { out.due = new Date(now.getTime() + out.rel * 60000); out.date = dkey(out.due); out.time = `${pad(out.due.getHours())}:${pad(out.due.getMinutes())}`; }
    else if (date) {
      out.date = dkey(date);
      if (out.time) { const [hh, mm] = out.time.split(':').map(Number); out.due = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm); }
    } else if (out.time && !out.recurring) {
      // Solo hora: la próxima vez que llegue esa hora (hoy o mañana).
      const [hh, mm] = out.time.split(':').map(Number); const d = new Date(now); d.setHours(hh, mm, 0, 0);
      if (d <= now) { if (!hasSuffix && hh < 12 && hh + 12 < 24 && new Date(d.getTime() + 12 * 3600e3) > now) d.setHours(hh + 12); else d.setDate(d.getDate() + 1); }
      out.due = d; out.date = dkey(d); out.time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    if (out.kind === 'birthday') {
      if (out.age && out.date) out.bornYear = +out.date.slice(0, 4) - out.age;
      out.title = out.title.replace(/^(cumplea[ñn]os|cumple)\s+(de\s+)?/i, 'Cumpleaños de ').replace(/^Cumpleaños de\s*$/, 'Cumpleaños');
    }
    if (out.kind === 'todo' && out.recurring) out.kind = 'habit';
    else if (out.kind === 'todo' && (out.date || out.time)) out.kind = 'reminder';
    return out;
  }

  // Formato amable de la interpretación, para mostrarla en pantalla.
  function describeParsed(p, now = new Date()) {
    const parts = [];
    if (p.date) {
      const d = new Date(p.date + 'T12:00:00'); const diff = Math.round((new Date(p.date + 'T12:00:00') - new Date(dkey(now) + 'T12:00:00')) / 864e5);
      parts.push(diff === 0 ? 'Hoy' : diff === 1 ? 'Mañana' : diff === 2 ? 'Pasado mañana' : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }));
    }
    if (p.time) { const [h, m] = p.time.split(':').map(Number); const d = new Date(); d.setHours(h, m); parts.push(d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })); }
    return parts.join(' · ');
  }

  const api = { parseSpeech, describeParsed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
