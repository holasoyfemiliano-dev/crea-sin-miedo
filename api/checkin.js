const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE;
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

function auth(req) {
  const k = req.headers['x-admin-key'] || req.query.key;
  return k === ADMIN_KEY;
}

module.exports = async function handler(req, res) {
  if (!auth(req)) { res.status(401).json({ error: 'No autorizado' }); return; }

  // GET: lookup by QR value, payment_id, or email
  if (req.method === 'GET') {
    const q = req.query.q || '';
    if (!q) { res.status(400).json({ error: 'Parámetro q requerido' }); return; }

    // Strip CSM- prefix if present
    const clean = q.replace(/^CSM-/i, '');

    // Try payment_id first, then email, then nombre
    const byId = await sbFetch(`csm_asistentes?mp_payment_id=eq.${encodeURIComponent(clean)}&select=*`);
    if (Array.isArray(byId) && byId.length > 0) { res.json(byId[0]); return; }

    const byEmail = await sbFetch(`csm_asistentes?email=ilike.${encodeURIComponent(clean)}&pagado=eq.true&select=*`);
    if (Array.isArray(byEmail) && byEmail.length > 0) { res.json(byEmail[0]); return; }

    // Search invitados too
    const invitado = await sbFetch(`csm_invitados?email=ilike.${encodeURIComponent(clean)}&select=*`);
    if (Array.isArray(invitado) && invitado.length > 0) { res.json({ ...invitado[0], es_invitado: true }); return; }

    res.status(404).json({ error: 'Asistente no encontrado' }); return;
  }

  // POST: search by nombre (partial match)
  if (req.method === 'POST' && req.body?.action === 'search') {
    const q = (req.body.q || '').trim();
    if (!q) { res.json([]); return; }
    const rows = await sbFetch(`csm_asistentes?nombre=ilike.*${encodeURIComponent(q)}*&pagado=eq.true&order=nombre&select=*&limit=20`);
    res.json(Array.isArray(rows) ? rows : []);
    return;
  }

  // PATCH: mark check-in
  if (req.method === 'PATCH') {
    const { id, es_invitado } = req.body || {};
    if (!id) { res.status(400).json({ error: 'ID requerido' }); return; }

    const table = es_invitado ? 'csm_invitados' : 'csm_asistentes';
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=representation',
      },
      body: JSON.stringify({ check_in: true, check_in_at: new Date().toISOString() }),
    });
    const data = await r.json();
    res.json(Array.isArray(data) ? data[0] : data);
    return;
  }

  res.status(405).end();
};

async function sbFetch(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return r.json();
}
