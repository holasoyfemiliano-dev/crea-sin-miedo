const { MercadoPagoConfig, Payment } = require('mercadopago');
const { sendTicket } = require('./_ticket');

const SB_URL = process.env.SB_URL;
const SB_KEY = process.env.SB_SERVICE;

const AMOUNTS = { general: 2999, vip: 5000, full: 9997 };

module.exports = async function handler(req, res) {
  if (req.method === 'GET') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const { type, data, action } = req.body || {};
  const eventType = type || action;

  if (eventType !== 'payment' && !data?.id) {
    res.status(200).end(); return;
  }

  const paymentId = data?.id;
  if (!paymentId) { res.status(200).end(); return; }

  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentApi = new Payment(client);
    const payment = await paymentApi.get({ id: paymentId });

    if (payment.status !== 'approved') {
      res.status(200).end(); return;
    }

    // Dedup check
    const existing = await sbFetch(`csm_asistentes?mp_payment_id=eq.${paymentId}&select=id`);
    if (Array.isArray(existing) && existing.length > 0) {
      res.status(200).end(); return;
    }

    const meta = payment.metadata || {};
    const tier     = meta.tier || 'general';
    const nombre   = meta.nombre || payment.payer?.first_name || 'Asistente';
    const email    = meta.email  || payment.payer?.email || '';
    const telefono = meta.telefono || payment.payer?.phone?.number || '';
    const monto    = payment.transaction_amount || AMOUNTS[tier] || 0;
    const pid      = String(paymentId);

    // 1. Save to Supabase
    await sbPost('csm_asistentes', {
      tipo: tier, nombre, email, telefono, monto,
      mp_payment_id: pid,
      mp_preference_id: payment.preference_id || null,
      pagado: true,
    });

    // 2. Create / update contact in GHL + send ticket email
    await sendTicket({ nombre, email, telefono, tier, paymentId: pid });

    res.status(200).end();
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ——— Supabase helpers ———
async function sbFetch(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return r.json();
}

async function sbPost(table, data) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`Supabase insert failed: ${await r.text()}`);
}
