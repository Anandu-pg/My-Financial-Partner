/**
 * transactions.js – My Financial Partner
 * Full transaction list with search, date/category/type filters,
 * pagination, edit modal, and delete.
 */

const PAGE_SIZE = 20;
let _allTx = [];
let _filteredTx = [];
let _page = 1;
let _categories = { income: [], expense: [] };
let _accounts = [];
let _currentMY = null; // null = no month filter

/* ── Init ───────────────────────────────────────────────── */

async function initTransactions() {
  // Load categories and accounts in parallel
  const [catRes, accRes] = await Promise.all([
    Categories.getAll(),
    Accounts.getAll(),
  ]);

  if (catRes.success) {
    _categories = { income: catRes.income || [], expense: catRes.expense || [] };
    populateCategoryFilter();
  }

  if (accRes.success) {
    _accounts = accRes.accounts || [];
  }

  // Month selector (optional)
  createMonthSelector('monthSelectorWrap', getCurrentMonthYear(), (my) => {
    _currentMY = my;
    _page = 1;
    applyFilters();
  });

  // Event listeners
  const search   = document.getElementById('searchInput');
  const typeF    = document.getElementById('typeFilter');
  const catF     = document.getElementById('categoryFilter');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo   = document.getElementById('dateTo');
  const clearBtn = document.getElementById('clearFilters');

  search?.addEventListener('input', debounce(() => { _page = 1; applyFilters(); }));
  typeF?.addEventListener('change', () => { _page = 1; populateCategoryFilter(); applyFilters(); });
  catF?.addEventListener('change',  () => { _page = 1; applyFilters(); });
  dateFrom?.addEventListener('change', () => { _page = 1; applyFilters(); });
  dateTo?.addEventListener('change',   () => { _page = 1; applyFilters(); });

  clearBtn?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';
    _currentMY = null;
    _page = 1;
    applyFilters();
  });

  // Load all transactions
  await loadTransactions();
}

/* ── Load ───────────────────────────────────────────────── */

async function loadTransactions() {
  const wrap = document.getElementById('txTableWrap');
  wrap.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>';

  const result = await Transactions.getAll({});

  if (!result.success) {
    showToast(result.error || 'Failed to load transactions.', 'error');
    return;
  }

  _allTx = result.transactions || [];
  applyFilters();
}

/* ── Filter / Search ────────────────────────────────────── */

function applyFilters() {
  const search   = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const type     = document.getElementById('typeFilter')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const dateFrom = document.getElementById('dateFrom')?.value || '';
  const dateTo   = document.getElementById('dateTo')?.value   || '';

  _filteredTx = _allTx.filter(tx => {
    if (type && tx.type !== type) return false;
    if (category && tx.category !== category) return false;
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo   && tx.date > dateTo)   return false;
    if (_currentMY) {
      const [yr, mo] = _currentMY.split('-').map(Number);
      const d = new Date(tx.date);
      if (d.getFullYear() !== yr || d.getMonth() + 1 !== mo) return false;
    }
    if (search) {
      const hay = [tx.description, tx.category, tx.notes, tx.paymentMethod]
        .map(v => (v || '').toLowerCase()).join(' ');
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  updateSummaryBar();
  renderTable();
  renderPagination();
}

function populateCategoryFilter() {
  const sel  = document.getElementById('categoryFilter');
  const type = document.getElementById('typeFilter')?.value || '';
  if (!sel) return;

  let cats = [];
  if (!type || type === 'income')  cats = [...cats, ..._categories.income];
  if (!type || type === 'expense') cats = [...cats, ..._categories.expense];
  cats = [...new Set(cats)].sort();

  sel.innerHTML = '<option value="">All Categories</option>' +
    cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function updateSummaryBar() {
  let income = 0, expense = 0;
  _filteredTx.forEach(tx => {
    if (tx.type === 'income')  income  += parseFloat(tx.amount) || 0;
    if (tx.type === 'expense') expense += parseFloat(tx.amount) || 0;
  });

  const countEl   = document.getElementById('txCount');
  const incomeEl  = document.getElementById('totalIncome');
  const expenseEl = document.getElementById('totalExpense');

  if (countEl)   countEl.textContent   = _filteredTx.length;
  if (incomeEl)  incomeEl.textContent  = '↑ ' + formatCurrency(income);
  if (expenseEl) expenseEl.textContent = '↓ ' + formatCurrency(expense);
}

/* ── Render Table ───────────────────────────────────────── */

function renderTable() {
  const wrap = document.getElementById('txTableWrap');
  if (!wrap) return;

  const start = (_page - 1) * PAGE_SIZE;
  const pageData = _filteredTx.slice(start, start + PAGE_SIZE);

  if (!pageData.length) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="search" style="width:28px;height:28px"></i></div>
        <div class="empty-title">No transactions found</div>
        <div class="empty-desc">Try adjusting your filters or add a new transaction.</div>
      </div>`;
    lucide.createIcons();
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Description</th>
          <th>Payment</th>
          <th class="text-right">Amount</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${pageData.map(tx => `
          <tr id="tx-${tx.txId}">
            <td style="white-space:nowrap;color:var(--text-muted);font-size:.78rem">${formatDate(tx.date)}</td>
            <td>
              <span class="badge ${tx.type === 'income' ? 'badge-success' : 'badge-danger'}">
                <i data-lucide="${tx.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'}" style="width:10px;height:10px"></i>
                ${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
              </span>
            </td>
            <td><span class="cat-chip">${escapeHtml(tx.category || '—')}</span></td>
            <td style="font-size:.83rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${escapeHtml(tx.description || '—')}
            </td>
            <td style="font-size:.78rem;color:var(--text-muted)">${escapeHtml(tx.paymentMethod || '—')}</td>
            <td class="text-right td-amount ${tx.type === 'income' ? 'td-income' : 'td-expense'}">
              ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
            </td>
            <td class="text-right" style="white-space:nowrap">
              <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditModal('${tx.txId}')" title="Edit">
                <i data-lucide="pencil" style="width:15px;height:15px"></i>
              </button>
              <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteTx('${tx.txId}')" title="Delete"
                style="color:var(--danger)">
                <i data-lucide="trash-2" style="width:15px;height:15px"></i>
              </button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  lucide.createIcons();
}

/* ── Pagination ─────────────────────────────────────────── */

function renderPagination() {
  const total = Math.ceil(_filteredTx.length / PAGE_SIZE);
  const pag   = document.getElementById('pagination');
  if (!pag) return;

  if (total <= 1) { pag.innerHTML = ''; return; }

  let html = `<button class="btn btn-secondary btn-sm" onclick="goPage(${_page - 1})" ${_page === 1 ? 'disabled' : ''}>
    <i data-lucide="chevron-left" style="width:14px;height:14px"></i>
  </button>`;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - _page) <= 1) {
      html += `<button class="btn btn-sm ${i === _page ? 'btn-primary' : 'btn-secondary'}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - _page) === 2) {
      html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    }
  }

  html += `<button class="btn btn-secondary btn-sm" onclick="goPage(${_page + 1})" ${_page === total ? 'disabled' : ''}>
    <i data-lucide="chevron-right" style="width:14px;height:14px"></i>
  </button>`;

  pag.innerHTML = html;
  lucide.createIcons();
}

function goPage(p) {
  const total = Math.ceil(_filteredTx.length / PAGE_SIZE);
  if (p < 1 || p > total) return;
  _page = p;
  renderTable();
  renderPagination();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Edit Modal ─────────────────────────────────────────── */

function openEditModal(txId) {
  const tx = _allTx.find(t => t.txId === txId);
  if (!tx) return;

  // Populate form
  document.getElementById('editTxId').value       = tx.txId;
  document.getElementById('editType').value        = tx.type;
  document.getElementById('editAmount').value      = tx.amount;
  document.getElementById('editDate').value        = tx.date ? tx.date.split('T')[0] : '';
  document.getElementById('editDescription').value = tx.description || '';
  document.getElementById('editPaymentMethod').value = tx.paymentMethod || 'Cash';
  document.getElementById('editNotes').value       = tx.notes || '';

  // Populate category dropdown
  const catSel = document.getElementById('editCategory');
  const cats   = tx.type === 'income' ? _categories.income : _categories.expense;
  catSel.innerHTML = cats.map(c =>
    `<option value="${escapeHtml(c)}" ${c === tx.category ? 'selected' : ''}>${escapeHtml(c)}</option>`
  ).join('');

  // Populate account dropdown
  const accSel = document.getElementById('editAccount');
  accSel.innerHTML = '<option value="">— None —</option>' + _accounts.map(a =>
    `<option value="${escapeHtml(a.accountName)}" ${a.accountName === tx.account ? 'selected' : ''}>
      ${escapeHtml(a.accountName)}
    </option>`
  ).join('');

  // Re-populate categories when type changes
  document.getElementById('editType').onchange = () => {
    const type = document.getElementById('editType').value;
    const cs   = type === 'income' ? _categories.income : _categories.expense;
    catSel.innerHTML = cs.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  };

  openModal('editModal');
  lucide.createIcons();
}

async function saveEditTransaction() {
  const txId          = document.getElementById('editTxId').value;
  const type          = document.getElementById('editType').value;
  const amount        = document.getElementById('editAmount').value;
  const category      = document.getElementById('editCategory').value;
  const date          = document.getElementById('editDate').value;
  const description   = document.getElementById('editDescription').value;
  const paymentMethod = document.getElementById('editPaymentMethod').value;
  const account       = document.getElementById('editAccount').value;
  const notes         = document.getElementById('editNotes').value;

  if (!amount || isNaN(parseFloat(amount))) {
    showToast('Please enter a valid amount.', 'error');
    return;
  }

  const saveBtn = document.getElementById('saveEditBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const result = await Transactions.update(txId, {
    type, amount: parseFloat(amount), category, date, description, paymentMethod, account, notes,
  });

  saveBtn.disabled = false;
  saveBtn.innerHTML = '<i data-lucide="check"></i> Save Changes';
  lucide.createIcons();

  if (result.success) {
    closeModal('editModal');
    showToast('Transaction updated.', 'success');
    await loadTransactions();
  } else {
    showToast(result.error || 'Failed to update.', 'error');
  }
}

/* ── Delete ─────────────────────────────────────────────── */

async function deleteTx(txId) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;

  const result = await Transactions.delete(txId);
  if (result.success) {
    showToast('Transaction deleted.', 'success');
    _allTx = _allTx.filter(t => t.txId !== txId);
    applyFilters();
  } else {
    showToast(result.error || 'Failed to delete.', 'error');
  }
}
