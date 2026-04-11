// api/users.js  — Vercel Serverless Function
// GET → returns all users (passwords stripped) for admin view

import { google } from 'googleapis';

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const USERS_TAB = 'users';

function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://script.google.com/macros/s/AKfycbzuAlbaoexz67uXRmsg7th6q7htu5lZGd0PQHE3pdjHHXPi9JQCSw4fDbrDc779KgnZ5w/exec'],
  });
  return google.sheets({ version: 'v4', auth });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  try {
    const sheets = getSheets();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${USERS_TAB}!A:J`,
    });

    const rows = result.data.values || [];
    if (rows.length <= 1) return res.status(200).json({ status: 'ok', data: [] });

    const headers = rows[0];
    const users   = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      delete obj['password']; // never expose hash
      return obj;
    });

    return res.status(200).json({ status: 'ok', data: users });
  } catch (err) {
    console.error('USERS ERROR:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
