// api/auth.js  — Vercel Serverless Function
// Handles: POST { action: "login" | "register", ...fields }

import { google } from 'googleapis';

const SHEET_ID   = process.env.GOOGLE_SHEET_ID;
const USERS_TAB  = 'users';

/* ── Google Auth ─────────────────────────────────────────── */
function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
   scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/* ── Simple FNV-1a hash (matches GAS side) ───────────────── */
function hashPassword(password) {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return 'h$' + hash.toString(16);
}

/* ── Read all users ──────────────────────────────────────── */
async function getAllUsers(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${USERS_TAB}!A:J`,
  });
  const rows = res.data.values || [];
  if (rows.length <= 1) return { headers: rows[0] || [], users: [] };
  const headers = rows[0];
  const users   = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
  return { headers, users };
}

/* ── Ensure header row exists ────────────────────────────── */
async function ensureHeader(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${USERS_TAB}!A1:J1`,
  });
  if (!res.data.values || !res.data.values.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${USERS_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['id','role','firstName','lastName','email','password','sid','dept','createdAt','status']] },
    });
  }
}

/* ── CORS headers ────────────────────────────────────────── */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  try {
    const sheets = getSheets();
    const data   = req.body;

    /* ── REGISTER ───────────────────────────────────────── */
    if (data.action === 'register') {
      const { firstName, lastName, email, password, role, sid, dept } = data;
      if (!firstName || !lastName || !email || !password || !role) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields' });
      }

      await ensureHeader(sheets);
      const { users } = await getAllUsers(sheets);

      const exists = users.find(u => u.email === email);
      if (exists) return res.status(409).json({ status: 'duplicate', message: 'Email already registered' });

      const newUser = [
        'u-' + Date.now(),
        role,
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
        range: `${USERS_TAB}!A:J`,
        valueInputOption: 'RAW',
        requestBody: { values: [newUser] },
      });

      return res.status(200).json({ status: 'ok', message: 'registered' });
    }

    /* ── LOGIN ──────────────────────────────────────────── */
    if (data.action === 'login') {
      const { email, password } = data;
      if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'Missing email or password' });
      }

      await ensureHeader(sheets);
      const { users } = await getAllUsers(sheets);
      const hashed    = hashPassword(password);
      const user      = users.find(u => u.email === email && u.password === hashed);

      if (!user) return res.status(401).json({ status: 'invalid', message: 'Invalid email or password' });

      const safeUser = { ...user };
      delete safeUser.password;
      return res.status(200).json({ status: 'ok', user: safeUser });
    }

    return res.status(400).json({ status: 'error', message: 'Unknown action' });

  } catch (err) {
    console.error('AUTH ERROR:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
