const { MercadoPagoConfig, Preference } = require('mercadopago');

const TIERS = {
  general: { title: 'Entrada General — Crea sin Miedo', price: 2999 },
  vip:     { title: 'Entrada VIP — Crea sin Miedo',     price: 5000 },
  full:    { title: 'Full Experience — Crea sin Miedo', price: 9997 },
};

const SB_URL  = process.env.SUPABASE_URL;
const SB_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BASE    = process.env.BASE_URL || 'https://crea-sin-miedo.vercel.app';

async function sbGet(table, query) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return r.json();
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { tier, nombre, email, telefono, codigo } = req.body || {};

  if (!TIERS[tier]) { res.status(400).json({ error: 'Tier inválido' }); return; }
  if (!nombre || !email || !telefono) { res.status(400).json({ error: 'Faltan datos requeridos' }); return; }

  const tierInfo = TIERS[tier];
  let precio = tierInfo.price;
  let descuentoAplicado = 0;
  let codigoValido = null;

  // Validate coupon if provided
  if (codigo) {
    const coupons = await sbGet('csm_codigos_descuento',
      `codigo=eq.${encodeURIComponent(codigo.toUpperCase())}&activo=eq.true&select=*`);
    if (Array.isArray(coupons) && coupons.length > 0) {
      const c = coupons[0];
      const tierOk = c.tier === 'all' || c.tier === tier;
      const usosOk = !c.usos_max || c.usos < c.usos_max;
      if (tierOk && usosOk) {
        if (c.tipo === 'gratis') {
          descuentoAplicado = precio;
          precio = 0;
        } else if (c.tipo === 'porcentaje') {
          descuentoAplicado = Math.round(precio * c.descuento / 100);
          precio = precio - descuentoAplicado;
        }
        codigoValido = c.id;
      }
    }
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preference = new Preference(client);

  const body = {
    items: [{
      title: tierInfo.title,
      quantity: 1,
      unit_price: precio,
      currency_id: 'MXN',
    }],
    payer: { name: nombre, email, phone: { number: telefono } },
    back_urls: {
      success: `${BASE}/gracias?tier=${tier}`,
      failure: `${BASE}/checkout?tier=${tier}&error=1`,
      pending: `${BASE}/gracias?pending=1&tier=${tier}`,
    },
    auto_return: 'approved',
    notification_url: `${BASE}/api/webhook`,
    metadata: {
      tier, nombre, email, telefono,
      monto_original: TIERS[tier].price,
      descuento: descuentoAplicado,
      codigo_id: codigoValido,
    },
    statement_descriptor: 'CREA SIN MIEDO',
  };

  // If free ticket (100% discount), skip MercadoPago and register directly
  if (precio === 0) {
    await registrarAsistente({ tier, nombre, email, telefono, monto: 0, mp_payment_id: 'FREE-' + Date.now(), codigo_id: codigoValido });
    if (codigoValido) await incrementarUsos(codigoValido);
    res.json({ init_point: `${BASE}/gracias?status=approved&tier=${tier}&payment_id=FREE` });
    return;
  }

  const result = await preference.create({ body });
  res.json({ init_point: result.init_point });
};

async function registrarAsistente({ tier, nombre, email, telefono, monto, mp_payment_id, mp_preference_id, codigo_id }) {
  await fetch(`${SB_URL}/rest/v1/csm_asistentes`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ tipo: tier, nombre, email, telefono, monto, mp_payment_id, mp_preference_id, pagado: true }),
  });
  if (codigo_id) await incrementarUsos(codigo_id);
}

async function incrementarUsos(codigoId) {
  await fetch(`${SB_URL}/rest/v1/csm_codigos_descuento?id=eq.${codigoId}`, {
    method: 'PATCH',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ usos: 999 }), // simple increment placeholder — use RPC in production
  });
}
