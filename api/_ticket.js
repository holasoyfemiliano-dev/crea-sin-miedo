const GHL_KEY = process.env.GHL_API_KEY;
const LOC_ID  = process.env.GHL_LOCATION_ID;
const BASE    = process.env.BASE_URL || 'https://creasinmiedo.com.mx';

const TIER_NAMES = { general: 'General', vip: 'VIP', full: 'Full Experience' };

async function sendTicket({ nombre, email, telefono, tier, paymentId }) {
  if (!GHL_KEY || !LOC_ID) return;

  const pid      = String(paymentId);
  const tierName = TIER_NAMES[tier] || 'General';
  const qrData   = `CSM-${pid}`;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
  const boletoUrl = `${BASE}/gracias?status=approved&tier=${tier}&payment_id=${encodeURIComponent(pid)}`;

  const parts     = (nombre || '').trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName  = parts.slice(1).join(' ') || '';

  // 1. Create / update GHL contact
  const createRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + GHL_KEY,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: JSON.stringify({
      locationId: LOC_ID,
      email,
      phone: telefono || undefined,
      firstName,
      lastName,
      tags: ['crea-sin-miedo', `csm-${tier}`],
      source: 'crea-sin-miedo-checkout',
      customFields: [
        { key: 'csm_tier',        field_value: tierName },
        { key: 'csm_payment_id',  field_value: pid },
        { key: 'csm_qr_url',      field_value: qrUrl },
        { key: 'csm_boleto_url',  field_value: boletoUrl },
        { key: 'csm_evento',      field_value: 'Sábado 1 de Agosto 2026 · Guadalajara' },
      ],
    }),
  });
  const contact = await createRes.json();
  const contactId = contact?.contact?.id || contact?.id;
  if (!contactId) return;

  // 2. Send ticket email via GHL
  const html = buildEmailHTML({ nombre, tierName, pid, qrUrl, boletoUrl });
  await fetch('https://services.leadconnectorhq.com/conversations/messages', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + GHL_KEY,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: JSON.stringify({
      type: 'Email',
      contactId,
      subject: `🎟️ Tu boleto para Crea sin Miedo — ${tierName}`,
      html,
      emailFrom: 'Femiliano <brandproximity@gmail.com>',
      emailReplyTo: 'brandproximity@gmail.com',
    }),
  });
}

function buildEmailHTML({ nombre, tierName, pid, qrUrl, boletoUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu boleto — Crea sin Miedo</title></head>
<body style="margin:0;padding:0;background:#06090f;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:40px 24px;">

  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:2.5rem;font-weight:900;letter-spacing:2px;color:#ffffff;">CREA <span style="color:#e5272b">SIN</span> MIEDO</div>
    <div style="font-size:.85rem;color:#6a7590;margin-top:6px;">Taller presencial de marca personal</div>
  </div>

  <div style="background:rgba(34,197,94,.08);border:1.5px solid rgba(34,197,94,.3);border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
    <div style="font-size:2rem;margin-bottom:8px;">✓</div>
    <div style="font-size:1.3rem;font-weight:800;color:#ffffff;margin-bottom:4px;">¡Tu lugar está confirmado, ${nombre}!</div>
    <div style="font-size:.85rem;color:#c8cfe0;">Boleto: <strong style="color:#e5272b">${tierName}</strong></div>
  </div>

  <div style="background:rgba(255,255,255,.04);border:1.5px solid rgba(229,39,43,.3);border-radius:16px;padding:28px;margin-bottom:24px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;">
      <div>
        <div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#6a7590;margin-bottom:4px;">Evento</div>
        <div style="font-size:1.1rem;font-weight:800;color:#ffffff;">Crea sin Miedo</div>
        <div style="margin-top:12px;">
          <div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#6a7590;margin-bottom:2px;">Fecha</div>
          <div style="font-size:.9rem;color:#ffffff;font-weight:600;">Sábado 1 de Agosto, 2026</div>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#6a7590;margin-bottom:2px;">Lugar</div>
          <div style="font-size:.9rem;color:#ffffff;font-weight:600;">Guadalajara, Jalisco</div>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#6a7590;margin-bottom:2px;">Tipo de boleto</div>
          <div style="display:inline-block;background:#e5272b;color:#fff;border-radius:20px;padding:3px 14px;font-size:.75rem;font-weight:800;text-transform:uppercase;">${tierName}</div>
        </div>
        <div style="margin-top:10px;">
          <div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#6a7590;margin-bottom:2px;">ID de entrada</div>
          <div style="font-size:.78rem;color:#6a7590;font-family:monospace;">${pid}</div>
        </div>
      </div>
      <div style="text-align:center;">
        <img src="${qrUrl}" alt="QR de entrada" width="130" height="130" style="border-radius:10px;background:#fff;padding:6px;display:block;">
        <div style="font-size:.62rem;color:#6a7590;margin-top:6px;font-family:monospace;">CSM-${pid}</div>
      </div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,.07);margin-top:20px;padding-top:14px;text-align:center;font-size:.75rem;color:#6a7590;">
      Muestra este QR en la entrada el día del evento · No es transferible
    </div>
  </div>

  <div style="display:grid;gap:12px;margin-bottom:24px;">
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;">
      <div style="font-weight:700;color:#ffffff;margin-bottom:4px;">📱 Guarda tu QR</div>
      <div style="font-size:.82rem;color:#c8cfe0;">Toma screenshot de este correo. Escanearemos el QR en la entrada el 1 de agosto.</div>
    </div>
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;">
      <div style="font-weight:700;color:#ffffff;margin-bottom:4px;">🕘 Horario</div>
      <div style="font-size:.82rem;color:#c8cfe0;">Registro: 8:30 AM · Inicio: 9:00 AM · Full day hasta ~7 PM</div>
    </div>
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px;">
      <div style="font-weight:700;color:#ffffff;margin-bottom:4px;">📍 Venue</div>
      <div style="font-size:.82rem;color:#c8cfe0;">Guadalajara, Jalisco · Dirección exacta próximamente por email y WhatsApp.</div>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:32px;">
    <a href="${boletoUrl}" style="display:inline-block;background:#e5272b;color:#fff;text-decoration:none;border-radius:10px;padding:16px 32px;font-weight:900;font-size:.95rem;letter-spacing:.06em;text-transform:uppercase;">Ver mi boleto online →</a>
  </div>

  <div style="text-align:center;font-size:.72rem;color:#6a7590;line-height:1.7;border-top:1px solid rgba(255,255,255,.06);padding-top:20px;">
    Crea sin Miedo · Guadalajara 2026<br>
    ¿Preguntas? Escríbenos a brandproximity@gmail.com
  </div>

</div>
</body>
</html>`;
}

module.exports = { sendTicket };
