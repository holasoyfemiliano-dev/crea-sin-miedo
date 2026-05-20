const { sendTicket } = require('./_ticket');
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

module.exports = async function handler(req, res) {
  if ((req.headers['x-admin-key'] || req.query.key) !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    await sendTicket({
      nombre: req.query.nombre || 'Femiliano',
      email: req.query.email || 'brandproximity@gmail.com',
      telefono: req.query.telefono || '+523312345678',
      tier: req.query.tier || 'vip',
      paymentId: 'TEST-' + Date.now(),
    });
    res.json({ ok: true, msg: 'Email de prueba enviado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
