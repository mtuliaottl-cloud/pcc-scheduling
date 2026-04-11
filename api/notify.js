// api/notify.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { to, studentName, appointmentId, date, time, staff, concern, status } = req.body;

  const isConfirmed = status === 'Confirmed';

  const subject = isConfirmed
    ? `✅ Appointment Confirmed — ${appointmentId}`
    : `❌ Appointment Declined — ${appointmentId}`;

  const html = isConfirmed ? `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #e0e3ef;border-radius:12px;overflow:hidden">
      <div style="background:#3b6ff5;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">PCC Scheduling</h1>
        <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">Palawan Community College</p>
      </div>
      <div style="padding:28px">
        <h2 style="color:#1D9E75;margin:0 0 16px">Your appointment is confirmed! ✅</h2>
        <p style="color:#5a6080;margin:0 0 20px">Hi <strong>${studentName}</strong>, your appointment has been approved.</p>
        <div style="background:#f5f6fa;border-radius:8px;padding:16px;margin-bottom:20px">
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="color:#9ba3c2;padding:5px 0">Appointment ID</td><td style="font-weight:700;color:#1a1d2e">${appointmentId}</td></tr>
            <tr><td style="color:#9ba3c2;padding:5px 0">Date</td><td style="font-weight:700;color:#1a1d2e">${date}</td></tr>
            <tr><td style="color:#9ba3c2;padding:5px 0">Time</td><td style="font-weight:700;color:#1a1d2e">${time}</td></tr>
            <tr><td style="color:#9ba3c2;padding:5px 0">Staff</td><td style="font-weight:700;color:#1a1d2e">${staff}</td></tr>
            <tr><td style="color:#9ba3c2;padding:5px 0">Concern</td><td style="font-weight:700;color:#1a1d2e">${concern}</td></tr>
          </table>
        </div>
        <p style="color:#5a6080;font-size:13px">Please arrive 5 minutes early. Walk-ins are also welcome.</p>
        <p style="color:#9ba3c2;font-size:12px;margin-top:24px">PCC Scheduling System · Palawan Community College</p>
      </div>
    </div>` : `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;border:1px solid #e0e3ef;border-radius:12px;overflow:hidden">
      <div style="background:#e84040;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:20px">PCC Scheduling</h1>
        <p style="color:rgba(255,255,255,.8);margin:4px 0 0;font-size:13px">Palawan Community College</p>
      </div>
      <div style="padding:28px">
        <h2 style="color:#e84040;margin:0 0 16px">Appointment Declined ❌</h2>
        <p style="color:#5a6080;margin:0 0 20px">Hi <strong>${studentName}</strong>, unfortunately your appointment request was not approved.</p>
        <div style="background:#f5f6fa;border-radius:8px;padding:16px;margin-bottom:20px">
          <table style="width:100%;font-size:13px;border-collapse:collapse">
            <tr><td style="color:#9ba3c2;padding:5px 0">Appointment ID</td><td style="font-weight:700;color:#1a1d2e">${appointmentId}</td></tr>
            <tr><td style="color:#9ba3c2;padding:5px 0">Date</td><td style="font-weight:700;color:#1a1d2e">${date}</td></tr>
            <tr><td style="color:#9ba3c2;padding:5px 0">Concern</td><td style="font-weight:700;color:#1a1d2e">${concern}</td></tr>
          </table>
        </div>
        <p style="color:#5a6080;font-size:13px">You may book a new appointment at a different date or time.</p>
        <p style="color:#9ba3c2;font-size:12px;margin-top:24px">PCC Scheduling System · Palawan Community College</p>
      </div>
    </div>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PCC Scheduling <noreply@pcc.edu.ph>',
        to: [to],
        subject,
        html,
      }),
    });
    const data = await r.json();
    return res.status(200).json({ status: 'ok', data });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
}