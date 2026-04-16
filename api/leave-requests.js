// /api/leave-requests.js
import { google } from 'googleapis';

const SHEET_ID  = process.env.GOOGLE_SHEET_ID;
const TAB       = 'LeaveRequests';
const HEADERS   = ['ID','EmployeeID','EmployeeName','Department','Type','From','To','Notes','Status','SubmittedAt','ReviewedBy','ReviewedAt'];

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
  // 1. Ensure the tab exists  ← ADD THIS BLOCK
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabExists = meta.data.sheets.some(s => s.properties.title === TAB);

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TAB } } }]
      },
    });
  }

  // 2. Ensure header row exists  ← your existing code below
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TAB}!A1:L1`,
  });
  if (!r.data.values || !r.data.values.length) {
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
    range: `${TAB}!A:L`,
  });
  const rows = r.data.values || [];
  if (rows.length <= 1) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => ({
    id:           row[0]  || '',
    employeeId:   row[1]  || '',
    employeeName: row[2]  || '',
    dept:         row[3]  || '',
    type:         row[4]  || '',
    from:         row[5]  || '',
    to:           row[6]  || '',
    notes:        row[7]  || '',
    status:       row[8]  || '',
    submittedAt:  row[9]  || '',
    reviewedBy:   row[10] || '',
    reviewedAt:   row[11] || '',
  }));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheets = getSheets();
    await ensureHeader(sheets);

    // ── GET: list all leave requests ──────────────────────────
    if (req.method === 'GET') {
      const data = await getAllRows(sheets);
      return res.status(200).json({ status: 'ok', data });
    }

    // ── POST ──────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { action } = req.body || {};

      // SUBMIT a new leave request
      if (action === 'submit') {
        const { employeeId, employeeName, dept, type, from, to, notes } = req.body;
        const newRow = [
          'LR-' + Date.now(),
          employeeId   || '',
          employeeName || '',
          dept         || '',
          type         || '',
          from         || '',
          to           || '',
          notes        || '',
          'Pending',
          new Date().toISOString(),
          '', '',
        ];
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: `${TAB}!A:L`,
          valueInputOption: 'RAW',
          requestBody: { values: [newRow] },
        });
        return res.status(200).json({ status: 'ok', message: 'submitted' });
      }

      // REVIEW (approve / decline / cancel)
      if (action === 'review') {
        const { id, status, reviewedBy } = req.body;
        const allRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: `${TAB}!A:L`,
        });
        const allRows = allRes.data.values || [];
        let targetRow = -1;
        for (let i = 1; i < allRows.length; i++) {
          if (allRows[i][0] === id) { targetRow = i + 1; break; }
        }
        if (targetRow < 0) {
          return res.status(404).json({ status: 'error', message: 'Leave request not found' });
        }
        // Update status, reviewedBy, reviewedAt columns
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `${TAB}!I${targetRow}:L${targetRow}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[status, new Date().toISOString(), reviewedBy || '', new Date().toISOString()]] },
        });
        return res.status(200).json({ status: 'ok', message: 'reviewed' });
      }

      return res.status(400).json({ status: 'error', message: 'Unknown action' });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });

  } catch (err) {
    console.error('LEAVE ERROR:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}