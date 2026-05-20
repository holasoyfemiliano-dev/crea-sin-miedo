const GHL_KEY = process.env.GHL_API_KEY;
const LOC_ID  = process.env.GHL_LOCATION_ID;
const BASE    = process.env.BASE_URL || 'https://creasinmiedo.com.mx';
const ADMIN_KEY = process.env.ADMIN_KEY || 'CSM2026';

module.exports = async function handler(req, res) {
  if ((req.headers['x-admin-key'] || req.query.key) !== ADMIN_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const nombre = req.query.nombre || 'Femiliano';
  const email  = req.query.email  || 'brandproximity@gmail.com';
  const tier   = req.query.tier   || 'vip';
  const pid    = 'TEST-' + Date.now();
  const debug  = {};

  debug.env = { GHL_KEY: !!GHL_KEY, LOC_ID: !!LOC_ID, BASE };

  try {
    // Step 1: create contact
    const parts = nombre.trim().split(/\s+/);
    const contactBody = {
      locationId: LOC_ID,
      email,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      tags: ['crea-sin-miedo', `csm-${tier}`],
    };
    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + GHL_KEY, 'Content-Type': 'application/json', Version: '2021-07-28' },
      body: JSON.stringify(contactBody),
    });
    const contactData = await contactRes.json();
    debug.contactStatus = contactRes.status;
    debug.contactData = contactData;

    const contactId = contactData?.contact?.id || contactData?.id;
    if (!contactId) {
      return res.json({ ok: false, debug, error: 'No contactId returned' });
    }
    debug.contactId = contactId;

    // Step 2: send email
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('CSM-' + pid)}`;
    const emailRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + GHL_KEY, 'Content-Type': 'application/json', Version: '2021-07-28' },
      body: JSON.stringify({
        type: 'Email',
        contactId,
        subject: `🎟️ Tu boleto para Crea sin Miedo — TEST`,
        html: `<p>Hola ${nombre}, este es un correo de prueba del sistema de boletos. QR: <img src="${qrUrl}" width="150"></p>`,
        emailFrom: 'Femiliano <brandproximity@gmail.com>',
        emailReplyTo: 'brandproximity@gmail.com',
      }),
    });
    const emailData = await emailRes.json();
    debug.emailStatus = emailRes.status;
    debug.emailData = emailData;

    res.json({ ok: emailRes.ok, debug });
  } catch (e) {
    res.status(500).json({ error: e.message, debug });
  }
};
