/**
 * app.js – My Financial Partner
 * Shared utilities: navigation, theme toggle, toasts, formatters,
 * modal management, and page initialization.
 */

/* ── Constants ──────────────────────────────────────────── */
const APP_NAME = 'My Financial Partner';

const NAV_ITEMS = [
  { href: 'dashboard.html', icon: 'layout-dashboard', label: 'Dashboard',    section: 'main' },
  { href: 'transactions.html', icon: 'list',          label: 'Transactions', section: 'main' },
  { href: 'income.html',    icon: 'trending-up',      label: 'Income',       section: 'finance' },
  { href: 'expenses.html',  icon: 'trending-down',    label: 'Expenses',     section: 'finance' },
  { href: 'salary.html',    icon: 'briefcase',        label: 'Salary',       section: 'finance' },
  { href: 'budgets.html',   icon: 'target',           label: 'Budgets',      section: 'planning' },
  { href: 'savings.html',   icon: 'piggy-bank',       label: 'Savings Goals',section: 'planning' },
  { href: 'reports.html',   icon: 'bar-chart-2',      label: 'Reports',      section: 'planning' },
];

const BOTTOM_NAV_ITEMS = [
  { href: 'dashboard.html',    icon: 'layout-dashboard', label: 'Home'   },
  { href: 'transactions.html', icon: 'list',              label: 'History'},
  { href: 'income.html',       icon: 'plus-circle',       label: 'Add',   fab: true },
  { href: 'budgets.html',      icon: 'target',            label: 'Budget' },
  { href: 'reports.html',      icon: 'bar-chart-2',       label: 'Reports'},
];

/* ── Currency Formatter ─────────────────────────────────── */
function formatCurrency(amount, symbol = '₹') {
  const num = parseFloat(amount) || 0;
  return symbol + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrencyShort(amount, symbol = '₹') {
  const num = Math.abs(parseFloat(amount) || 0);
  if (num >= 10000000) return symbol + (num / 10000000).toFixed(1) + 'Cr';
  if (num >= 100000)   return symbol + (num / 100000).toFixed(1) + 'L';
  if (num >= 1000)     return symbol + (num / 1000).toFixed(1) + 'K';
  return symbol + num.toFixed(0);
}

/* ── Date Formatters ────────────────────────────────────── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonthYear(my) {
  if (!my) return '';
  const [yr, mo] = my.split('-');
  const d = new Date(parseInt(yr), parseInt(mo) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}

function getCurrentMonthYear() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function offsetMonthYear(my, delta) {
  const [yr, mo] = my.split('-').map(Number);
  const d = new Date(yr, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── Theme ──────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('mfp_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next    = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('mfp_theme', next);
  // Update toggle icon
  renderThemeIcon(next);
}

function renderThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<i data-lucide="sun" style="width:18px;height:18px"></i>'
    : '<i data-lucide="moon" style="width:18px;height:18px"></i>';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── Sidebar ────────────────────────────────────────────── */
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const user = getSessionUser ? getSessionUser() : null;
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  const sections = { main: 'Main', finance: 'Finance', planning: 'Planning & Goals' };
  const sectionHTML = {};

  NAV_ITEMS.forEach(item => {
    const active = item.href === currentPage ? 'active' : '';
    const html = `
      <a href="${item.href}" class="nav-item ${active}" id="nav-${item.href.replace('.html','')}">
        <i data-lucide="${item.icon}"></i>
        <span>${item.label}</span>
      </a>`;
    sectionHTML[item.section] = (sectionHTML[item.section] || '') + html;
  });

  const initials = user ? user.username.substring(0, 2).toUpperCase() : 'U';
  const username  = user ? user.username : 'User';

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <div class="brand-logo">
        <div class="brand-icon"><i data-lucide="wallet" style="width:20px;height:20px;color:white"></i></div>
        <div>
          <div class="brand-name">My Financial</div>
          <div class="brand-tagline">Partner</div>
        </div>
      </div>
    </div>

    <nav class="sidebar-nav" id="sidebarNav">
      <div class="nav-section-label">Main</div>
      ${sectionHTML.main || ''}
      <div class="nav-section-label">Finance</div>
      ${sectionHTML.finance || ''}
      <div class="nav-section-label">Planning</div>
      ${sectionHTML.planning || ''}
    </nav>

    <div class="sidebar-footer">
      <div class="user-card" id="userMenuBtn">
        <div class="user-avatar">${initials}</div>
        <div class="user-info">
          <div class="user-name">${escapeHtml(username)}</div>
          <div class="user-status">● Online</div>
        </div>
        <i data-lucide="log-out" style="width:15px;height:15px;color:rgba(255,255,255,.4)"></i>
      </div>
    </div>`;

  // Logout via user card
  document.getElementById('userMenuBtn')?.addEventListener('click', confirmLogout);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── Bottom Navigation ──────────────────────────────────── */
function renderBottomNav() {
  const nav = document.getElementById('bottomNav');
  if (!nav) return;

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';

  nav.innerHTML = `<div class="bottom-nav-inner">` +
    BOTTOM_NAV_ITEMS.map(item => {
      const active = item.href === currentPage ? 'active' : '';
      if (item.fab) {
        return `
          <div class="bottom-nav-fab">
            <a href="${item.href}" class="fab-btn" title="${item.label}">
              <i data-lucide="plus" style="width:22px;height:22px;color:white"></i>
            </a>
          </div>`;
      }
      return `
        <a href="${item.href}" class="bottom-nav-item ${active}">
          <i data-lucide="${item.icon}"></i>
          <span>${item.label}</span>
        </a>`;
    }).join('') + '</div>';

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── Page Header ────────────────────────────────────────── */
function renderPageHeader(title) {
  const header = document.getElementById('pageHeader');
  if (!header) return;

  header.innerHTML = `
    <div class="d-flex align-center gap-8">
      <button class="menu-toggle" id="menuToggle" aria-label="Open menu">
        <i data-lucide="menu" style="width:20px;height:20px"></i>
      </button>
      <h1 class="page-title">${title}</h1>
    </div>
    <div class="header-actions">
      <button class="theme-toggle" id="themeToggle" title="Toggle theme" onclick="toggleTheme()">
        <i data-lucide="moon" style="width:18px;height:18px"></i>
      </button>
    </div>`;

  // Mobile sidebar toggle
  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);

  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  renderThemeIcon(theme);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── Sidebar toggle (mobile) ────────────────────────────── */
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('open');
}

function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

/* ── Toast Notifications ────────────────────────────────── */
let _toastContainer = null;

function ensureToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.getElementById('toastContainer');
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.id = 'toastContainer';
      _toastContainer.className = 'toast-container';
      document.body.appendChild(_toastContainer);
    }
  }
  return _toastContainer;
}

const TOAST_ICONS = {
  success: 'check-circle',
  error:   'x-circle',
  warning: 'alert-triangle',
  info:    'info',
};

function showToast(message, type = 'info', title = null, duration = 4000) {
  const container = ensureToastContainer();
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${TOAST_ICONS[type] || 'info'}"></i>
    </div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;margin-left:8px;border-radius:4px" title="Close">
      <i data-lucide="x" style="width:14px;height:14px"></i>
    </button>`;

  container.appendChild(toast);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

/* ── Modal ──────────────────────────────────────────────── */
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}

function createModal({ id, title, bodyHTML, footerHTML, size = '' }) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = `
    <div class="modal ${size}">
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" onclick="closeModal('${id}')">
          <i data-lucide="x" style="width:16px;height:16px"></i>
        </button>
      </div>
      <div class="modal-body">${bodyHTML}</div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>`;

  // Close on overlay click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(id);
  });

  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons();
  return overlay;
}

/* ── Loading State ──────────────────────────────────────── */
function showLoading(containerId, message = 'Loading...') {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div class="loading-overlay">
        <div class="spinner"></div>
        <span>${message}</span>
      </div>`;
  }
}

function showEmpty(containerId, icon = 'inbox', title = 'Nothing here yet', desc = '') {
  const el = document.getElementById(containerId);
  if (el) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="${icon}" style="width:32px;height:32px"></i></div>
        <div class="empty-title">${title}</div>
        ${desc ? `<div class="empty-desc">${desc}</div>` : ''}
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

/* ── Logout ──────────────────────────────────────────────── */
function confirmLogout() {
  if (confirm('Are you sure you want to log out?')) {
    performLogout();
  }
}

async function performLogout() {
  try {
    await Auth.logout();
  } catch (e) { /* ignore */ }
  clearSession();
  window.location.href = 'login.html';
}

/* ── Helper: HTML escape ────────────────────────────────── */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ── Category Color Map ─────────────────────────────────── */
const CATEGORY_COLORS = [
  '#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#ec4899','#84cc16','#f97316','#6366f1',
  '#14b8a6','#a855f7','#eab308','#22c55e','#fb923c',
];

function getCategoryColor(category, index = 0) {
  if (!category) return CATEGORY_COLORS[0];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

/* ── Standard page init ─────────────────────────────────── */
function initPage(title) {
  initTheme();
  renderSidebar();
  renderPageHeader(title);
  renderBottomNav();

  // Sidebar overlay click
  document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ── Month Selector Component ───────────────────────────── */
function createMonthSelector(containerId, currentMY, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const render = (my) => {
    el.innerHTML = `
      <div class="month-selector">
        <button class="month-btn" id="ms-prev" title="Previous month">
          <i data-lucide="chevron-left" style="width:16px;height:16px"></i>
        </button>
        <span class="month-label">${formatMonthYear(my)}</span>
        <button class="month-btn" id="ms-next" title="Next month">
          <i data-lucide="chevron-right" style="width:16px;height:16px"></i>
        </button>
      </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.getElementById('ms-prev')?.addEventListener('click', () => {
      currentMY = offsetMonthYear(currentMY, -1);
      render(currentMY);
      onChange(currentMY);
    });

    const nextMY = offsetMonthYear(currentMY, 1);
    const maxMY  = getCurrentMonthYear();
    const nextBtn = document.getElementById('ms-next');
    if (nextMY > maxMY && nextBtn) {
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.4';
    } else {
      nextBtn?.addEventListener('click', () => {
        currentMY = offsetMonthYear(currentMY, 1);
        render(currentMY);
        onChange(currentMY);
      });
    }
  };

  render(currentMY);
}

/* ── Debounce ─────────────────────────────────────────────── */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
