// /api/leave-requests.js
const GAS_URL = process.env.GAS_URL; // same env var your other routes use

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${GAS_URL}?type=leave-requests`);
      const data = await r.json();
      return res.json(data);
    }

    if (req.method === 'POST') {
      const body = req.body;
      // Map action names to GAS action names
      const gasBody = { ...body };
      if (body.action === 'submit') gasBody.action = 'submit-leave';
      if (body.action === 'review') gasBody.action = 'review-leave';

      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gasBody),
      });
      const data = await r.json();
      return res.json(data);
    }
  } catch(e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}