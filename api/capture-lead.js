const GHL_KEY = process.env.GHL_API_KEY;
const LOC_ID  = process.env.GHL_LOCATION_ID;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!GHL_KEY || !LOC_ID) { res.status(500).end(); return; }

  const { nombre, email, telefono, tier } = req.body || {};
  if (!email) { res.status(400).json({ error: 'email required' }); return; }

  const parts = (nombre || '').trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ') || '';

  const TIER_NAMES = { general: 'General', vip: 'VIP', full: 'Full Experience' };

  const body = {
    locationId: LOC_ID,
    email,
    phone: telefono || undefined,
    firstName,
    lastName,
    tags: ['crea-sin-miedo', 'csm-interes', tier ? `csm-interes-${tier}` : 'csm-interes'].filter(Boolean),
    source: 'crea-sin-miedo-checkout-abandono',
    customFields: [
      { key: 'csm_tier_interes', field_value: TIER_NAMES[tier] || tier || '' },
      { key: 'csm_evento',       field_value: 'Sábado 1 de Agosto 2026 · Guadalajara' },
    ],
  };

  try {
    const r = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + GHL_KEY,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : 400).json({ ok: r.ok, id: data?.contact?.id });
  } catch(e) {
    res.status(502).json({ error: e.message });
  }
};
