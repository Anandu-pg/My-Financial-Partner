/**
 * auth.js – My Financial Partner
 * Handles registration, login, logout, session validation,
 * and page-level authentication guards.
 */

/* ── Session Guard ──────────────────────────────────────── */

/**
 * Redirect to login if no valid session token exists.
 * Call this at the top of every protected page.
 */
function requireAuth() {
  const token = getSessionToken();
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/**
 * Redirect to dashboard if user is already logged in.
 * Call this on login/register pages.
 */
function redirectIfAuthenticated() {
  const token = getSessionToken();
  if (token) {
    window.location.href = 'dashboard.html';
  }
}

/* ── PIN Input Helpers ───────────────────────────────────── */

function setupPinInputs(containerSelector) {
  const inputs = document.querySelectorAll(`${containerSelector} .pin-digit`);
  inputs.forEach((input, idx) => {
    input.addEventListener('input', e => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val.slice(-1); // keep only last digit
      if (val && idx < inputs.length - 1) inputs[idx + 1].focus();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = '';
      }
    });

    input.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
      pasted.split('').forEach((ch, i) => {
        if (inputs[i]) inputs[i].value = ch;
      });
      if (inputs[Math.min(pasted.length, inputs.length - 1)]) {
        inputs[Math.min(pasted.length, inputs.length - 1)].focus();
      }
    });
  });
}

function getPinValue(containerSelector) {
  const inputs = document.querySelectorAll(`${containerSelector} .pin-digit`);
  return Array.from(inputs).map(i => i.value).join('');
}

function clearPinInputs(containerSelector) {
  const inputs = document.querySelectorAll(`${containerSelector} .pin-digit`);
  inputs.forEach(i => { i.value = ''; });
  if (inputs[0]) inputs[0].focus();
}

/* ── Form Utilities ─────────────────────────────────────── */

function setFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (field) field.classList.add('error');

  const errorEl = document.getElementById(fieldId + 'Error');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'flex';
  }
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (field) field.classList.remove('error');

  const errorEl = document.getElementById(fieldId + 'Error');
  if (errorEl) errorEl.style.display = 'none';
}

function clearAllErrors(form) {
  form.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.form-error').forEach(el => { el.style.display = 'none'; });
}

function setGlobalError(message) {
  const el = document.getElementById('globalError');
  if (el) {
    const span = el.querySelector('span');
    if (span) span.textContent = message;
    else el.childNodes[el.childNodes.length - 1].textContent = message;
    el.style.display = 'flex';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function clearGlobalError() {
  const el = document.getElementById('globalError');
  if (el) {
    const span = el.querySelector('span');
    if (span) span.textContent = '';
    el.style.display = 'none';
  }
}

function setButtonLoading(btnId, loading, defaultText = 'Submit') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? `<div class="spinner" style="width:18px;height:18px;border-width:2px"></div> Please wait…`
    : defaultText;
}

/* ── Username Availability Check ────────────────────────── */

let _usernameCheckTimer = null;

async function checkUsernameAvailability(username, statusElId) {
  const statusEl = document.getElementById(statusElId);
  if (!statusEl) return;

  if (!username || username.length < 3) {
    statusEl.textContent = '';
    return;
  }

  statusEl.textContent = 'Checking…';
  statusEl.style.color = 'var(--text-muted)';

  clearTimeout(_usernameCheckTimer);
  _usernameCheckTimer = setTimeout(async () => {
    const result = await Auth.checkUsername(username);
    if (result.success) {
      if (result.available) {
        statusEl.textContent = '✓ Username is available';
        statusEl.style.color = 'var(--success)';
      } else {
        statusEl.textContent = '✗ Username already exists. Please choose another username.';
        statusEl.style.color = 'var(--danger)';
      }
    }
  }, 600);
}

/* ── Register Page ──────────────────────────────────────── */

function initRegisterPage() {
  redirectIfAuthenticated();
  initTheme();
  if (typeof lucide !== 'undefined') lucide.createIcons();

  setupPinInputs('#pinRow');
  setupPinInputs('#confirmPinRow');

  const usernameInput = document.getElementById('username');
  usernameInput?.addEventListener('input', e => {
    checkUsernameAvailability(e.target.value.trim(), 'usernameStatus');
    clearFieldError('username');
  });

  const form = document.getElementById('registerForm');
  form?.addEventListener('submit', handleRegister);

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const theme = document.documentElement.getAttribute('data-theme');
    renderThemeIcon(theme);
    themeBtn.addEventListener('click', toggleTheme);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  clearGlobalError();

  const username   = document.getElementById('username')?.value.trim();
  const pin        = getPinValue('#pinRow');
  const confirmPin = getPinValue('#confirmPinRow');

  let valid = true;

  if (!username || username.length < 3) {
    setFieldError('username', 'Username must be at least 3 characters.');
    valid = false;
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    setFieldError('username', 'Only letters, numbers, and underscores allowed.');
    valid = false;
  }

  if (pin.length !== 4) {
    setGlobalError('Please enter a 4-digit PIN.');
    valid = false;
  } else if (pin !== confirmPin) {
    setGlobalError('PINs do not match. Please try again.');
    clearPinInputs('#confirmPinRow');
    valid = false;
  }

  if (!valid) return;

  setButtonLoading('registerBtn', true, 'Create Account');

  const result = await Auth.register(username, pin);

  setButtonLoading('registerBtn', false, 'Create Account');

  if (result.success) {
    setSessionToken(result.token);
    setSessionUser(result.user);
    showToast('Account created successfully! Welcome aboard 🎉', 'success', 'Success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
  } else {
    setGlobalError(result.error || 'Registration failed. Please try again.');
  }
}

/* ── Login Page ─────────────────────────────────────────── */

function initLoginPage() {
  redirectIfAuthenticated();
  initTheme();
  if (typeof lucide !== 'undefined') lucide.createIcons();

  setupPinInputs('#pinRow');

  const usernameInput = document.getElementById('username');
  usernameInput?.addEventListener('input', () => clearGlobalError());

  const form = document.getElementById('loginForm');
  form?.addEventListener('submit', handleLogin);

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const theme = document.documentElement.getAttribute('data-theme');
    renderThemeIcon(theme);
    themeBtn.addEventListener('click', toggleTheme);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  clearGlobalError();

  const username = document.getElementById('username')?.value.trim();
  const pin      = getPinValue('#pinRow');

  if (!username) {
    setGlobalError('Please enter your username.');
    return;
  }
  if (pin.length !== 4) {
    setGlobalError('Please enter your 4-digit PIN.');
    return;
  }

  setButtonLoading('loginBtn', true, 'Sign In');

  const result = await Auth.login(username, pin);

  setButtonLoading('loginBtn', false, 'Sign In');

  if (result.success) {
    setSessionToken(result.token);
    setSessionUser(result.user);
    window.location.href = 'dashboard.html';
  } else {
    setGlobalError(result.error || 'Login failed. Please try again.');
    clearPinInputs('#pinRow');
  }
}
