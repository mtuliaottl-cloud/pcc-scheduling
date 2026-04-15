// api/blocked-dates.js
import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const TAB      = 'blocked_dates';
const HEADERS  = ['id','date','dept','reason','blockedBy','blockedAt'];

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function ensureTab(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets.some(s => s.properties.title === TAB);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }
}

async function getAllRows(sheets) {
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A:F`,
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
    await ensureTab(sheets);

    // GET — list all blocked dates
    if (req.method === 'GET') {
      const data = await getAllRows(sheets);
      return res.status(200).json({ status: 'ok', data });
    }

    // POST — add or remove blocked date
    if (req.method === 'POST') {
      const { action, id, date, dept, reason, blockedBy } = req.body || {};

      // UNBLOCK — delete row by id
      if (action === 'unblock') {
        const all = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${TAB}!A:F`,
        });
        const rows = all.data.values || [];
        let targetRow = -1;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] === id) { targetRow = i + 1; break; }
        }
        if (targetRow > 0) {
          const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
          const sheetObj  = sheetMeta.data.sheets.find(s => s.properties.title === TAB);
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
              requests: [{
                deleteDimension: {
                  range: {
                    sheetId:    sheetObj.properties.sheetId,
                    dimension:  'ROWS',
                    startIndex: targetRow - 1,
                    endIndex:   targetRow,
                  }
                }
              }]
            }
          });
        }
        return res.status(200).json({ status: 'ok', message: 'unblocked' });
      }

      // BLOCK — append new row
      const newId = 'BLK-' + Date.now();
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${TAB}!A:F`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[newId, date, dept, reason || 'No reason given', blockedBy, new Date().toISOString()]]
        },
      });
      return res.status(200).json({ status: 'ok', message: 'blocked', id: newId });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  } catch (err) {
    console.error('BLOCKED DATES ERROR:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}