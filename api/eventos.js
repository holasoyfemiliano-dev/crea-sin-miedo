/**
 * /api/eventos
 * GET   ?slug=xxx  → un evento por slug (público, sin auth)
 * GET   (sin slug)  → lista de eventos, requiere x-admin-key
 * POST  { slug?, ciudad, fecha, venue?, direccion?, maps_url?, capacidad?, estado? }
 *       → crea una edición (admin). Si no viene slug, se genera de ciudad+fecha.
 * PATCH { id, ...campos } → actualiza una edición (admin)
 */
const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE;
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

function auth(req) {
  return (req.headers['x-admin-key'] || req.query.key) === ADMIN_KEY;
}

function slugify(ciudad, fecha) {
  const base = (ciudad || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const ym = (fecha || '').slice(0, 7).replace('-', '');
  return `${base}-${ym}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-admin-key, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!SB_URL || !SB_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    if (req.method === 'GET') {
      const { slug } = req.query;

      if (slug) {
        // Público: buscar por slug exacto, o 'next' para el próximo evento no finalizado
        const qs = slug === 'next'
          ? `estado=neq.finalizado&order=fecha.asc&limit=1&select=*`
          : `slug=eq.${encodeURIComponent(slug)}&select=*`;
        const r = await fetch(`${SB_URL}/rest/v1/csm_eventos?${qs}`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
        });
        const rows = await r.json();
        if (!rows.length) { res.status(404).json({ error: 'Evento no encontrado' }); return; }
        res.json(rows[0]);
        return;
      }

      // Lista completa: requiere admin
      if (!auth(req)) { res.status(401).json({ error: 'No autorizado' }); return; }
      const r = await fetch(`${SB_URL}/rest/v1/csm_eventos?select=*&order=fecha.asc`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      });
      res.json(await r.json());
      return;
    }

    if (!auth(req)) { res.status(401).json({ error: 'No autorizado' }); return; }

    if (req.method === 'POST') {
      const { slug, ciudad, fecha, venue, direccion, maps_url, capacidad, estado, notas_produccion } = req.body || {};
      if (!ciudad || !fecha) { res.status(400).json({ error: 'ciudad y fecha requeridos' }); return; }

      const row = {
        slug: (slug || '').trim() || slugify(ciudad, fecha),
        ciudad: ciudad.trim(),
        fecha,
        venue: venue || null,
        direccion: direccion || null,
        maps_url: maps_url || null,
        capacidad: capacidad || 80,
        estado: estado || 'proximo',
        notas_produccion: notas_produccion || null,
      };

      const r = await fetch(`${SB_URL}/rest/v1/csm_eventos`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=representation',
        },
        body: JSON.stringify(row),
      });
      const data = await r.json();
      res.status(r.ok ? 201 : 500).json(data);
      return;
    }

    if (req.method === 'PATCH') {
      const { id, ...patch } = req.body || {};
      if (!id) { res.status(400).json({ error: 'id requerido' }); return; }
      delete patch.slug; // el slug no se cambia una vez creado (rompería links compartidos)

      const r = await fetch(`${SB_URL}/rest/v1/csm_eventos?id=eq.${id}`, {
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

    res.status(405).end();
  } catch (e) {
    console.error('eventos error:', e);
    res.status(500).json({ error: e.message });
  }
};
