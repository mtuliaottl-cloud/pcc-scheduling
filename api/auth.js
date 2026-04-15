

import { google } from 'googleapis';

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const USERS_TAB = 'users';

// Column order in the "users" sheet
// id | role | firstName | lastName | email | password | sid | dept | createdAt
const USER_HEADERS = ['id','role','firstName','lastName','email','password','sid','dept','createdAt','status'];


function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Simple FNV-1a 32-bit hash — must match the Apps Script version
function hashPassword(password) {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return 'h$' + hash.toString(16);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function ensureHeader(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${USERS_TAB}!A1:I1`,
  });
  if (!r.data.values || !r.data.values.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${USERS_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [USER_HEADERS] },
    });
  }
}

async function getAllUsers(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${USERS_TAB}!A:I`,
  });
  return r.data.values || [];
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  const { action } = req.body || {};

  try {
    const sheets = getSheets();
    await ensureHeader(sheets);
    const rows = await getAllUsers(sheets);

    // ── LOGIN ──────────────────────────────────────────────────
    if (action === 'login') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ status: 'error', message: 'Missing fields' });

      const hashed = hashPassword(password);
      if (rows.length <= 1) return res.status(200).json({ status: 'invalid', message: 'Invalid email or password' });

      const headers = rows[0];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ''; });

        if (obj.email === email && obj.password === hashed) {
          delete obj.password;
          return res.status(200).json({ status: 'ok', user: obj });
        }
      }
      return res.status(200).json({ status: 'invalid', message: 'Invalid email or password' });
    }

    // ── REGISTER ───────────────────────────────────────────────
    if (action === 'register') {
      const { firstName, lastName, email, password, role, sid, dept } = req.body;
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
      }

      // Check duplicate email
      if (rows.length > 1) {
        const headers = rows[0];
        const emailIdx = headers.indexOf('email');
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][emailIdx] === email) {
            return res.status(200).json({ status: 'duplicate', message: 'Email already registered' });
          }
        }
      }

      const newId = 'U-' + Date.now();
      const newRow = [
        newId,
        role || 'student',
        firstName,
        lastName,
        email,
        hashPassword(password),
        sid  || '—',
        dept || '—',
        new Date().toISOString(),
         'active',
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${USERS_TAB}!A:I`,
        valueInputOption: 'RAW',
        requestBody: { values: [newRow] },
      });

      return res.status(200).json({ status: 'ok', message: 'registered', id: newId });
    }

    return res.status(400).json({ status: 'error', message: 'Unknown action' });

  } catch (err) {
    console.error('AUTH ERROR:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}