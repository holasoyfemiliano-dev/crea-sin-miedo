const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  const { code, tier } = req.query;
  if (!code) { res.status(400).json({ valid: false, error: 'Código requerido' }); return; }

  const r = await fetch(
    `${SB_URL}/rest/v1/csm_codigos_descuento?codigo=eq.${encodeURIComponent(code.toUpperCase())}&activo=eq.true&select=*`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const rows = await r.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    res.json({ valid: false, error: 'Código inválido o expirado' }); return;
  }

  const c = rows[0];
  if (c.tier !== 'all' && c.tier !== tier) {
    res.json({ valid: false, error: 'Código no aplica para este boleto' }); return;
  }
  if (c.usos_max && c.usos >= c.usos_max) {
    res.json({ valid: false, error: 'Código agotado' }); return;
  }

  res.json({ valid: true, tipo: c.tipo, descuento: c.descuento });
};
