const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  if (!SB_URL || !SB_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  const { nombre, email, telefono, ocupacion } = req.body || {};
  const cleanNombre = (nombre || '').trim();
  const cleanEmail  = (email || '').trim().toLowerCase();

  if (!cleanNombre) { res.status(400).json({ error: 'Nombre requerido' }); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { res.status(400).json({ error: 'Email inválido' }); return; }

  try {
    const r = await fetch(`${SB_URL}/rest/v1/csm_registro_taller?on_conflict=email`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        nombre: cleanNombre,
        email: cleanEmail,
        telefono: (telefono || '').trim() || null,
        ocupacion: (ocupacion || '').trim() || null,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      res.status(502).json({ error: 'No se pudo guardar el registro', detail: err });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
