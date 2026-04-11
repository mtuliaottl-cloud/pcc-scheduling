// api/appointments.js  — Vercel Serverless Function
// GET  → list appointments
// POST { action:"append"|"update", row:[...] }

import { google } from 'googleapis';

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const APPT_TAB  = 'scheduling';
const HEADERS   = ['Appointment ID','Timestamp','Full Name','Email','Student ID','Date','Time','Meet Type','Concern','Description','Looking For','Specific Person','Notes','Status','userId'];

function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
   scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureHeader(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${APPT_TAB}!A1:O1`,
  });
  if (!res.data.values || !res.data.values.length) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${APPT_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

async function getAllRows(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${APPT_TAB}!A:O`,
  });
  const rows = res.data.values || [];
  if (rows.length <= 1) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = getSheets();

    /* ── GET: list all ───────────────────────────────────── */
    if (req.method === 'GET') {
      await ensureHeader(sheets);
      const data = await getAllRows(sheets);
      return res.status(200).json({ status: 'ok', data });
    }

    /* ── POST ────────────────────────────────────────────── */
    if (req.method === 'POST') {
      const { action, row } = req.body;
      await ensureHeader(sheets);

      if (action === 'update') {
        // Find row by Appointment ID and update it
        const allRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${APPT_TAB}!A:O`,
        });
        const allRows = allRes.data.values || [];
        let targetRow = -1;
        for (let i = 1; i < allRows.length; i++) {
          if (allRows[i][0] === row[0]) { targetRow = i + 1; break; }
        }
        if (targetRow > 0) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `${APPT_TAB}!A${targetRow}:O${targetRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [row] },
          });
          return res.status(200).json({ status: 'ok', message: 'updated' });
        }
      }

      // Default: append
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
