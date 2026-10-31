/**
 * api.js – My Financial Partner
 * Central API layer for all communication with the Google Apps Script backend.
 *
 * ── SETUP ──────────────────────────────────────────────────
 * After deploying your Google Apps Script Web App, paste the
 * deployment URL below (replace the placeholder string).
 * ──────────────────────────────────────────────────────────
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwyzY8wLGrH_b2hyZhWz4Nlx88SgV-Au4hAMt2EQiKiEMYull_UlSBHJBWLCqP-KJHoXA/exec';
// Example: 'https://script.google.com/macros/s/AKfycb.../exec'

/* ── Session helpers ──────────────────────────────────── */

function getSessionToken() {
  return sessionStorage.getItem('mfp_token') || null;
}

function setSessionToken(token) {
  sessionStorage.setItem('mfp_token', token);
}

function clearSession() {
  sessionStorage.removeItem('mfp_token');
  sessionStorage.removeItem('mfp_user');
}

function getSessionUser() {
  try {
    const raw = sessionStorage.getItem('mfp_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSessionUser(user) {
  sessionStorage.setItem('mfp_user', JSON.stringify(user));
}

/* ── Core request function ────────────────────────────── */

/**
 * Send a POST request to the GAS Web App.
 * The session token is automatically injected when available.
 *
 * @param {string} action  - The API action identifier (e.g. 'login')
 * @param {object} payload - Additional data to include in the request body
 * @returns {Promise<object>} Parsed JSON response from GAS
 */
async function callAPI(action, payload = {}) {
  if (!GAS_URL || GAS_URL === 'YOUR_GAS_WEB_APP_URL_HERE') {
    console.error('GAS_URL not configured. Edit js/api.js and set your Web App URL.');
    return { success: false, error: 'Backend not configured. Please contact the administrator.' };
  }

  const token = getSessionToken();
  const body = JSON.stringify({ action, token, ...payload });

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      // GAS requires text/plain for CORS-safe POST requests
      headers: { 'Content-Type': 'text/plain' },
      body,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error('Non-JSON response from GAS:', text);
      return { success: false, error: 'Unexpected server response.' };
    }
  } catch (err) {
    console.error(`API error [${action}]:`, err);
    return { success: false, error: err.message || 'Network error. Please check your connection.' };
  }
}

/* ── Auth APIs ────────────────────────────────────────── */

const Auth = {
  checkUsername: (username) =>
    callAPI('checkUsername', { username }),

  register: (username, pin) =>
    callAPI('register', { username, pin }),

  login: (username, pin) =>
    callAPI('login', { username, pin }),

  logout: () =>
    callAPI('logout'),

  validateSession: () =>
    callAPI('validateSession'),
};

/* ── Transaction APIs ─────────────────────────────────── */

const Transactions = {
  add: (data) =>
    callAPI('addTransaction', data),

  getAll: (filters = {}) =>
    callAPI('getTransactions', { filters }),

  update: (txId, data) =>
    callAPI('updateTransaction', { txId, ...data }),

  delete: (txId) =>
    callAPI('deleteTransaction', { txId }),
};

/* ── Dashboard APIs ───────────────────────────────────── */

const Dashboard = {
  getSummary: (monthYear) =>
    callAPI('getDashboardSummary', { monthYear }),
};

/* ── Salary APIs ──────────────────────────────────────── */

const Salary = {
  set: (data) =>
    callAPI('setSalary', data),

  markReceived: (salaryId, data) =>
    callAPI('markSalaryReceived', { salaryId, ...data }),

  getHistory: (year) =>
    callAPI('getSalaryHistory', { year }),

  getForMonth: (monthYear) =>
    callAPI('getSalaryForMonth', { monthYear }),
};

/* ── Budget APIs ──────────────────────────────────────── */

const Budgets = {
  set: (data) =>
    callAPI('setBudget', data),

  getAll: (monthYear) =>
    callAPI('getBudgets', { monthYear }),

  delete: (budgetId) =>
    callAPI('deleteBudget', { budgetId }),
};

/* ── Savings APIs ─────────────────────────────────────── */

const Savings = {
  create: (data) =>
    callAPI('createGoal', data),

  update: (goalId, data) =>
    callAPI('updateGoal', { goalId, ...data }),

  contribute: (goalId, amount, notes) =>
    callAPI('contributeToGoal', { goalId, amount, notes }),

  getAll: () =>
    callAPI('getGoals'),

  delete: (goalId) =>
    callAPI('deleteGoal', { goalId }),
};

/* ── Report APIs ──────────────────────────────────────── */

const Reports = {
  getMonthly: (monthYear) =>
    callAPI('getMonthlyReport', { monthYear }),

  getYearly: (year) =>
    callAPI('getYearlyReport', { year }),

  getCategory: (monthYear, type) =>
    callAPI('getCategoryReport', { monthYear, type }),

  getDaily: (monthYear) =>
    callAPI('getDailyReport', { monthYear }),
};

/* ── Category APIs ────────────────────────────────────── */

const Categories = {
  getAll: () =>
    callAPI('getCategories'),

  addCustom: (name, type) =>
    callAPI('addCustomCategory', { name, type }),

  delete: (catId) =>
    callAPI('deleteCategory', { catId }),
};

/* ── Account APIs ─────────────────────────────────────── */

const Accounts = {
  getAll: () =>
    callAPI('getAccounts'),

  add: (data) =>
    callAPI('addAccount', data),

  delete: (accountId) =>
    callAPI('deleteAccount', { accountId }),
};
