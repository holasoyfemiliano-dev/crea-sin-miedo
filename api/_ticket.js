const GHL_KEY = process.env.GHL_API_KEY;
const LOC_ID  = process.env.GHL_LOCATION_ID;
const BASE    = process.env.BASE_URL || 'https://creasinmiedo.com.mx';

const TIER_NAMES = { general: 'General', vip: 'VIP', full: 'Full Experience', practico: 'Taller Práctico' };

function fmtFechaLarga(iso) {
  if (!iso) return null;
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());
}

async function sendTicket({ nombre, email, telefono, tier, paymentId, evento }) {
  if (!GHL_KEY || !LOC_ID) return;

  const pid      = String(paymentId);
  const tierName = TIER_NAMES[tier] || 'General';
  const qrData   = `${BASE}/gracias?status=approved&tier=${tier}&payment_id=${encodeURIComponent(pid)}`;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}&bgcolor=ffffff&color=000000&margin=8`;
  const boletoUrl = `${BASE}/gracias?status=approved&tier=${tier}&payment_id=${encodeURIComponent(pid)}`;

  const fechaText = evento ? (fmtFechaLarga(evento.fecha) || 'Próximamente') : 'Sábado 1 de Agosto, 2026';
  const lugarText = evento ? evento.ciudad : 'Guadalajara, Jalisco';
  const venueText = evento ? [evento.venue, evento.direccion].filter(Boolean).join(' — ') : null;
  const eventoTag = evento ? `${fechaText} · ${evento.ciudad}` : 'Sábado 1 de Agosto 2026 · Guadalajara';

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
        { key: 'csm_evento',      field_value: eventoTag },
      ],
    }),
  });
  const contact = await createRes.json();
  const contactId = contact?.contact?.id || contact?.id || contact?.meta?.contactId;
  if (!contactId) return;

  // 2. Send ticket email via GHL
  const html = buildEmailHTML({ nombre, tierName, pid, qrUrl, boletoUrl, fechaText, lugarText, venueText });
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

function buildEmailHTML({ nombre, tierName, pid, qrUrl, boletoUrl, fechaText, lugarText, venueText }) {
  const shortId = pid.replace('FREE-','').replace('TEST-','').slice(-8).toUpperCase();
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu boleto — Crea sin Miedo</title></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Arial,sans-serif;">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

  <!-- HEADER LOGO -->
  <tr><td align="center" style="padding-bottom:32px;">
    <div style="font-size:28px;font-weight:900;letter-spacing:6px;color:#ffffff;text-transform:uppercase;">CREA <span style="color:#e5272b">SIN</span> MIEDO</div>
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin-top:6px;">Taller presencial · ${lugarText}</div>
  </td></tr>

  <!-- CONFIRMED BANNER -->
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="background:#0f2a18;border:1px solid #1a5c2e;border-radius:12px;padding:20px 24px;text-align:center;">
      <div style="font-size:22px;color:#22c55e;font-weight:900;margin-bottom:4px;">✓ &nbsp;¡Tu lugar está confirmado!</div>
      <div style="font-size:14px;color:#aaa;">Hola <strong style="color:#fff">${nombre}</strong> — aquí está tu entrada para el evento</div>
    </td></tr>
    </table>
  </td></tr>

  <!-- TICKET CARD -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">

      <!-- Ticket top red stripe -->
      <tr><td style="background:linear-gradient(90deg,#e5272b,#c01e21);height:5px;font-size:0;">&nbsp;</td></tr>

      <!-- Ticket header -->
      <tr><td style="padding:24px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#555;margin-bottom:4px;">Evento</div>
            <div style="font-size:22px;font-weight:900;letter-spacing:2px;color:#fff;text-transform:uppercase;">Crea Sin Miedo</div>
          </td>
          <td align="right">
            <div style="display:inline-block;background:#e5272b;color:#fff;font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:6px 16px;border-radius:20px;">${tierName}</div>
          </td>
        </tr>
        </table>
      </td></tr>

      <!-- Divider dashed -->
      <tr><td style="padding:16px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px dashed #2a2a2a;font-size:0;">&nbsp;</td></tr>
        </table>
      </td></tr>

      <!-- Ticket body: info + QR -->
      <tr><td style="padding:0 28px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr valign="top">
          <td style="width:60%;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr><td style="padding-bottom:16px;">
                <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:4px;">Titular</div>
                <div style="font-size:16px;font-weight:700;color:#fff;">${nombre}</div>
              </td></tr>
              <tr><td style="padding-bottom:16px;">
                <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:4px;">Fecha</div>
                <div style="font-size:14px;font-weight:600;color:#fff;">${fechaText}</div>
              </td></tr>
              <tr><td>
                <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:4px;">Lugar</div>
                <div style="font-size:14px;font-weight:600;color:#fff;">${lugarText}</div>
                <div style="font-size:12px;color:#666;margin-top:2px;">${venueText || 'Dirección exacta próximamente'}</div>
              </td></tr>
            </table>
          </td>
          <td style="width:40%;text-align:center;padding-left:16px;">
            <div style="background:#fff;border-radius:12px;padding:10px;display:inline-block;">
              <img src="${qrUrl}" alt="QR de entrada" width="140" height="140" style="display:block;">
            </div>
            <div style="font-size:10px;color:#555;margin-top:8px;font-family:monospace;letter-spacing:1px;">#${shortId}</div>
            <div style="font-size:10px;color:#444;margin-top:2px;">Escanea en la entrada</div>
          </td>
        </tr>
        </table>
      </td></tr>

      <!-- Ticket footer -->
      <tr><td style="background:#0f0f0f;border-top:1px dashed #2a2a2a;padding:14px 28px;text-align:center;">
        <div style="font-size:11px;color:#555;letter-spacing:1px;">Entrada personal e intransferible · No reembolsable</div>
      </td></tr>

    </table>
  </td></tr>

  <!-- INFO CARDS -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="width:50%;padding-right:8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #222;border-radius:12px;">
        <tr><td style="padding:18px 20px;">
          <div style="font-size:18px;margin-bottom:8px;">📱</div>
          <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;">Guarda tu QR</div>
          <div style="font-size:12px;color:#777;line-height:1.6;">Toma screenshot de este correo. Lo escaneamos en la entrada.</div>
        </td></tr>
        </table>
      </td>
      <td style="width:50%;padding-left:8px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #222;border-radius:12px;">
        <tr><td style="padding:18px 20px;">
          <div style="font-size:18px;margin-bottom:8px;">🔗</div>
          <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;">Boleto digital</div>
          <div style="font-size:12px;color:#777;line-height:1.6;">También puedes acceder a tu boleto online en cualquier momento.</div>
        </td></tr>
        </table>
      </td>
    </tr>
    </table>
  </td></tr>

  <!-- CTA BUTTON -->
  <tr><td align="center" style="padding-bottom:36px;">
    <a href="${boletoUrl}" style="display:inline-block;background:#e5272b;color:#ffffff;text-decoration:none;border-radius:8px;padding:16px 40px;font-size:14px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">VER MI BOLETO →</a>
  </td></tr>

  <!-- FOOTER -->
  <tr><td align="center" style="border-top:1px solid #1a1a1a;padding-top:24px;">
    <div style="font-size:12px;color:#444;line-height:1.8;">
      <strong style="color:#666;letter-spacing:2px;">CREA SIN MIEDO</strong> · ${lugarText}<br>
      ¿Dudas? <a href="mailto:brandproximity@gmail.com" style="color:#e5272b;text-decoration:none;">brandproximity@gmail.com</a>
    </div>
  </td></tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}

module.exports = { sendTicket };
