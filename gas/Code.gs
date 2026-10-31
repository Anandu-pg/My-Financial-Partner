/**
 * My Financial Partner – Google Apps Script Backend
 * ==================================================
 * SETUP INSTRUCTIONS (read before deploying):
 *
 * 1. Open https://script.google.com → New project
 * 2. Paste this entire file into Code.gs
 * 3. Go to Project Settings → Script Properties → Add:
 *      SPREADSHEET_ID  = (ID from your Google Sheet URL)
 *      PIN_SECRET      = (any random 32+ char string you invent)
 *      SESSION_SECRET  = (another random 32+ char string)
 * 4. Save. Then run setupDatabase() ONCE from the editor to
 *    create all sheets and headers.
 * 5. Deploy → New Deployment → Web App:
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Copy the Web App URL and paste it into js/api.js
 */

/* ── Constants ──────────────────────────────────────────── */
const SHEETS = {
  USERS:        'Users',
  SESSIONS:     'Sessions',
  TRANSACTIONS: 'Transactions',
  SALARY:       'Salary',
  BUDGETS:      'Budgets',
  SAVINGS:      'Savings',
  ACCOUNTS:     'Accounts',
  CATEGORIES:   'Categories',
  SETTINGS:     'Settings',
};

const SESSION_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FAIL_ATTEMPTS = 5;
const LOCKOUT_MS      = 15 * 60 * 1000;       // 15 minutes

/* ── Entry Points ───────────────────────────────────────── */

function doPost(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = JSON.parse(e.postData.contents);
    const { action, token, ...data } = body;

    if (!action) return respond({ success: false, error: 'Missing action.' }, headers);

    // Public endpoints (no auth required)
    const PUBLIC_ACTIONS = ['register', 'login', 'checkUsername'];

    if (!PUBLIC_ACTIONS.includes(action)) {
      const session = validateSession_(token);
      if (!session.valid) {
        return respond({ success: false, error: 'Session expired. Please log in again.', code: 'AUTH_REQUIRED' }, headers);
      }
      data._userId = session.userId; // inject server-resolved userId
    }

    const result = route(action, data);
    return respond(result, headers);

  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return respond({ success: false, error: 'Internal server error.' }, headers);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    message: 'My Financial Partner API is running.',
    version: '1.0.0',
  })).setMimeType(ContentService.MimeType.JSON);
}

function respond(data, headers) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/* ── Router ─────────────────────────────────────────────── */

function route(action, data) {
  const userId = data._userId;
  switch (action) {
    // Auth
    case 'register':          return registerUser(data);
    case 'login':             return loginUser(data);
    case 'logout':            return logoutUser(data.token, userId);
    case 'validateSession':   return { success: true, message: 'Session valid.' };
    case 'checkUsername':     return checkUsername(data);

    // Transactions
    case 'addTransaction':    return addTransaction(data, userId);
    case 'getTransactions':   return getTransactions(data, userId);
    case 'updateTransaction': return updateTransaction(data, userId);
    case 'deleteTransaction': return deleteTransaction(data, userId);

    // Dashboard
    case 'getDashboardSummary': return getDashboardSummary(data, userId);

    // Salary
    case 'setSalary':           return setSalary(data, userId);
    case 'markSalaryReceived':  return markSalaryReceived(data, userId);
    case 'getSalaryHistory':    return getSalaryHistory(data, userId);
    case 'getSalaryForMonth':   return getSalaryForMonth(data, userId);

    // Budgets
    case 'setBudget':   return setBudget(data, userId);
    case 'getBudgets':  return getBudgets(data, userId);
    case 'deleteBudget':return deleteBudget(data, userId);

    // Savings
    case 'createGoal':       return createGoal(data, userId);
    case 'updateGoal':       return updateGoal(data, userId);
    case 'contributeToGoal': return contributeToGoal(data, userId);
    case 'getGoals':         return getGoals(data, userId);
    case 'deleteGoal':       return deleteGoal(data, userId);

    // Reports
    case 'getMonthlyReport':  return getMonthlyReport(data, userId);
    case 'getYearlyReport':   return getYearlyReport(data, userId);
    case 'getCategoryReport': return getCategoryReport(data, userId);
    case 'getDailyReport':    return getDailyReport(data, userId);

    // Categories
    case 'getCategories':      return getCategories(data, userId);
    case 'addCustomCategory':  return addCustomCategory(data, userId);
    case 'deleteCategory':     return deleteCategory(data, userId);

    // Accounts
    case 'getAccounts':  return getAccounts(data, userId);
    case 'addAccount':   return addAccount(data, userId);
    case 'deleteAccount':return deleteAccount(data, userId);

    default:
      return { success: false, error: 'Unknown action: ' + action };
  }
}

/* ── Spreadsheet Helpers ────────────────────────────────── */

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID script property not set.');
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  return getSpreadsheet_().getSheetByName(name);
}

function generateId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').substring(0, 12).toUpperCase();
}

function now_() { return new Date().toISOString(); }

function currentMonthYear_() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── PIN Hashing ────────────────────────────────────────── */

function hashPin_(pin) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('PIN_SECRET');
  if (!secret) throw new Error('PIN_SECRET script property not set.');
  const bytes = Utilities.computeHmacSha256Signature(pin, secret);
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

/* ── Session Management ─────────────────────────────────── */

function generateToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function validateSession_(token) {
  if (!token) return { valid: false };

  const sheet = getSheet_(SHEETS.SESSIONS);
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const [rowToken, userId, , expiresAt, isValid] = data[i];
    if (rowToken === token) {
      if (!isValid || new Date(expiresAt) < now) {
        return { valid: false };
      }
      return { valid: true, userId };
    }
  }
  return { valid: false };
}

function createSession_(userId) {
  const token = generateToken_();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(SHEETS.SESSIONS);
    sheet.appendRow([token, userId, now.toISOString(), expires.toISOString(), true]);
  } finally {
    lock.releaseLock();
  }

  return token;
}

function invalidateSession_(token) {
  const sheet = getSheet_(SHEETS.SESSIONS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      sheet.getRange(i + 1, 5).setValue(false);
      return;
    }
  }
}

/* ── Auth Functions ─────────────────────────────────────── */

function checkUsername(data) {
  const { username } = data;
  if (!username || username.trim().length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }

  const sheet = getSheet_(SHEETS.USERS);
  const names = sheet.getDataRange().getValues().slice(1).map(r => r[1].toLowerCase());
  const exists = names.includes(username.trim().toLowerCase());

  return { success: true, available: !exists };
}

function registerUser(data) {
  const { username, pin } = data;

  // Validation
  if (!username || username.trim().length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  if (!pin || !/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PIN must be exactly 4 digits.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    // Double-check uniqueness inside lock
    const sheet = getSheet_(SHEETS.USERS);
    const rows = sheet.getDataRange().getValues().slice(1);
    const exists = rows.some(r => r[1].toLowerCase() === username.trim().toLowerCase());

    if (exists) {
      return { success: false, error: 'Username already exists. Please choose another username.' };
    }

    const userId   = generateId_('USR');
    const pinHash  = hashPin_(pin);
    const now      = now_();

    sheet.appendRow([userId, username.trim(), pinHash, 0, null, now]);

    // Seed default accounts for new user
    seedDefaultAccounts_(userId);

    // Create session
    const token = createSession_(userId);

    return {
      success: true,
      token,
      user: { userId, username: username.trim() },
    };
  } finally {
    lock.releaseLock();
  }
}

function loginUser(data) {
  const { username, pin } = data;

  if (!username || !pin) {
    return { success: false, error: 'Username and PIN are required.' };
  }

  const sheet = getSheet_(SHEETS.USERS);
  const rows  = sheet.getDataRange().getValues();
  // Cols: UserID(0), Username(1), PINHash(2), FailedAttempts(3), LockUntil(4), CreatedAt(5)

  let userRow = null;
  let rowIndex = -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1].toLowerCase() === username.trim().toLowerCase()) {
      userRow  = rows[i];
      rowIndex = i + 1; // 1-indexed sheet row
      break;
    }
  }

  if (!userRow) {
    return { success: false, error: 'Invalid username or PIN.' };
  }

  // Rate limiting check
  const failedAttempts = parseInt(userRow[3]) || 0;
  const lockUntil      = userRow[4] ? new Date(userRow[4]) : null;
  const now            = new Date();

  if (lockUntil && lockUntil > now) {
    const remainMins = Math.ceil((lockUntil - now) / 60000);
    return {
      success: false,
      error: `Too many failed attempts. Account locked for ${remainMins} more minute(s).`,
    };
  }

  // Verify PIN
  const pinHash = hashPin_(pin);
  if (pinHash !== userRow[2]) {
    const newFails = failedAttempts + 1;
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (newFails >= MAX_FAIL_ATTEMPTS) {
        const lockExpiry = new Date(now.getTime() + LOCKOUT_MS).toISOString();
        sheet.getRange(rowIndex, 4).setValue(newFails);
        sheet.getRange(rowIndex, 5).setValue(lockExpiry);
        return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes.' };
      }
      sheet.getRange(rowIndex, 4).setValue(newFails);
    } finally {
      lock.releaseLock();
    }
    return { success: false, error: 'Invalid username or PIN.' };
  }

  // Successful login – reset failures
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.getRange(rowIndex, 4).setValue(0);
    sheet.getRange(rowIndex, 5).setValue('');
  } finally {
    lock.releaseLock();
  }

  const token = createSession_(userRow[0]);

  return {
    success: true,
    token,
    user: { userId: userRow[0], username: userRow[1] },
  };
}

function logoutUser(token) {
  if (token) invalidateSession_(token);
  return { success: true };
}

/* ── Default Account Seeding ────────────────────────────── */

function seedDefaultAccounts_(userId) {
  const sheet = getSheet_(SHEETS.ACCOUNTS);
  const defaults = [
    ['Cash', 'cash'],
    ['Bank Account', 'bank'],
    ['Wallet', 'wallet'],
  ];
  defaults.forEach(([name, type]) => {
    sheet.appendRow([generateId_('ACC'), userId, name, type, 0, now_()]);
  });
}

/* ── Transaction Functions ──────────────────────────────── */

function addTransaction(data, userId) {
  const { type, amount, category, date, description, paymentMethod, account, notes } = data;

  if (!type || !['income', 'expense'].includes(type)) {
    return { success: false, error: 'Type must be income or expense.' };
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return { success: false, error: 'Amount must be a positive number.' };
  }
  if (!category) return { success: false, error: 'Category is required.' };
  if (!date)     return { success: false, error: 'Date is required.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(SHEETS.TRANSACTIONS);
    const txId = generateId_('TX');
    sheet.appendRow([
      txId, userId, type, amt, category,
      date, description || '', paymentMethod || '', account || '', notes || '', now_()
    ]);

    // Update account balance if account specified
    if (account) updateAccountBalance_(userId, account, type === 'income' ? amt : -amt);

    return { success: true, txId };
  } finally {
    lock.releaseLock();
  }
}

function getTransactions(data, userId) {
  const { filters = {} } = data;
  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues().slice(1);

  let result = rows
    .filter(r => r[1] === userId)
    .map(r => ({
      txId: r[0], userId: r[1], type: r[2], amount: r[3],
      category: r[4], date: r[5], description: r[6],
      paymentMethod: r[7], account: r[8], notes: r[9], createdAt: r[10],
    }));

  // Apply filters
  if (filters.type)     result = result.filter(r => r.type === filters.type);
  if (filters.category) result = result.filter(r => r.category === filters.category);
  if (filters.monthYear) {
    const [yr, mo] = filters.monthYear.split('-');
    result = result.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === parseInt(yr) && d.getMonth() + 1 === parseInt(mo);
    });
  }
  if (filters.dateFrom) result = result.filter(r => new Date(r.date) >= new Date(filters.dateFrom));
  if (filters.dateTo)   result = result.filter(r => new Date(r.date) <= new Date(filters.dateTo));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(r =>
      (r.description || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q)
    );
  }

  // Sort newest first
  result.sort((a, b) => new Date(b.date) - new Date(a.date));

  return { success: true, transactions: result };
}

function updateTransaction(data, userId) {
  const { txId, type, amount, category, date, description, paymentMethod, account, notes } = data;
  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === txId && rows[i][1] === userId) {
      const oldType   = rows[i][2];
      const oldAmount = parseFloat(rows[i][3]);
      const oldAccount= rows[i][8];

      const amt = parseFloat(amount);
      if (isNaN(amt) || amt <= 0) return { success: false, error: 'Invalid amount.' };

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const range = sheet.getRange(i + 1, 1, 1, 11);
        range.setValues([[
          txId, userId, type || oldType, amt, category || rows[i][4],
          date || rows[i][5], description !== undefined ? description : rows[i][6],
          paymentMethod !== undefined ? paymentMethod : rows[i][7],
          account !== undefined ? account : rows[i][8],
          notes !== undefined ? notes : rows[i][9], rows[i][10],
        ]]);

        // Reverse old balance, apply new
        if (oldAccount) updateAccountBalance_(userId, oldAccount, oldType === 'income' ? -oldAmount : oldAmount);
        const newAcc = account !== undefined ? account : oldAccount;
        if (newAcc) updateAccountBalance_(userId, newAcc, (type || oldType) === 'income' ? amt : -amt);
      } finally {
        lock.releaseLock();
      }

      return { success: true };
    }
  }

  return { success: false, error: 'Transaction not found.' };
}

function deleteTransaction(data, userId) {
  const { txId } = data;
  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === txId && rows[i][1] === userId) {
      const type    = rows[i][2];
      const amount  = parseFloat(rows[i][3]);
      const account = rows[i][8];

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.deleteRow(i + 1);
        if (account) updateAccountBalance_(userId, account, type === 'income' ? -amount : amount);
      } finally {
        lock.releaseLock();
      }

      return { success: true };
    }
  }

  return { success: false, error: 'Transaction not found.' };
}

/* ── Account Balance Helper ─────────────────────────────── */

function updateAccountBalance_(userId, accountName, delta) {
  const sheet = getSheet_(SHEETS.ACCOUNTS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] === userId && rows[i][2] === accountName) {
      const current = parseFloat(rows[i][4]) || 0;
      sheet.getRange(i + 1, 5).setValue(current + delta);
      return;
    }
  }
}

/* ── Dashboard ──────────────────────────────────────────── */

function getDashboardSummary(data, userId) {
  const { monthYear } = data;
  const my = monthYear || currentMonthYear_();
  const [yr, mo] = my.split('-').map(Number);

  const txSheet = getSheet_(SHEETS.TRANSACTIONS);
  const txRows  = txSheet.getDataRange().getValues().slice(1)
    .filter(r => {
      if (r[1] !== userId) return false;
      const d = new Date(r[5]);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });

  let totalIncome  = 0;
  let totalExpense = 0;
  const categoryExpenses = {};

  txRows.forEach(r => {
    const amt = parseFloat(r[3]) || 0;
    if (r[2] === 'income') {
      totalIncome += amt;
    } else {
      totalExpense += amt;
      categoryExpenses[r[4]] = (categoryExpenses[r[4]] || 0) + amt;
    }
  });

  // Recent 10 transactions (this month)
  const recent = txRows
    .map(r => ({
      txId: r[0], type: r[2], amount: r[3], category: r[4],
      date: r[5], description: r[6], paymentMethod: r[7],
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  // Total balance (all time, all transactions)
  const allTx = txSheet.getDataRange().getValues().slice(1).filter(r => r[1] === userId);
  let totalBalance = 0;
  allTx.forEach(r => {
    totalBalance += r[2] === 'income' ? parseFloat(r[3]) : -parseFloat(r[3]);
  });

  // Monthly comparison (last 6 months)
  const monthly = getMonthlyTrend_(userId, 6);

  // Budget usage for this month
  const budgets = getBudgetUsage_(userId, my, categoryExpenses);

  // Savings summary
  const savingsSummary = getSavingsSummary_(userId);

  return {
    success: true,
    data: {
      monthYear: my,
      totalBalance,
      monthlyIncome:  totalIncome,
      monthlyExpense: totalExpense,
      monthlySavings: totalIncome - totalExpense,
      categoryExpenses,
      recentTransactions: recent,
      monthlyTrend: monthly,
      budgetUsage:  budgets,
      savingsSummary,
    },
  };
}

function getMonthlyTrend_(userId, months) {
  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues().slice(1).filter(r => r[1] === userId);

  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });

    let income = 0, expense = 0;
    rows.forEach(r => {
      const rd = new Date(r[5]);
      if (rd.getFullYear() === yr && rd.getMonth() + 1 === mo) {
        if (r[2] === 'income')  income  += parseFloat(r[3]) || 0;
        if (r[2] === 'expense') expense += parseFloat(r[3]) || 0;
      }
    });

    result.push({ label, income, expense });
  }

  return result;
}

function getBudgetUsage_(userId, monthYear, categoryExpenses) {
  const sheet = getSheet_(SHEETS.BUDGETS);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === userId && r[2] === monthYear);

  return rows.map(r => ({
    budgetId:  r[0],
    category:  r[3],
    limit:     parseFloat(r[4]) || 0,
    spent:     categoryExpenses[r[3]] || 0,
  }));
}

function getSavingsSummary_(userId) {
  const sheet = getSheet_(SHEETS.SAVINGS);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === userId && r[7] !== 'completed');

  return rows.slice(0, 4).map(r => ({
    goalId:      r[0],
    name:        r[2],
    target:      parseFloat(r[3]) || 0,
    saved:       parseFloat(r[4]) || 0,
    targetDate:  r[5],
  }));
}

/* ── Salary Functions ───────────────────────────────────── */

function setSalary(data, userId) {
  const { monthYear, expectedAmount, expectedDate, notes } = data;
  if (!monthYear || !expectedAmount) {
    return { success: false, error: 'Month and expected amount are required.' };
  }

  const amt = parseFloat(expectedAmount);
  if (isNaN(amt) || amt <= 0) return { success: false, error: 'Invalid amount.' };

  const sheet  = getSheet_(SHEETS.SALARY);
  const rows   = sheet.getDataRange().getValues().slice(1);

  // Check if already set for this month
  const existing = rows.findIndex(r => r[1] === userId && r[2] === monthYear);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (existing >= 0) {
      // Update existing
      sheet.getRange(existing + 2, 4).setValue(amt);
      if (expectedDate) sheet.getRange(existing + 2, 5).setValue(expectedDate);
      if (notes !== undefined) sheet.getRange(existing + 2, 9).setValue(notes);
      return { success: true, salaryId: rows[existing][0] };
    }

    const salaryId = generateId_('SAL');
    sheet.appendRow([salaryId, userId, monthYear, amt, expectedDate || '', 0, '', 'pending', notes || '', now_()]);
    return { success: true, salaryId };
  } finally {
    lock.releaseLock();
  }
}

function markSalaryReceived(data, userId) {
  const { salaryId, receivedAmount, receivedDate, notes } = data;
  if (!salaryId) return { success: false, error: 'Salary ID required.' };

  const sheet = getSheet_(SHEETS.SALARY);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === salaryId && rows[i][1] === userId) {
      const amt  = parseFloat(receivedAmount) || parseFloat(rows[i][3]);
      const date = receivedDate || new Date().toISOString().split('T')[0];

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.getRange(i + 1, 6).setValue(amt);
        sheet.getRange(i + 1, 7).setValue(date);
        sheet.getRange(i + 1, 8).setValue('received');
        if (notes) sheet.getRange(i + 1, 9).setValue(notes);
      } finally {
        lock.releaseLock();
      }

      // Add as income transaction
      addTransaction({
        type: 'income', amount: amt, category: 'Salary',
        date, description: 'Salary received - ' + rows[i][2], notes: notes || '',
      }, userId);

      return { success: true };
    }
  }

  return { success: false, error: 'Salary record not found.' };
}

function getSalaryHistory(data, userId) {
  const { year } = data;
  const sheet = getSheet_(SHEETS.SALARY);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => {
      if (r[1] !== userId) return false;
      if (year && !r[2].startsWith(String(year))) return false;
      return true;
    });

  const result = rows.map(r => ({
    salaryId:       r[0],
    monthYear:      r[2],
    expectedAmount: r[3],
    expectedDate:   r[4],
    receivedAmount: r[5],
    receivedDate:   r[6],
    status:         r[7],
    notes:          r[8],
  })).sort((a, b) => b.monthYear.localeCompare(a.monthYear));

  return { success: true, history: result };
}

function getSalaryForMonth(data, userId) {
  const { monthYear } = data;
  const sheet = getSheet_(SHEETS.SALARY);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === userId && r[2] === monthYear);

  if (!rows.length) return { success: true, salary: null };

  const r = rows[0];
  return {
    success: true,
    salary: {
      salaryId:       r[0],
      monthYear:      r[2],
      expectedAmount: r[3],
      expectedDate:   r[4],
      receivedAmount: r[5],
      receivedDate:   r[6],
      status:         r[7],
      notes:          r[8],
    },
  };
}

/* ── Budget Functions ───────────────────────────────────── */

function setBudget(data, userId) {
  const { monthYear, category, limitAmount } = data;
  if (!monthYear || !category || !limitAmount) {
    return { success: false, error: 'Month, category, and limit amount are required.' };
  }

  const amt = parseFloat(limitAmount);
  if (isNaN(amt) || amt <= 0) return { success: false, error: 'Invalid limit amount.' };

  const sheet = getSheet_(SHEETS.BUDGETS);
  const rows  = sheet.getDataRange().getValues().slice(1);

  const existing = rows.findIndex(r => r[1] === userId && r[2] === monthYear && r[3] === category);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (existing >= 0) {
      sheet.getRange(existing + 2, 5).setValue(amt);
      return { success: true, budgetId: rows[existing][0] };
    }

    const budgetId = generateId_('BDG');
    sheet.appendRow([budgetId, userId, monthYear, category, amt, now_()]);
    return { success: true, budgetId };
  } finally {
    lock.releaseLock();
  }
}

function getBudgets(data, userId) {
  const { monthYear } = data;
  const my = monthYear || currentMonthYear_();

  const budgetSheet = getSheet_(SHEETS.BUDGETS);
  const budgetRows  = budgetSheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === userId && r[2] === my);

  // Get actual spending for this month per category
  const txSheet = getSheet_(SHEETS.TRANSACTIONS);
  const txRows  = txSheet.getDataRange().getValues().slice(1)
    .filter(r => {
      if (r[1] !== userId || r[2] !== 'expense') return false;
      const d = new Date(r[5]);
      const [yr, mo] = my.split('-').map(Number);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });

  const spending = {};
  txRows.forEach(r => {
    spending[r[4]] = (spending[r[4]] || 0) + (parseFloat(r[3]) || 0);
  });

  const budgets = budgetRows.map(r => ({
    budgetId:    r[0],
    monthYear:   r[2],
    category:    r[3],
    limitAmount: parseFloat(r[4]) || 0,
    spent:       spending[r[3]] || 0,
  }));

  return { success: true, budgets, monthYear: my };
}

function deleteBudget(data, userId) {
  const { budgetId } = data;
  const sheet = getSheet_(SHEETS.BUDGETS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === budgetId && rows[i][1] === userId) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.deleteRow(i + 1);
      } finally {
        lock.releaseLock();
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Budget not found.' };
}

/* ── Savings Goal Functions ─────────────────────────────── */

function createGoal(data, userId) {
  const { goalName, targetAmount, savedAmount, targetDate, notes } = data;
  if (!goalName || !targetAmount) {
    return { success: false, error: 'Goal name and target amount are required.' };
  }

  const target = parseFloat(targetAmount);
  const saved  = parseFloat(savedAmount) || 0;
  if (isNaN(target) || target <= 0) return { success: false, error: 'Invalid target amount.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet  = getSheet_(SHEETS.SAVINGS);
    const goalId = generateId_('GOL');
    sheet.appendRow([goalId, userId, goalName, target, saved, targetDate || '', 'active', notes || '', now_()]);
    return { success: true, goalId };
  } finally {
    lock.releaseLock();
  }
}

function updateGoal(data, userId) {
  const { goalId, goalName, targetAmount, targetDate, notes, status } = data;
  const sheet = getSheet_(SHEETS.SAVINGS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === goalId && rows[i][1] === userId) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        if (goalName    !== undefined) sheet.getRange(i + 1, 3).setValue(goalName);
        if (targetAmount!== undefined) sheet.getRange(i + 1, 4).setValue(parseFloat(targetAmount));
        if (targetDate  !== undefined) sheet.getRange(i + 1, 6).setValue(targetDate);
        if (status      !== undefined) sheet.getRange(i + 1, 7).setValue(status);
        if (notes       !== undefined) sheet.getRange(i + 1, 8).setValue(notes);
      } finally {
        lock.releaseLock();
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Goal not found.' };
}

function contributeToGoal(data, userId) {
  const { goalId, amount, notes } = data;
  const contrib = parseFloat(amount);
  if (isNaN(contrib) || contrib <= 0) return { success: false, error: 'Invalid contribution amount.' };

  const sheet = getSheet_(SHEETS.SAVINGS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === goalId && rows[i][1] === userId) {
      const current = parseFloat(rows[i][4]) || 0;
      const target  = parseFloat(rows[i][3]) || 0;
      const newSaved = Math.min(current + contrib, target);

      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.getRange(i + 1, 5).setValue(newSaved);
        if (newSaved >= target) sheet.getRange(i + 1, 7).setValue('completed');
      } finally {
        lock.releaseLock();
      }

      // Record as expense transaction (money going to savings)
      addTransaction({
        type: 'expense', amount: contrib, category: 'Savings',
        date: new Date().toISOString().split('T')[0],
        description: 'Savings contribution: ' + rows[i][2],
        notes: notes || '',
      }, userId);

      return { success: true, newSaved };
    }
  }

  return { success: false, error: 'Goal not found.' };
}

function getGoals(data, userId) {
  const sheet = getSheet_(SHEETS.SAVINGS);
  const rows  = sheet.getDataRange().getValues().slice(1).filter(r => r[1] === userId);

  const goals = rows.map(r => ({
    goalId:     r[0],
    goalName:   r[2],
    target:     parseFloat(r[3]) || 0,
    saved:      parseFloat(r[4]) || 0,
    targetDate: r[5],
    status:     r[6],
    notes:      r[7],
    createdAt:  r[8],
  })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { success: true, goals };
}

function deleteGoal(data, userId) {
  const { goalId } = data;
  const sheet = getSheet_(SHEETS.SAVINGS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === goalId && rows[i][1] === userId) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.deleteRow(i + 1);
      } finally {
        lock.releaseLock();
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Goal not found.' };
}

/* ── Reports ────────────────────────────────────────────── */

function getMonthlyReport(data, userId) {
  const { monthYear } = data;
  const my = monthYear || currentMonthYear_();
  const [yr, mo] = my.split('-').map(Number);

  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => {
      if (r[1] !== userId) return false;
      const d = new Date(r[5]);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });

  let totalIncome = 0, totalExpense = 0;
  const incomeByCategory = {}, expenseByCategory = {};

  rows.forEach(r => {
    const amt = parseFloat(r[3]) || 0;
    if (r[2] === 'income') {
      totalIncome += amt;
      incomeByCategory[r[4]] = (incomeByCategory[r[4]] || 0) + amt;
    } else {
      totalExpense += amt;
      expenseByCategory[r[4]] = (expenseByCategory[r[4]] || 0) + amt;
    }
  });

  const transactions = rows.map(r => ({
    txId: r[0], type: r[2], amount: r[3], category: r[4],
    date: r[5], description: r[6], paymentMethod: r[7],
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  return {
    success: true,
    report: {
      monthYear: my,
      totalIncome, totalExpense,
      netSavings: totalIncome - totalExpense,
      incomeByCategory, expenseByCategory,
      transactions,
    },
  };
}

function getYearlyReport(data, userId) {
  const { year } = data;
  const yr = parseInt(year) || new Date().getFullYear();

  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === userId && new Date(r[5]).getFullYear() === yr);

  const monthly = {};
  rows.forEach(r => {
    const d  = new Date(r[5]);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const key = `${yr}-${mo}`;
    if (!monthly[key]) monthly[key] = { income: 0, expense: 0 };
    const amt = parseFloat(r[3]) || 0;
    if (r[2] === 'income')  monthly[key].income  += amt;
    if (r[2] === 'expense') monthly[key].expense += amt;
  });

  let totalIncome = 0, totalExpense = 0;
  Object.values(monthly).forEach(m => { totalIncome += m.income; totalExpense += m.expense; });

  return {
    success: true,
    report: {
      year: yr, monthly, totalIncome, totalExpense,
      netSavings: totalIncome - totalExpense,
    },
  };
}

function getCategoryReport(data, userId) {
  const { monthYear, type } = data;
  const my = monthYear || currentMonthYear_();
  const [yr, mo] = my.split('-').map(Number);

  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => {
      if (r[1] !== userId) return false;
      if (type && r[2] !== type) return false;
      const d = new Date(r[5]);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });

  const byCategory = {};
  let total = 0;
  rows.forEach(r => {
    const amt = parseFloat(r[3]) || 0;
    byCategory[r[4]] = (byCategory[r[4]] || 0) + amt;
    total += amt;
  });

  const result = Object.entries(byCategory).map(([cat, amt]) => ({
    category: cat, amount: amt, percentage: total > 0 ? (amt / total * 100).toFixed(1) : 0,
  })).sort((a, b) => b.amount - a.amount);

  return { success: true, categories: result, total };
}

function getDailyReport(data, userId) {
  const { monthYear } = data;
  const my = monthYear || currentMonthYear_();
  const [yr, mo] = my.split('-').map(Number);

  const sheet = getSheet_(SHEETS.TRANSACTIONS);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => {
      if (r[1] !== userId) return false;
      const d = new Date(r[5]);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });

  const daily = {};
  rows.forEach(r => {
    const day = r[5].toString().split('T')[0];
    if (!daily[day]) daily[day] = { income: 0, expense: 0 };
    const amt = parseFloat(r[3]) || 0;
    if (r[2] === 'income')  daily[day].income  += amt;
    if (r[2] === 'expense') daily[day].expense += amt;
  });

  const result = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  return { success: true, daily: result };
}

/* ── Categories ─────────────────────────────────────────── */

const DEFAULT_INCOME_CATS = [
  'Salary','Freelance','Bonus','Business Income',
  'Investment Returns','Gift','Other Income',
];

const DEFAULT_EXPENSE_CATS = [
  'Rent','Food','Groceries','Travel','Petrol',
  'Mobile Recharge','Internet','Fashion','Accessories',
  'Shopping','Medical','Education','Entertainment',
  'Subscriptions','EMI / Loan','Family Expenses',
  'Personal Care','Savings','Other Expenses',
];

function getCategories(data, userId) {
  const sheet = getSheet_(SHEETS.CATEGORIES);
  const rows  = sheet.getDataRange().getValues().slice(1)
    .filter(r => r[1] === userId || r[4] === true); // user's own or defaults

  const userCats  = rows.map(r => ({ catId: r[0], type: r[2], name: r[3], isDefault: r[4] }));
  const incomeCats  = [...new Set([...DEFAULT_INCOME_CATS,  ...userCats.filter(c => c.type === 'income').map(c => c.name)])];
  const expenseCats = [...new Set([...DEFAULT_EXPENSE_CATS, ...userCats.filter(c => c.type === 'expense').map(c => c.name)])];

  return { success: true, income: incomeCats, expense: expenseCats, custom: userCats.filter(c => !c.isDefault) };
}

function addCustomCategory(data, userId) {
  const { name, type } = data;
  if (!name || !type) return { success: false, error: 'Name and type are required.' };
  if (!['income','expense'].includes(type)) return { success: false, error: 'Invalid type.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(SHEETS.CATEGORIES);
    const catId = generateId_('CAT');
    sheet.appendRow([catId, userId, type, name, false, now_()]);
    return { success: true, catId };
  } finally {
    lock.releaseLock();
  }
}

function deleteCategory(data, userId) {
  const { catId } = data;
  const sheet = getSheet_(SHEETS.CATEGORIES);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === catId && rows[i][1] === userId) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.deleteRow(i + 1);
      } finally {
        lock.releaseLock();
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Category not found.' };
}

/* ── Accounts ───────────────────────────────────────────── */

function getAccounts(data, userId) {
  const sheet = getSheet_(SHEETS.ACCOUNTS);
  const rows  = sheet.getDataRange().getValues().slice(1).filter(r => r[1] === userId);

  const accounts = rows.map(r => ({
    accountId:   r[0],
    accountName: r[2],
    accountType: r[3],
    balance:     parseFloat(r[4]) || 0,
  }));

  return { success: true, accounts };
}

function addAccount(data, userId) {
  const { accountName, accountType } = data;
  if (!accountName) return { success: false, error: 'Account name is required.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_(SHEETS.ACCOUNTS);
    const accId = generateId_('ACC');
    sheet.appendRow([accId, userId, accountName, accountType || 'other', 0, now_()]);
    return { success: true, accountId: accId };
  } finally {
    lock.releaseLock();
  }
}

function deleteAccount(data, userId) {
  const { accountId } = data;
  const sheet = getSheet_(SHEETS.ACCOUNTS);
  const rows  = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === accountId && rows[i][1] === userId) {
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        sheet.deleteRow(i + 1);
      } finally {
        lock.releaseLock();
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Account not found.' };
}

/* ── Database Setup ─────────────────────────────────────── */

/**
 * Run this function ONCE from the Apps Script editor to
 * create all required sheets with their column headers.
 */
function setupDatabase() {
  const ss = getSpreadsheet_();

  const schema = {
    [SHEETS.USERS]:        ['UserID','Username','PINHash','FailedAttempts','LockUntil','CreatedAt'],
    [SHEETS.SESSIONS]:     ['SessionToken','UserID','CreatedAt','ExpiresAt','IsValid'],
    [SHEETS.TRANSACTIONS]: ['TxID','UserID','Type','Amount','Category','Date','Description','PaymentMethod','Account','Notes','CreatedAt'],
    [SHEETS.SALARY]:       ['SalaryID','UserID','MonthYear','ExpectedAmount','ExpectedDate','ReceivedAmount','ReceivedDate','Status','Notes','CreatedAt'],
    [SHEETS.BUDGETS]:      ['BudgetID','UserID','MonthYear','Category','LimitAmount','CreatedAt'],
    [SHEETS.SAVINGS]:      ['GoalID','UserID','GoalName','TargetAmount','SavedAmount','TargetDate','Status','Notes','CreatedAt'],
    [SHEETS.ACCOUNTS]:     ['AccountID','UserID','AccountName','AccountType','Balance','CreatedAt'],
    [SHEETS.CATEGORIES]:   ['CatID','UserID','Type','Name','IsDefault','CreatedAt'],
    [SHEETS.SETTINGS]:     ['SettingID','UserID','Key','Value','UpdatedAt'],
  };

  Object.entries(schema).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Write headers only if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1a6b47').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });

  // Delete the default "Sheet1" if it exists
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet) ss.deleteSheet(defaultSheet);

  Logger.log('✅ Database setup complete! All sheets created.');
}

/**
 * Helper to clean up expired sessions (optional – run via trigger)
 */
function cleanupExpiredSessions() {
  const sheet = getSheet_(SHEETS.SESSIONS);
  const rows  = sheet.getDataRange().getValues();
  const now   = new Date();

  // Iterate in reverse to safely delete rows
  for (let i = rows.length - 1; i >= 1; i--) {
    const expiresAt = new Date(rows[i][3]);
    if (expiresAt < now) {
      sheet.deleteRow(i + 1);
    }
  }

  Logger.log('Session cleanup complete.');
}
