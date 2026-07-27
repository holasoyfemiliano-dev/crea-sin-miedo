const SB_URL  = process.env.SB_URL;
const SB_KEY  = process.env.SB_SERVICE;
const CV_URL  = process.env.CV_SB_URL;
const CV_KEY  = process.env.CV_SB_SERVICE;
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

const ALLOWED_TABLES = [
  'csm_asistentes', 'csm_invitados', 'csm_staff',
  'csm_cronograma', 'csm_codigos_descuento', 'proximity_creators',
  'csm_registro_taller',
];

const CV_TABLES = ['miembros'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-key, Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const k = req.headers['x-admin-key'] || req.query.key;
  if (k !== ADMIN_KEY) { res.status(401).json({ error: 'No autorizado' }); return; }

  const table = req.query.table;

  // ── Clase Viral tables ──────────────────────────────────────────────────────
  if (CV_TABLES.includes(table)) {
    // PATCH: update asistencia_status on a miembro
    if (req.method === 'PATCH') {
      const { id, field, value } = req.body || {};
      if (!id || !field) { res.status(400).json({ error: 'Parámetros inválidos' }); return; }
      const r = await fetch(`${CV_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: CV_KEY, Authorization: `Bearer ${CV_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ [field]: value }),
      });
      res.status(r.ok ? 200 : 500).json({ ok: r.ok });
      return;
    }
    // GET
    const qs = req.query.qs || 'select=*&order=fecha_ingreso.desc';
    const r = await fetch(`${CV_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: CV_KEY, Authorization: `Bearer ${CV_KEY}` },
    });
    res.json(await r.json());
    return;
  }

  // ── CSM tables ──────────────────────────────────────────────────────────────
  if (!ALLOWED_TABLES.includes(table)) {
    res.status(400).json({ error: 'Tabla no permitida' }); return;
  }

  const queryMap = {
    csm_asistentes: 'select=*&order=fecha_registro.desc',
    csm_invitados:  'select=*&order=nombre',
    csm_staff:      'select=*&order=horario_entrada',
    csm_cronograma: 'select=*&order=hora',
    csm_codigos_descuento: 'select=*&order=created_at.desc',
    proximity_creators: 'select=*&order=nombre',
    csm_registro_taller: 'select=*&order=fecha_registro.desc',
  };

  // POST: insert a new row (supported tables)
  const POSTABLE = ['csm_codigos_descuento', 'csm_asistentes', 'csm_invitados'];
  if (req.method === 'POST' && POSTABLE.includes(table)) {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.ok ? 201 : 500).json(data);
    return;
  }

  // PATCH: update a field on a row
  if (req.method === 'PATCH') {
    const { id, field, value } = req.body || {};
    const PATCHABLE = ['asistencia_status', 'check_in', 'notas', 'activo'];
    if (!id || !field || !PATCHABLE.includes(field)) {
      res.status(400).json({ error: 'Parámetros inválidos' }); return;
    }
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ [field]: value }),
    });
    res.status(r.ok ? 200 : 500).json({ ok: r.ok });
    return;
  }

  // DELETE: remove a row by id
  if (req.method === 'DELETE') {
    const { id } = req.body || req.query;
    if (!id) { res.status(400).json({ error: 'id requerido' }); return; }
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' },
    });
    res.status(r.ok ? 200 : 500).json({ ok: r.ok });
    return;
  }

  // GET
  const qs = req.query.qs || queryMap[table] || 'select=*';
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  res.json(await r.json());
};
