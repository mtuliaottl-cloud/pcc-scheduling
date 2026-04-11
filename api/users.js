// api/users.js  — Vercel Serverless Function
// GET → returns all users (passwords stripped)
// Used by: admin dashboard, session restore, staff availability lookup

import { google } from 'googleapis';

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const USERS_TAB = 'users';

function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
      // Columns A–I: id, role, firstName, lastName, email, password, sid, dept, createdAt
      range: `${USERS_TAB}!A:I`,
    });

    const rows = result.data.values || [];
    if (rows.length <= 1) return res.status(200).json({ status: 'ok', data: [] });

    const headers = rows[0];
    const users = rows.slice(1).map(row => {
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