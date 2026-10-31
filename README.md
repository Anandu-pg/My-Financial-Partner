# My Financial Partner 💰
### A Personal Money Manager built with HTML · CSS · Vanilla JS · Google Apps Script · Google Sheets

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔐 Authentication | Username + 4-digit PIN, HMAC-SHA256 hashed, server-side sessions |
| 📊 Dashboard | Balance, income, expenses, savings, trend chart, expense pie chart |
| 💸 Income | Add income with category, date, payment method, account |
| 🛒 Expenses | 18 built-in categories + custom categories |
| 💼 Salary | Set expected salary, mark as received, monthly history |
| 🎯 Budgets | Category spending limits, 70%/90%/100% warnings |
| 🐷 Savings Goals | Progress tracking, contributions, target dates |
| 📈 Reports | Monthly, yearly, by category, daily trends – PDF & CSV export |
| 🌙 Dark Mode | Full dark mode with smooth transitions |
| 📱 Responsive | Sidebar (desktop) + bottom navigation (mobile) |

---

## 🚀 Setup Guide

### Step 1 – Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Create a new spreadsheet
3. Note the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

---

### Step 2 – Set Up Google Apps Script

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Delete the default code
3. Copy the entire contents of `gas/Code.gs` and paste it in
4. Save the project (name it "My Financial Partner API")

#### Set Script Properties

Go to **Project Settings → Script Properties → Add property**:

| Property | Value |
|---|---|
| `SPREADSHEET_ID` | Your Google Sheet ID from Step 1 |
| `PIN_SECRET` | A random string (e.g. `mfp_secret_XkL9_2026_#!`) |

> ⚠️ Keep these values secret. Do not share them publicly.

#### Run Database Setup

1. In the editor, select `setupDatabase` from the function dropdown
2. Click **Run**
3. Authorize when prompted
4. Check the Execution Log — you should see: `✅ Database setup complete!`
5. Open your Google Sheet — all 9 tabs should now be created

---

### Step 3 – Deploy as Web App

1. Click **Deploy → New deployment**
2. Type: **Web App**
3. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`)

> 💡 After any future code change, go to **Deploy → Manage deployments → Edit → New version** to redeploy.

---

### Step 4 – Configure the Frontend

Open `js/api.js` and replace the placeholder URL on line 13:

```javascript
// Before:
const GAS_URL = 'YOUR_GAS_WEB_APP_URL_HERE';

// After:
const GAS_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

---

### Step 5 – Deploy the Frontend

#### Option A – GitHub Pages (Free)

1. Create a GitHub repository
2. Upload all files from `personal_finance_tracker/` (everything **except** the `gas/` folder)
3. Go to **Settings → Pages → Deploy from branch → main / root**
4. Your site will be live at `https://[username].github.io/[repo-name]/`

#### Option B – Netlify (Free, Recommended)

1. Create a free account at [netlify.com](https://netlify.com)
2. Drag and drop the `personal_finance_tracker/` folder (excluding `gas/`) onto the Netlify dashboard
3. Your site is live immediately with a Netlify URL

> 💡 You can use a custom domain on both GitHub Pages and Netlify.

---

## 📁 Project Structure

```
personal_finance_tracker/
├── index.html           ← Redirect to login/dashboard
├── login.html
├── register.html
├── dashboard.html
├── transactions.html
├── income.html
├── expenses.html
├── salary.html
├── budgets.html
├── savings.html
├── reports.html
├── css/
│   └── style.css        ← Full design system (dark/light mode)
├── js/
│   ├── api.js           ← All API calls to GAS  ⬅ SET GAS_URL HERE
│   ├── app.js           ← Navigation, theme, toasts, formatters
│   ├── auth.js          ← Login, register, session guard
│   ├── dashboard.js     ← Dashboard charts and stats
│   ├── transactions.js  ← Transaction list with filters
│   ├── income.js        ← Add income form
│   ├── expenses.js      ← Add expense form
│   ├── salary.js        ← Salary management
│   ├── budgets.js       ← Budget CRUD
│   ├── savings.js       ← Savings goals
│   └── reports.js       ← Reports + Chart.js + PDF/CSV export
├── assets/
├── manifest.json
├── README.md
└── gas/
    └── Code.gs          ← Google Apps Script backend (DO NOT deploy to GitHub)
```

---

## 🗄️ Google Sheets Schema

| Sheet | Purpose |
|---|---|
| Users | Username, hashed PIN, login attempts, lockout |
| Sessions | Session tokens, expiry (24h) |
| Transactions | All income and expense records |
| Salary | Monthly salary expectations and received amounts |
| Budgets | Category-specific monthly spending limits |
| Savings | Savings goals and contributions |
| Accounts | User payment accounts (Cash, Bank, Wallet) |
| Categories | Custom user-defined categories |
| Settings | Per-user settings |

---

## 🔒 Security Architecture

- **PIN storage:** Never stored as plain text. Hashed with HMAC-SHA256 using a secret stored in GAS Script Properties.
- **Sessions:** Random 64-char tokens stored in Google Sheets. Expire after 24 hours.
- **User isolation:** Every API call validates the session token and resolves the user server-side. The frontend never sends a UserID.
- **Rate limiting:** 5 failed PIN attempts → 15-minute account lockout.
- **Concurrent writes:** Google Apps Script `LockService` prevents race conditions.

---

## 🧪 Testing Checklist

- [ ] Register a new user → check Users sheet
- [ ] Register same username → shows "Username already exists" error
- [ ] Wrong PIN 5 times → account locked for 15 minutes
- [ ] Login → session token appears in Sessions sheet
- [ ] Add income → Transactions sheet row added
- [ ] Add expense → balance updates on dashboard
- [ ] Set budget → 70%/90%/100% warnings appear
- [ ] Create savings goal + contribute → progress bar updates
- [ ] Logout → token invalidated, redirect to login
- [ ] Register a second user → cannot see first user's data
- [ ] Mobile view (375px) → bottom nav appears, layout responsive
- [ ] PDF export from Reports page → downloads correctly
- [ ] CSV export from Reports page → opens in Excel/Sheets

---

## 🔧 Optional: Set Up Session Cleanup Trigger

To automatically clean up expired sessions, create a time-based trigger in Apps Script:

1. Go to your Apps Script project
2. Click **Triggers** (clock icon on the left sidebar)
3. Add trigger: `cleanupExpiredSessions` → Time-driven → Day timer → 3 AM

---

## 📞 Support

This app is self-hosted. If you encounter issues:

1. Check the Apps Script **Execution Log** for backend errors
2. Open browser **DevTools Console** for frontend errors
3. Ensure the GAS Web App is deployed as **"Anyone"** access
4. Verify all 3 Script Properties are set correctly

---

*Built with ❤️ using HTML5, CSS3, Vanilla JS, Chart.js, Lucide Icons, Google Apps Script, and Google Sheets.*
