// /api/leave-requests.js
import { getSheet } from './_sheets';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const sheet = await getSheet('LeaveRequests');

    if (req.method === 'GET') {
      const rows = await sheet.getRows();
      const data = rows.map(r => ({
        id:          r.get('ID'),
        employeeId:  r.get('EmployeeID'),
        employeeName:r.get('EmployeeName'),
        dept:        r.get('Department'),
        type:        r.get('Type'),
        from:        r.get('From'),
        to:          r.get('To'),
        notes:       r.get('Notes'),
        status:      r.get('Status'),
        submittedAt: r.get('SubmittedAt'),
        reviewedBy:  r.get('ReviewedBy'),
        reviewedAt:  r.get('ReviewedAt'),
      }));
      return res.json({ status: 'ok', data });
    }

    if (req.method === 'POST') {
      const { action, id, ...body } = req.body;

      if (action === 'submit') {
        await sheet.addRow({
          ID:           'LR-' + Date.now(),
          EmployeeID:   body.employeeId,
          EmployeeName: body.employeeName,
          Department:   body.dept,
          Type:         body.type,
          From:         body.from,
          To:           body.to,
          Notes:        body.notes || '',
          Status:       'Pending',
          SubmittedAt:  new Date().toISOString(),
          ReviewedBy:   '',
          ReviewedAt:   '',
        });
        return res.json({ status: 'ok' });
      }

      if (action === 'review') {
        const rows = await sheet.getRows();
        const row  = rows.find(r => r.get('ID') === id);
        if (!row) return res.json({ status: 'error', message: 'Not found' });
        row.set('Status',     body.status);
        row.set('ReviewedBy', body.reviewedBy);
        row.set('ReviewedAt', new Date().toISOString());
        await row.save();
        return res.json({ status: 'ok' });
      }
    }
  } catch(e) {
    return res.status(500).json({ status: 'error', message: e.message });
  }
}