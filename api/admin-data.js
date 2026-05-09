const SB_URL  = process.env.SB_URL;
const SB_KEY  = process.env.SB_SERVICE;
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

const ALLOWED_TABLES = [
  'csm_asistentes', 'csm_invitados', 'csm_staff',
  'csm_cronograma', 'csm_codigos_descuento',
];

module.exports = async function handler(req, res) {
  const k = req.headers['x-admin-key'] || req.query.key;
  if (k !== ADMIN_KEY) { res.status(401).json({ error: 'No autorizado' }); return; }

  const table = req.query.table;
  if (!ALLOWED_TABLES.includes(table)) {
    res.status(400).json({ error: 'Tabla no permitida' }); return;
  }

  const queryMap = {
    csm_asistentes: 'select=*&order=fecha_registro.desc',
    csm_invitados:  'select=*&order=nombre',
    csm_staff:      'select=*&order=horario_entrada',
    csm_cronograma: 'select=*&order=hora',
    csm_codigos_descuento: 'select=*&order=created_at.desc',
  };

  const qs = req.query.qs || queryMap[table] || 'select=*';

  const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  const data = await r.json();
  res.json(data);
};
