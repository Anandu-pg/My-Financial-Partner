/**
 * dashboard.js – My Financial Partner
 * Renders the financial dashboard: stat cards, Chart.js charts,
 * recent transactions, budget status, and savings summary.
 */

let _currentMY  = getCurrentMonthYear();
let _trendChart = null;
let _pieChart   = null;

/* ── Init ───────────────────────────────────────────────── */

function initDashboard() {
  // Month selector
  createMonthSelector('monthSelectorWrap', _currentMY, (newMY) => {
    _currentMY = newMY;
    loadDashboard();
  });

  loadDashboard();
}

async function loadDashboard() {
  showSkeletons();

  const result = await Dashboard.getSummary(_currentMY);

  if (!result.success) {
    showToast(result.error || 'Failed to load dashboard.', 'error', 'Error');
    return;
  }

  const d = result.data;

  renderStatCards(d);
  renderTrendChart(d.monthlyTrend);
  renderPieChart(d.categoryExpenses);
  renderRecentTransactions(d.recentTransactions);
  renderBudgetSummary(d.budgetUsage);
  renderSavingsSummary(d.savingsSummary);
}

/* ── Skeletons ──────────────────────────────────────────── */
function showSkeletons() {
  showLoading('recentTransactions', 'Loading transactions…');
  showLoading('budgetSummary');
  showLoading('savingsSummary');
}

/* ── Stat Cards ─────────────────────────────────────────── */

function renderStatCards(d) {
  const grid = document.getElementById('statGrid');
  if (!grid) return;

  const balance  = d.totalBalance     || 0;
  const income   = d.monthlyIncome    || 0;
  const expense  = d.monthlyExpense   || 0;
  const savings  = d.monthlySavings   || 0;

  grid.innerHTML = `
    <!-- Balance -->
    <div class="stat-card balance-card animate-fade" style="animation-delay:0s">
      <div class="stat-icon">
        <i data-lucide="wallet" style="width:22px;height:22px;color:white"></i>
      </div>
      <div class="stat-info">
        <div class="stat-label">Available Balance</div>
        <div class="stat-value">${formatCurrency(balance)}</div>
        <div class="stat-change" style="color:rgba(255,255,255,.75)">
          All-time net balance
        </div>
      </div>
    </div>

    <!-- Income -->
    <div class="stat-card animate-fade" style="--stat-color:#10b981;--stat-bg:#ecfdf5;animation-delay:.07s">
      <div class="stat-icon">
        <i data-lucide="trending-up"></i>
      </div>
      <div class="stat-info">
        <div class="stat-label">Monthly Income</div>
        <div class="stat-value">${formatCurrency(income)}</div>
        <div class="stat-change positive">
          <i data-lucide="arrow-up" style="width:12px;height:12px"></i>
          This month
        </div>
      </div>
    </div>

    <!-- Expense -->
    <div class="stat-card animate-fade" style="--stat-color:#ef4444;--stat-bg:#fee2e2;animation-delay:.14s">
      <div class="stat-icon">
        <i data-lucide="trending-down"></i>
      </div>
      <div class="stat-info">
        <div class="stat-label">Monthly Expenses</div>
        <div class="stat-value">${formatCurrency(expense)}</div>
        <div class="stat-change negative">
          <i data-lucide="arrow-down" style="width:12px;height:12px"></i>
          This month
        </div>
      </div>
    </div>

    <!-- Savings -->
    <div class="stat-card animate-fade" style="--stat-color:#8b5cf6;--stat-bg:#ede9fe;animation-delay:.21s">
      <div class="stat-icon">
        <i data-lucide="piggy-bank"></i>
      </div>
      <div class="stat-info">
        <div class="stat-label">Monthly Savings</div>
        <div class="stat-value" style="color:${savings >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${formatCurrency(savings)}
        </div>
        <div class="stat-change ${savings >= 0 ? 'positive' : 'negative'}">
          ${savings >= 0 ? '▲ On track' : '▼ Over budget'}
        </div>
      </div>
    </div>
  `;

  lucide.createIcons();
}

/* ── Trend Chart (Bar) ──────────────────────────────────── */

function renderTrendChart(trend) {
  const canvas = document.getElementById('trendChart');
  if (!canvas || !trend) return;

  const labels  = trend.map(t => t.label);
  const incomes  = trend.map(t => t.income);
  const expenses = trend.map(t => t.expense);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  if (_trendChart) _trendChart.destroy();

  _trendChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomes,
          backgroundColor: 'rgba(16,185,129,.8)',
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Expenses',
          data: expenses,
          backgroundColor: 'rgba(239,68,68,.75)',
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Inter', size: 12 }, boxWidth: 12, boxHeight: 12, borderRadius: 4 },
        },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#fff',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          titleColor: isDark ? '#f1f5f9' : '#0f172a',
          bodyColor: textColor,
          padding: 12,
          callbacks: {
            label: ctx => `  ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter', size: 11 } },
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Inter', size: 11 },
            callback: v => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v),
          },
          beginAtZero: true,
        },
      },
    },
  });
}

/* ── Pie Chart ──────────────────────────────────────────── */

function renderPieChart(categoryExpenses) {
  const canvas = document.getElementById('pieChart');
  const legend = document.getElementById('pieLegend');
  if (!canvas) return;

  const entries = Object.entries(categoryExpenses || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!entries.length) {
    document.getElementById('pieChartWrap').innerHTML =
      `<div class="empty-state" style="padding:20px">
         <div class="empty-icon"><i data-lucide="pie-chart" style="width:28px;height:28px"></i></div>
         <div class="empty-desc" style="font-size:.8rem">No expenses this month</div>
       </div>`;
    lucide.createIcons();
    if (legend) legend.innerHTML = '';
    return;
  }

  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const colors = labels.map((l, i) => getCategoryColor(l, i));
  const total  = values.reduce((s, v) => s + v, 0);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (_pieChart) _pieChart.destroy();

  _pieChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: isDark ? '#1e293b' : '#fff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#fff',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          titleColor: isDark ? '#f1f5f9' : '#0f172a',
          bodyColor: isDark ? '#94a3b8' : '#64748b',
          padding: 10,
          callbacks: {
            label: ctx => `₹${ctx.parsed.toLocaleString('en-IN')} (${(ctx.parsed / total * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });

  // Custom legend
  if (legend) {
    legend.innerHTML = entries.map((e, i) => `
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:.75rem">
        <span style="width:10px;height:10px;border-radius:3px;background:${colors[i]};flex-shrink:0"></span>
        <span style="flex:1;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(e[0])}</span>
        <span style="color:var(--text-primary);font-weight:600">${formatCurrencyShort(e[1])}</span>
      </div>
    `).join('');
  }
}

/* ── Recent Transactions ────────────────────────────────── */

function renderRecentTransactions(transactions) {
  const container = document.getElementById('recentTransactions');
  if (!container) return;

  if (!transactions || !transactions.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="receipt" style="width:28px;height:28px"></i></div>
        <div class="empty-title">No transactions yet</div>
        <div class="empty-desc">Start by adding your first income or expense.</div>
      </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Category</th>
          <th>Date</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${transactions.map(tx => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:32px;height:32px;border-radius:8px;
                  background:${tx.type === 'income' ? '#ecfdf5' : '#fee2e2'};
                  display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <i data-lucide="${tx.type === 'income' ? 'arrow-down-left' : 'arrow-up-right'}"
                     style="width:14px;height:14px;color:${tx.type === 'income' ? '#10b981' : '#ef4444'}"></i>
                </div>
                <span style="font-size:.82rem;font-weight:500">${escapeHtml(tx.description || tx.category || '—')}</span>
              </div>
            </td>
            <td><span class="cat-chip">${escapeHtml(tx.category || '—')}</span></td>
            <td style="color:var(--text-muted);font-size:.78rem">${formatDate(tx.date)}</td>
            <td class="text-right td-amount ${tx.type === 'income' ? 'td-income' : 'td-expense'}">
              ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;

  lucide.createIcons();
}

/* ── Budget Summary ─────────────────────────────────────── */

function renderBudgetSummary(budgets) {
  const container = document.getElementById('budgetSummary');
  if (!container) return;

  if (!budgets || !budgets.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:12px 0">
        <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">No budgets set for this month.</p>
        <a href="budgets.html" class="btn btn-outline btn-sm">Set Budgets</a>
      </div>`;
    return;
  }

  container.innerHTML = budgets.map(b => {
    const pct = b.limit > 0 ? Math.min((b.spent / b.limit) * 100, 100) : 0;
    const cls = pct >= 100 ? 'danger' : pct >= 90 ? 'warning' : '';
    return `
      <div class="progress-wrap mb-16">
        <div class="progress-header">
          <span class="progress-label">${escapeHtml(b.category)}</span>
          <span class="progress-value">${formatCurrencyShort(b.spent)} / ${formatCurrencyShort(b.limit)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${cls}" style="width:${pct}%"></div>
        </div>
        ${pct >= 100 ? `<div style="font-size:.7rem;color:var(--danger);margin-top:4px">⚠ Over budget!</div>` :
          pct >= 90  ? `<div style="font-size:.7rem;color:var(--warning);margin-top:4px">⚠ 90% used</div>` :
          pct >= 70  ? `<div style="font-size:.7rem;color:var(--warning);margin-top:4px">70% used</div>` : ''}
      </div>`;
  }).join('');
}

/* ── Savings Summary ────────────────────────────────────── */

function renderSavingsSummary(goals) {
  const container = document.getElementById('savingsSummary');
  if (!container) return;

  if (!goals || !goals.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:12px 0">
        <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">No savings goals yet.</p>
        <a href="savings.html" class="btn btn-outline btn-sm">Create Goal</a>
      </div>`;
    return;
  }

  container.innerHTML = goals.map(g => {
    const pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100).toFixed(1) : 0;
    return `
      <div class="progress-wrap mb-16">
        <div class="progress-header">
          <span class="progress-label" style="font-weight:600">${escapeHtml(g.name)}</span>
          <span class="progress-value" style="color:var(--primary)">${pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-top:4px">
          <span>Saved: ${formatCurrencyShort(g.saved)}</span>
          <span>Goal: ${formatCurrencyShort(g.target)}</span>
        </div>
      </div>`;
  }).join('');
}
