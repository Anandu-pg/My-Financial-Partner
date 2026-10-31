/**
 * income.js – My Financial Partner
 * Add income form and recent income list.
 */

async function initIncomePage() {
  // Set today's date default
  const dateInput = document.getElementById('incDate');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  // Load accounts
  const accRes = await Accounts.getAll();
  if (accRes.success) {
    const accSel = document.getElementById('incAccount');
    accRes.accounts.forEach(a => {
      accSel.innerHTML += `<option value="${escapeHtml(a.accountName)}">${escapeHtml(a.accountName)}</option>`;
    });
  }

  // Load custom categories
  const catRes = await Categories.getAll();
  if (catRes.success && catRes.custom?.length) {
    const catSel = document.getElementById('incCategory');
    catRes.custom.filter(c => c.type === 'income').forEach(c => {
      catSel.innerHTML += `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`;
    });
    catSel.innerHTML += `<option value="__custom__">+ Add custom category</option>`;
  } else {
    document.getElementById('incCategory').innerHTML +=
      `<option value="__custom__">+ Add custom category</option>`;
  }

  // Show/hide custom category input
  document.getElementById('incCategory').addEventListener('change', function () {
    const wrap = document.getElementById('customCatWrap');
    wrap.style.display = this.value === '__custom__' ? 'block' : 'none';
  });

  // Form submit
  document.getElementById('incomeForm').addEventListener('submit', handleAddIncome);

  // Load recent income
  loadRecentIncome();
}

async function handleAddIncome(e) {
  e.preventDefault();

  const errEl = document.getElementById('incError');
  errEl.style.display = 'none';

  const amount      = parseFloat(document.getElementById('incAmount').value);
  let   category    = document.getElementById('incCategory').value;
  const customCat   = document.getElementById('incCustomCategory')?.value.trim();
  const date        = document.getElementById('incDate').value;
  const description = document.getElementById('incDescription').value.trim();
  const payMethod   = document.getElementById('incPaymentMethod').value;
  const account     = document.getElementById('incAccount').value;
  const notes       = document.getElementById('incNotes').value.trim();

  if (isNaN(amount) || amount <= 0) {
    showError('Please enter a valid amount greater than 0.');
    return;
  }
  if (!category) {
    showError('Please select a category.');
    return;
  }

  if (category === '__custom__') {
    if (!customCat) {
      showError('Please enter a custom category name.');
      return;
    }
    // Save custom category first
    const catRes = await Categories.addCustom(customCat, 'income');
    category = catRes.success ? customCat : customCat;
  }

  if (!date) {
    showError('Please select a date.');
    return;
  }

  setButtonLoading('incSubmitBtn', true, 'Add Income');

  const result = await Transactions.add({
    type: 'income', amount, category, date, description, paymentMethod: payMethod, account, notes,
  });

  setButtonLoading('incSubmitBtn', false,
    '<i data-lucide="plus-circle"></i> Add Income');
  lucide.createIcons();

  if (result.success) {
    showToast(`Income of ${formatCurrency(amount)} added!`, 'success', 'Income Added');
    document.getElementById('incomeForm').reset();
    document.getElementById('incDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('customCatWrap').style.display = 'none';
    loadRecentIncome();
  } else {
    showError(result.error || 'Failed to add income. Please try again.');
  }
}

function showError(msg) {
  const errEl = document.getElementById('incError');
  errEl.querySelector('span').textContent = msg;
  errEl.style.display = 'flex';
}

async function loadRecentIncome() {
  const container = document.getElementById('recentIncomeList');
  if (!container) return;

  const result = await Transactions.getAll({ filters: { type: 'income' } });

  if (!result.success) {
    container.innerHTML = `<p style="color:var(--danger);font-size:.83rem">Failed to load.</p>`;
    return;
  }

  const txs = (result.transactions || []).slice(0, 15);

  if (!txs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="trending-up" style="width:28px;height:28px"></i></div>
        <div class="empty-title">No income records yet</div>
        <div class="empty-desc">Add your first income entry using the form.</div>
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
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${txs.map(tx => `
            <tr>
              <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(tx.date)}</td>
              <td><span class="cat-chip">${escapeHtml(tx.category)}</span></td>
              <td style="font-size:.82rem">${escapeHtml(tx.description || '—')}</td>
              <td class="text-right td-amount td-income">+${formatCurrency(tx.amount)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
