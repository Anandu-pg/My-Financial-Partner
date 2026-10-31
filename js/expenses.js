/**
 * expenses.js – My Financial Partner
 * Add expense form and recent expenses list.
 */

async function initExpensePage() {
  // Set today's date
  const dateInput = document.getElementById('expDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  // Load accounts
  const accRes = await Accounts.getAll();
  if (accRes.success) {
    const accSel = document.getElementById('expAccount');
    accRes.accounts.forEach(a => {
      accSel.innerHTML += `<option value="${escapeHtml(a.accountName)}">${escapeHtml(a.accountName)}</option>`;
    });
  }

  // Load custom expense categories
  const catRes = await Categories.getAll();
  if (catRes.success && catRes.custom?.length) {
    const catSel = document.getElementById('expCategory');
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom';
    catRes.custom.filter(c => c.type === 'expense').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      customGroup.appendChild(opt);
    });
    if (customGroup.children.length) catSel.appendChild(customGroup);
  }

  // Add custom option
  document.getElementById('expCategory').innerHTML +=
    `<option value="__custom__">+ Add custom category</option>`;

  // Toggle custom category input
  document.getElementById('expCategory').addEventListener('change', function () {
    const wrap = document.getElementById('expCustomCatWrap');
    wrap.style.display = this.value === '__custom__' ? 'block' : 'none';
  });

  // Form submit
  document.getElementById('expenseForm').addEventListener('submit', handleAddExpense);

  // Load recent expenses
  loadRecentExpenses();
}

async function handleAddExpense(e) {
  e.preventDefault();

  const errEl = document.getElementById('expError');
  errEl.style.display = 'none';

  const amount      = parseFloat(document.getElementById('expAmount').value);
  let   category    = document.getElementById('expCategory').value;
  const customCat   = document.getElementById('expCustomCategory')?.value.trim();
  const date        = document.getElementById('expDate').value;
  const description = document.getElementById('expDescription').value.trim();
  const payMethod   = document.getElementById('expPaymentMethod').value;
  const account     = document.getElementById('expAccount').value;
  const notes       = document.getElementById('expNotes').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showExpError('Please enter a valid amount greater than 0.');
    return;
  }
  if (!category) {
    showExpError('Please select a category.');
    return;
  }
  if (category === '__custom__') {
    if (!customCat) {
      showExpError('Please enter a custom category name.');
      return;
    }
    const catRes = await Categories.addCustom(customCat, 'expense');
    category = catRes.success ? customCat : customCat;
  }
  if (!date) {
    showExpError('Please select a date.');
    return;
  }

  setButtonLoading('expSubmitBtn', true, 'Add Expense');

  const result = await Transactions.add({
    type: 'expense', amount, category, date, description, paymentMethod: payMethod, account, notes,
  });

  setButtonLoading('expSubmitBtn', false,
    '<i data-lucide="minus-circle"></i> Add Expense');
  lucide.createIcons();

  if (result.success) {
    showToast(`Expense of ${formatCurrency(amount)} recorded!`, 'success', 'Expense Added');
    document.getElementById('expenseForm').reset();
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expCustomCatWrap').style.display = 'none';
    loadRecentExpenses();
  } else {
    showExpError(result.error || 'Failed to add expense. Please try again.');
  }
}

function showExpError(msg) {
  const errEl = document.getElementById('expError');
  errEl.querySelector('span').textContent = msg;
  errEl.style.display = 'flex';
}

async function loadRecentExpenses() {
  const container = document.getElementById('recentExpenseList');
  if (!container) return;

  const result = await Transactions.getAll({ filters: { type: 'expense' } });

  if (!result.success) {
    container.innerHTML = `<p style="color:var(--danger);font-size:.83rem">Failed to load.</p>`;
    return;
  }

  const txs = (result.transactions || []).slice(0, 15);

  if (!txs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="shopping-cart" style="width:28px;height:28px"></i></div>
        <div class="empty-title">No expenses yet</div>
        <div class="empty-desc">Track your first expense using the form.</div>
      </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Method</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${txs.map(tx => `
            <tr>
              <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(tx.date)}</td>
              <td><span class="cat-chip">${escapeHtml(tx.category)}</span></td>
              <td style="font-size:.82rem">${escapeHtml(tx.description || '—')}</td>
              <td style="font-size:.75rem;color:var(--text-muted)">${escapeHtml(tx.paymentMethod || '—')}</td>
              <td class="text-right td-amount td-expense">-${formatCurrency(tx.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
