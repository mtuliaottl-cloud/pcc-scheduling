# PCC Scheduling System — Setup & Deploy Guide

## Project Structure
```
pcc-scheduling/
├── api/
│   ├── auth.js           ← Login & Register (Vercel serverless)
│   ├── appointments.js   ← Read & write appointments
│   └── users.js          ← Read users list (admin)
├── public/
│   └── index.html        ← Full frontend (original theme)
├── vercel.json           ← Routing config
├── package.json
└── SETUP.md              ← This file
```

---

## STEP 1 — Google Sheets Setup

1. Go to **sheets.google.com** and create a new spreadsheet.
2. Create **two tabs** (sheets) named exactly:
   - `users`
   - `scheduling`
3. Copy the **Spreadsheet ID** from the URL:
   ```
https://script.google.com/macros/s/AKfycbzuAlbaoexz67uXRmsg7th6q7htu5lZGd0PQHE3pdjHHXPi9JQCSw4fDbrDc779KgnZ5w/exec
   ```

---

## STEP 2 — Google Service Account

This lets your Vercel app read/write to the sheet without user login.

1. Go to **console.cloud.google.com**
2. Create a new project (e.g. "PCC Scheduling")
3. Enable **Google Sheets API**:
   - Left menu → APIs & Services → Library → search "Google Sheets API" → Enable
4. Create a **Service Account**:
   - Left menu → APIs & Services → Credentials → Create Credentials → Service Account
   - Name it anything (e.g. "pcc-sheets-writer")
   - Click Done
5. Click the service account → **Keys** tab → Add Key → JSON → Download
6. Open the downloaded JSON file. You'll need its full contents.

7. **Share your Google Sheet** with the service account email:
   - Open your sheet
   - Click Share
   - Paste the service account email (looks like: `something@project-id.iam.gserviceaccount.com`)
   - Give it **Editor** access

---

## STEP 3 — Deploy to Vercel

### A. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/pcc-scheduling.git
git push -u origin main
```

### B. Import to Vercel
1. Go to **vercel.com** → New Project
2. Import your GitHub repo
3. Framework preset: **Other**
4. Click **Deploy** (it will fail first — that's okay, we need to add env vars)

### C. Add Environment Variables
In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `GOOGLE_SHEET_ID` | Your spreadsheet ID from Step 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The **entire contents** of the JSON file from Step 2 |

> ⚠️ For `GOOGLE_SERVICE_ACCOUNT_JSON`: paste the whole JSON as one line.
> In the Vercel UI, multi-line values work fine — just paste the whole file content.

### D. Redeploy
After adding env vars:
- Vercel dashboard → Deployments → click the latest → Redeploy
- Your site will be live at `https://pcc-scheduling.vercel.app` (or similar)

---

## STEP 4 — First Admin Account

Since the system is live, register the first admin:
1. Go to your live site
2. Click **Register**
3. Select **Admin** role
4. Fill in your details
5. Sign in

All new registrations are saved directly to your `users` Google Sheet.

---

## How the Database Works

| Action | Where it goes |
|--------|--------------|
| Register | Row added to `users` sheet |
| Login | Reads `users` sheet, checks password hash |
| Book appointment | Row added to `scheduling` sheet |
| Admin approve/decline | Row updated in `scheduling` sheet |
| Admin view all users | Reads `users` sheet (passwords hidden) |

**Auto-refresh**: The app polls the API every 30 seconds, so all users see live data.

---

## Role Permissions

| Feature | Admin | Employee | Student |
|---------|-------|----------|---------|
| View all appointments | ✅ | ❌ | ❌ |
| Approve / decline appointments | ✅ | ❌ | ❌ |
| View all users | ✅ | ❌ | ❌ |
| Export CSV | ✅ | ❌ | ❌ |
| View assigned appointments | ✅ | ✅ | ❌ |
| Book appointments | ✅ | ❌ | ✅ |
| View own appointments | ✅ | ✅ | ✅ |

---

## Local Development (optional)

```bash
npm install -g vercel
cd pcc-scheduling
vercel dev
```
Create a `.env.local` file:
```
GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

---

## Troubleshooting

**"Could not connect to server"**
→ Check that env vars are set in Vercel and you redeployed after adding them.

**"Invalid email or password" on first login**
→ Make sure you registered first. The system has no default accounts.

**Appointments not saving**
→ Check that the service account has **Editor** access to the sheet.

**Sheet not found error**
→ Make sure the tabs are named exactly `users` and `scheduling` (lowercase, no spaces).
