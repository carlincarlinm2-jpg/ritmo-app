// POST /api/test-push  (Authorization: Bearer <token de sesión>) → manda una notificación de prueba.
const { admin, getVapid, pushToUser, cors, APP_URL } = require('./_lib');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const sb = admin();
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const { data: u, error } = await sb.auth.getUser(token);
    if (error || !u?.user) { res.status(401).json({ error: 'Sesión no válida' }); return; }
    await getVapid(sb);
    const app = (req.body && req.body.app) === 'nutri' ? 'nutri' : 'ritmo';
    const { data: subs } = await sb.from('rt_push_subs').select('*').eq('user_id', u.user.id).eq('app', app);
    if (!subs?.length) { res.status(400).json({ error: 'Este dispositivo todavía no tiene notificaciones activadas.' }); return; }
    const sent = await pushToUser(sb, subs, app === 'nutri' ? { title: '¡Listo! 🥦', body: 'Así te van a llegar tus recordatorios de Nutri.', tag: 'test', url: APP_URL.nutri + '/' } : { title: '¡Listo! 🎉', body: 'Así te van a llegar tus recordatorios de Ritmo.', tag: 'test', url: '/' });
    res.status(200).json({ ok: true, sent });
  } catch (e) { console.error(e); res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : 'Error interno' }); }
};
