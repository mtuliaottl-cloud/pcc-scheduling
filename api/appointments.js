// api/appointments.js  — Vercel Serverless Function
// GET  → list all appointments
// POST { action:"append", row:[...] }  → create appointment
// POST { action:"update", row:[...] }  → update appointment status

import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const APPT_TAB = 'scheduling';
const HEADERS  = [
  'Appointment ID','Timestamp','Full Name','Email','Student ID',
  'Date','Time','Meet Type','Concern','Description',
  'Looking For','Specific Person','Notes','Status','userId'
];

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function ensureHeader(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${APPT_TAB}!A1:O1`,
  });
  if (!r.data.values || !r.data.values.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${APPT_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

async function getAllRows(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${APPT_TAB}!A:O`,
  });
  const rows = r.data.values || [];
  if (rows.length <= 1) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = getSheets();
    await ensureHeader(sheets);

    // ── GET: list all ─────────────────────────────────────────
    if (req.method === 'GET') {
      const data = await getAllRows(sheets);
      return res.status(200).json({ status: 'ok', data });
    }

    // ── POST ──────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action, row } = req.body || {};

      if (!Array.isArray(row) || row.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Invalid row data' });
      }

      // UPDATE: find by Appointment ID (col A) and overwrite
      if (action === 'update') {
        const allRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${APPT_TAB}!A:O`,
        });
        const allRows = allRes.data.values || [];
        let targetRowNum = -1;
        for (let i = 1; i < allRows.length; i++) {
          if (allRows[i][0] === row[0]) { targetRowNum = i + 1; break; }
        }

        if (targetRowNum > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${APPT_TAB}!A${targetRowNum}:O${targetRowNum}`,
            valueInputOption: 'RAW',
            requestBody: { values: [row] },
          });
          return res.status(200).json({ status: 'ok', message: 'updated' });
        }
        // ID not found — fall through to append
      }

      // APPEND (new booking, or update fallback)
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${APPT_TAB}!A:O`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      });
      return res.status(200).json({ status: 'ok', message: 'appended' });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  } catch (err) {
    console.error('APPT ERROR:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}