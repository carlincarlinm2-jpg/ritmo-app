// GET /api/vapid → llave pública para que el navegador se suscriba a notificaciones.
const { admin, getVapid, cors } = require('./_lib');
module.exports = async (req, res) => {
  if (cors(req, res)) return;
  try { const v = await getVapid(admin()); res.setHeader('Cache-Control', 'no-store'); res.status(200).json({ publicKey: v.publicKey }); }
  catch (e) { console.error(e); res.status(e.statusCode || 500).json({ error: e.statusCode ? e.message : 'Error interno' }); }
};
