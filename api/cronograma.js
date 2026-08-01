/**
 * /api/cronograma
 * GET   ?slug=xxx            → público, solo items tipo publico/break (lo que ve el asistente)
 * GET   ?slug=xxx&all=1      → requiere x-admin-key, todos los tipos (producción + admin)
 * POST  { evento_id, hora, actividad, ... }        → crea item (admin)
 * PATCH { id, ...campos }                          → edita/toggle completado (admin)
 * DELETE { id }                                    → borra item (admin)
 */
const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE;
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

function auth(req) {
  return (req.headers['x-admin-key'] || req.query.key) === ADMIN_KEY;
}

async function resolveEventoId(slug) {
  const qs = slug === 'next'
    ? `estado=neq.finalizado&order=fecha.asc&limit=1&select=id`
    : `slug=eq.${encodeURIComponent(slug)}&select=id`;
  const r = await fetch(`${SB_URL}/rest/v1/csm_eventos?${qs}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  const rows = await r.json();
  return rows[0]?.id || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-key, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !SB_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    if (req.method === 'GET') {
      const { slug, all } = req.query;
      if (!slug) { res.status(400).json({ error: 'slug requerido' }); return; }

      if (all && !auth(req)) { res.status(401).json({ error: 'No autorizado' }); return; }

      const eventoId = await resolveEventoId(slug);
      if (!eventoId) { res.status(404).json({ error: 'Evento no encontrado' }); return; }

      const tipoFilter = all ? '' : `&tipo=in.(publico,break)`;
      const r = await fetch(
        `${SB_URL}/rest/v1/csm_cronograma?evento_id=eq.${eventoId}&order=orden.asc${tipoFilter}&select=*`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      );
      res.json(await r.json());
      return;
    }

    if (!auth(req)) { res.status(401).json({ error: 'No autorizado' }); return; }

    if (req.method === 'POST') {
      const { evento_id, hora, actividad, responsable, lugar, notas, tipo, orden } = req.body || {};
      if (!evento_id || !actividad) { res.status(400).json({ error: 'evento_id y actividad requeridos' }); return; }

      const r = await fetch(`${SB_URL}/rest/v1/csm_cronograma`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify({
          evento_id, hora: hora || null, actividad,
          responsable: responsable || null, lugar: lugar || null, notas: notas || null,
          tipo: tipo || 'publico', orden: orden || 0, completado: false,
        }),
      });
      const data = await r.json();
      res.status(r.ok ? 201 : 500).json(data);
      return;
    }

    if (req.method === 'PATCH') {
      const { id, ...patch } = req.body || {};
      if (!id) { res.status(400).json({ error: 'id requerido' }); return; }

      const r = await fetch(`${SB_URL}/rest/v1/csm_cronograma?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(patch),
      });
      const data = await r.json();
      res.status(r.ok ? 200 : 500).json(data);
      return;
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) { res.status(400).json({ error: 'id requerido' }); return; }
      const r = await fetch(`${SB_URL}/rest/v1/csm_cronograma?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: 'return=minimal' },
      });
      res.status(r.ok ? 200 : 500).json({ ok: r.ok });
      return;
    }

    res.status(405).end();
  } catch (e) {
    console.error('cronograma error:', e);
    res.status(500).json({ error: e.message });
  }
};
