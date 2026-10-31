/**
 * budgets.js – My Financial Partner
 * Budget CRUD with progress bars and colour-coded warnings.
 */

let _budgetMY = getCurrentMonthYear();

async function initBudgetsPage() {
  createMonthSelector('monthSelectorWrap', _budgetMY, (newMY) => {
    _budgetMY = newMY;
    loadBudgets();
  });

  await loadBudgets();
}

async function loadBudgets() {
  showLoading('budgetList', 'Loading budgets…');

  const result = await Budgets.getAll(_budgetMY);

  if (!result.success) {
    showToast(result.error || 'Failed to load budgets.', 'error');
    return;
  }

  const budgets = result.budgets || [];
  renderBudgetStats(budgets);
  renderBudgetList(budgets);
}

function renderBudgetStats(budgets) {
  const totalBudgeted  = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent     = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalBudgeted - totalSpent;

  document.getElementById('statBudgeted').textContent  = formatCurrency(totalBudgeted);
  document.getElementById('statSpent').textContent     = formatCurrency(totalSpent);
  document.getElementById('statRemaining').textContent = formatCurrency(Math.max(0, totalRemaining));
  document.getElementById('statRemaining').style.color =
    totalRemaining < 0 ? 'var(--danger)' : 'var(--success)';
}

function renderBudgetList(budgets) {
  const container = document.getElementById('budgetList');

  if (!budgets.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="target" style="width:28px;height:28px"></i></div>
        <div class="empty-title">No budgets set</div>
        <div class="empty-desc">Click "Set Budget" to set spending limits for expense categories.</div>
        <button class="btn btn-primary" style="margin-top:16px" onclick="openAddBudgetModal()">
          <i data-lucide="plus"></i> Set Your First Budget
        </button>
      </div>`;
    lucide.createIcons();
    return;
  }

  // Sort by usage % desc
  budgets.sort((a, b) => {
    const pa = a.limitAmount > 0 ? a.spent / a.limitAmount : 0;
    const pb = b.limitAmount > 0 ? b.spent / b.limitAmount : 0;
    return pb - pa;
  });

  container.innerHTML = `<div class="budget-list">` +
    budgets.map(b => {
      const pct     = b.limitAmount > 0 ? Math.min((b.spent / b.limitAmount) * 100, 100) : 0;
      const pctDisp = pct.toFixed(1);
      const fillCls = pct >= 100 ? 'danger' : pct >= 90 ? 'warning' : '';
      const remaining = b.limitAmount - b.spent;

      let warningBadge = '';
      if (pct >= 100) warningBadge = `<span class="budget-warning">⚠ Over Budget</span>`;
      else if (pct >= 90) warningBadge = `<span class="budget-warning" style="background:#fef3c7;color:var(--warning)">⚠ 90%</span>`;
      else if (pct >= 70) warningBadge = `<span class="budget-warning" style="background:#fef3c7;color:var(--warning)">70%</span>`;

      return `
        <div class="budget-item" id="budget-${b.budgetId}">
          <div class="budget-item-header">
            <div class="d-flex align-center gap-8">
              <div style="width:36px;height:36px;border-radius:8px;background:var(--primary-bg);
                display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i data-lucide="tag" style="width:16px;height:16px;color:var(--primary)"></i>
              </div>
              <div>
                <div class="budget-cat">${escapeHtml(b.category)}</div>
                <div style="font-size:.72rem;color:var(--text-muted)">
                  ${formatCurrency(b.spent)} spent of ${formatCurrency(b.limitAmount)}
                </div>
              </div>
            </div>
            <div class="d-flex align-center gap-8">
              ${warningBadge}
              <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteBudget('${b.budgetId}')" title="Delete budget"
                style="color:var(--danger)">
                <i data-lucide="trash-2" style="width:14px;height:14px"></i>
              </button>
            </div>
          </div>

          <div class="progress-wrap">
            <div class="progress-header">
              <span class="progress-label" style="color:${pct >= 100 ? 'var(--danger)' : 'var(--text-muted)'}">
                ${pctDisp}% used
              </span>
              <span class="progress-value" style="color:${remaining < 0 ? 'var(--danger)' : 'var(--success)'}">
                ${remaining >= 0 ? formatCurrency(remaining) + ' left' : formatCurrency(Math.abs(remaining)) + ' over'}
              </span>
            </div>
            <div class="progress-bar" style="height:10px">
              <div class="progress-fill ${fillCls}" style="width:${pctDisp}%"></div>
            </div>
          </div>
        </div>`;
    }).join('') + '</div>';

  lucide.createIcons();
}

function openAddBudgetModal() {
  document.getElementById('budgetCategory').value = '';
  document.getElementById('budgetLimit').value    = '';
  openModal('addBudgetModal');
  lucide.createIcons();
}

async function handleSaveBudget() {
  const category = document.getElementById('budgetCategory').value;
  const limit    = parseFloat(document.getElementById('budgetLimit').value);

  if (!category) {
    showToast('Please select a category.', 'error');
    return;
  }
  if (isNaN(limit) || limit <= 0) {
    showToast('Please enter a valid limit amount.', 'error');
    return;
  }

  const btn = document.getElementById('saveBudgetBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const result = await Budgets.set({
    monthYear: _budgetMY,
    category,
    limitAmount: limit,
  });

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="check"></i> Save Budget';
  lucide.createIcons();

  if (result.success) {
    showToast('Budget saved!', 'success');
    closeModal('addBudgetModal');
    await loadBudgets();
  } else {
    showToast(result.error || 'Failed to save budget.', 'error');
  }
}

async function deleteBudget(budgetId) {
  if (!confirm('Remove this budget limit?')) return;

  const result = await Budgets.delete(budgetId);
  if (result.success) {
    showToast('Budget removed.', 'success');
    await loadBudgets();
  } else {
    showToast(result.error || 'Failed to delete.', 'error');
  }
}
