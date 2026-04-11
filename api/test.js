// api/test.js
import { google } from 'googleapis';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const r = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID });
    return res.json({ 
      ok: true, 
      sheetTitle: r.data.properties.title,
      tabs: r.data.sheets.map(s => s.properties.title)
    });
  } catch(e) {
    return res.json({ ok: false, error: e.message });
  }
}