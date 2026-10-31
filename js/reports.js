/**
 * reports.js – My Financial Partner
 * Reports & Analytics: monthly, yearly, category, daily charts.
 * PDF export via jsPDF. CSV export via Blob.
 */

let _activeTab = 'monthly';
let _reportMY  = getCurrentMonthYear();
let _reportYear = new Date().getFullYear();
let _charts    = [];
let _lastData  = null; // for export

/* ── Init ───────────────────────────────────────────────── */

function initReportsPage() {
  renderSelector();
  loadMonthlyReport();
}

function renderSelector() {
  const wrap = document.getElementById('reportSelectorWrap');

  if (_activeTab === 'yearly') {
    wrap.innerHTML = `
      <select id="yearSelect" class="form-control" style="width:auto" onchange="handleYearChange(this.value)">
        ${[0,1,2,3,4].map(i => {
          const y = new Date().getFullYear() - i;
          return `<option value="${y}" ${y === _reportYear ? 'selected' : ''}>${y}</option>`;
        }).join('')}
      </select>`;
  } else {
    wrap.innerHTML = '<div id="monthSelectorWrap2"></div>';
    createMonthSelector('monthSelectorWrap2', _reportMY, (newMY) => {
      _reportMY = newMY;
      loadCurrentTab();
    });
  }
}

function switchTab(tab, btnEl) {
  _activeTab = tab;
  document.querySelectorAll('.report-tab').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  renderSelector();
  destroyCharts();
  loadCurrentTab();
}

function handleYearChange(year) {
  _reportYear = parseInt(year);
  loadCurrentTab();
}

function loadCurrentTab() {
  switch (_activeTab) {
    case 'monthly':    return loadMonthlyReport();
    case 'yearly':     return loadYearlyReport();
    case 'categories': return loadCategoryReport();
    case 'daily':      return loadDailyReport();
  }
}

function destroyCharts() {
  _charts.forEach(c => c.destroy());
  _charts = [];
}

/* ── Monthly Report ─────────────────────────────────────── */

async function loadMonthlyReport() {
  clearReportAreas();

  const result = await Reports.getMonthly(_reportMY);
  if (!result.success) { showToast(result.error || 'Failed to load report.', 'error'); return; }

  const r = result.report;
  _lastData = r;

  renderReportStats([
    { label: 'Total Income',   value: r.totalIncome,  color: '#10b981', icon: 'trending-up' },
    { label: 'Total Expenses', value: r.totalExpense, color: '#ef4444', icon: 'trending-down' },
    { label: 'Net Savings',    value: r.netSavings,   color: r.netSavings >= 0 ? '#8b5cf6' : '#ef4444', icon: 'piggy-bank' },
    { label: 'Transactions',   value: r.transactions.length, color: '#3b82f6', icon: 'list', isCurrency: false },
  ]);

  // Income vs Expense pie charts side by side
  const chartsDiv = document.getElementById('reportCharts');
  chartsDiv.innerHTML = `
    <div class="chart-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Expense by Category</span></div>
        <div class="card-body"><div class="chart-container" style="height:240px"><canvas id="catExpChart"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Income by Category</span></div>
        <div class="card-body"><div class="chart-container" style="height:240px"><canvas id="catIncChart"></canvas></div></div>
      </div>
    </div>`;

  renderCategoryPie('catExpChart', r.expenseByCategory, 'Expenses');
  renderCategoryPie('catIncChart', r.incomeByCategory,  'Income');

  // Transactions table
  renderTransactionsTable(r.transactions, document.getElementById('reportTable'));
}

/* ── Yearly Report ──────────────────────────────────────── */

async function loadYearlyReport() {
  clearReportAreas();

  const result = await Reports.getYearly(_reportYear);
  if (!result.success) { showToast(result.error || 'Failed to load report.', 'error'); return; }

  const r = result.report;
  _lastData = r;

  renderReportStats([
    { label: 'Annual Income',   value: r.totalIncome,  color: '#10b981', icon: 'trending-up' },
    { label: 'Annual Expenses', value: r.totalExpense, color: '#ef4444', icon: 'trending-down' },
    { label: 'Annual Savings',  value: r.netSavings,   color: r.netSavings >= 0 ? '#8b5cf6' : '#ef4444', icon: 'piggy-bank' },
  ]);

  const months = Object.keys(r.monthly).sort();
  const labels = months.map(m => {
    const [yr, mo] = m.split('-');
    return new Date(yr, mo - 1, 1).toLocaleString('en', { month: 'short' });
  });
  const incomes  = months.map(m => r.monthly[m].income);
  const expenses = months.map(m => r.monthly[m].expense);

  const chartsDiv = document.getElementById('reportCharts');
  chartsDiv.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Monthly Comparison — ${_reportYear}</span></div>
      <div class="card-body">
        <div class="chart-container" style="height:280px"><canvas id="yearlyChart"></canvas></div>
      </div>
    </div>`;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const chart = new Chart(document.getElementById('yearlyChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Income',   data: incomes,  backgroundColor: 'rgba(16,185,129,.8)', borderRadius: 5, borderSkipped: false },
        { label: 'Expenses', data: expenses, backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 5, borderSkipped: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 } } },
        tooltip: {
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}` }
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 },
          callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v) }, beginAtZero: true },
      },
    },
  });
  _charts.push(chart);

  // Monthly summary table
  const tableData = months.map(m => ({
    date: formatMonthYear(m),
    type: '',
    category: '',
    description: `Income: ₹${r.monthly[m].income.toLocaleString('en-IN')} | Expenses: ₹${r.monthly[m].expense.toLocaleString('en-IN')}`,
    paymentMethod: '',
    amount: r.monthly[m].income - r.monthly[m].expense,
  }));

  renderTransactionsTable(tableData, document.getElementById('reportTable'), true);
}

/* ── Category Report ────────────────────────────────────── */

async function loadCategoryReport() {
  clearReportAreas();

  const [expRes, incRes] = await Promise.all([
    Reports.getCategory(_reportMY, 'expense'),
    Reports.getCategory(_reportMY, 'income'),
  ]);

  _lastData = { expense: expRes.categories, income: incRes.categories };

  const chartsDiv = document.getElementById('reportCharts');
  chartsDiv.innerHTML = `
    <div class="chart-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Expense Categories</span></div>
        <div class="card-body">
          <div class="chart-container" style="height:240px"><canvas id="expPieR"></canvas></div>
          <div id="expLegendR" style="margin-top:10px"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Income Categories</span></div>
        <div class="card-body">
          <div class="chart-container" style="height:240px"><canvas id="incPieR"></canvas></div>
          <div id="incLegendR" style="margin-top:10px"></div>
        </div>
      </div>
    </div>`;

  const renderCatChart = (canvasId, legendId, cats) => {
    if (!cats || !cats.length) {
      document.getElementById(canvasId).parentElement.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-desc">No data</div></div>';
      return;
    }
    const colors = cats.map((c, i) => getCategoryColor(c.category, i));
    const chart = new Chart(document.getElementById(canvasId), {
      type: 'doughnut',
      data: {
        labels: cats.map(c => c.category),
        datasets: [{ data: cats.map(c => c.amount), backgroundColor: colors, borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#1e293b' : '#fff' }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: { legend: { display: false } } },
    });
    _charts.push(chart);
    const leg = document.getElementById(legendId);
    if (leg) {
      leg.innerHTML = cats.map((c, i) => `
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;font-size:.75rem">
          <span style="width:10px;height:10px;border-radius:3px;background:${colors[i]};flex-shrink:0"></span>
          <span style="flex:1;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.category)}</span>
          <span style="font-weight:700;color:var(--text-primary)">${c.percentage}%</span>
          <span style="color:var(--text-muted)">${formatCurrencyShort(c.amount)}</span>
        </div>`).join('');
    }
  };

  renderCatChart('expPieR', 'expLegendR', expRes.categories);
  renderCatChart('incPieR', 'incLegendR', incRes.categories);

  document.getElementById('reportStats').innerHTML = '';
  document.getElementById('reportTable').innerHTML = '';
}

/* ── Daily Report ───────────────────────────────────────── */

async function loadDailyReport() {
  clearReportAreas();

  const result = await Reports.getDaily(_reportMY);
  if (!result.success) { showToast(result.error || 'Failed.', 'error'); return; }

  const daily = result.daily || [];
  _lastData = daily;

  const labels  = daily.map(d => d.date.split('-')[2]); // day number
  const incomes  = daily.map(d => d.income);
  const expenses = daily.map(d => d.expense);

  const chartsDiv = document.getElementById('reportCharts');
  chartsDiv.innerHTML = `
    <div class="card mb-24">
      <div class="card-header"><span class="card-title">Daily Spending – ${formatMonthYear(_reportMY)}</span></div>
      <div class="card-body">
        <div class="chart-container" style="height:280px"><canvas id="dailyChart"></canvas></div>
      </div>
    </div>`;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const chart = new Chart(document.getElementById('dailyChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: incomes,  fill: true,
          backgroundColor: 'rgba(16,185,129,.1)', borderColor: '#10b981',
          tension: .4, pointRadius: 3, pointHoverRadius: 5 },
        { label: 'Expenses', data: expenses, fill: true,
          backgroundColor: 'rgba(239,68,68,.1)', borderColor: '#ef4444',
          tension: .4, pointRadius: 3, pointHoverRadius: 5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 } } },
        tooltip: { callbacks: { label: ctx => `  ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { family: 'Inter', size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 11 },
          callback: v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v) }, beginAtZero: true },
      },
    },
  });
  _charts.push(chart);

  document.getElementById('reportStats').innerHTML = '';
  document.getElementById('reportTable').innerHTML = '';
}

/* ── Shared Render Helpers ──────────────────────────────── */

function clearReportAreas() {
  destroyCharts();
  document.getElementById('reportStats').innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
  document.getElementById('reportCharts').innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
  document.getElementById('reportTable').innerHTML = '';
}

function renderReportStats(items) {
  const el = document.getElementById('reportStats');
  el.innerHTML = items.map(item => `
    <div class="stat-card" style="--stat-color:${item.color};--stat-bg:${item.color}1a">
      <div class="stat-icon"><i data-lucide="${item.icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${item.label}</div>
        <div class="stat-value" style="color:${item.color}">
          ${item.isCurrency === false ? item.value : formatCurrency(item.value)}
        </div>
      </div>
    </div>`).join('');
  lucide.createIcons();
}

function renderCategoryPie(canvasId, catData, title) {
  const entries = Object.entries(catData || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) {
    document.getElementById(canvasId).parentElement.innerHTML =
      `<div class="empty-state" style="padding:20px"><div class="empty-desc">No ${title.toLowerCase()} data</div></div>`;
    return;
  }

  const colors = entries.map((e, i) => getCategoryColor(e[0], i));
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  const chart = new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{ data: entries.map(e => e[1]), backgroundColor: colors,
        borderWidth: 2, borderColor: isDark ? '#1e293b' : '#fff', hoverOffset: 6 }],
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '58%',
      plugins: { legend: { position: 'right', labels: {
        color: isDark ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 }, boxWidth: 10, boxHeight: 10,
      }} },
    },
  });
  _charts.push(chart);
}

function renderTransactionsTable(transactions, container, isSummary = false) {
  if (!container || !transactions || !transactions.length) return;

  container.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Transaction Details</span></div>
      <div class="table-wrapper" style="border:none">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              ${!isSummary ? '<th>Type</th>' : ''}
              ${!isSummary ? '<th>Category</th>' : ''}
              <th>Description</th>
              ${!isSummary ? '<th>Payment</th>' : ''}
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(tx => `
              <tr>
                <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${escapeHtml(isSummary ? tx.date : formatDate(tx.date))}</td>
                ${!isSummary ? `<td><span class="badge ${tx.type === 'income' ? 'badge-success' : 'badge-danger'}">${tx.type}</span></td>` : ''}
                ${!isSummary ? `<td><span class="cat-chip">${escapeHtml(tx.category || '—')}</span></td>` : ''}
                <td style="font-size:.82rem">${escapeHtml(tx.description || '—')}</td>
                ${!isSummary ? `<td style="font-size:.75rem;color:var(--text-muted)">${escapeHtml(tx.paymentMethod || '—')}</td>` : ''}
                <td class="text-right td-amount ${!isSummary ? (tx.type === 'income' ? 'td-income' : 'td-expense') : (tx.amount >= 0 ? 'td-income' : 'td-expense')}">
                  ${!isSummary ? (tx.type === 'income' ? '+' : '-') + formatCurrency(tx.amount) : formatCurrency(tx.amount)}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ── CSV Export ─────────────────────────────────────────── */

function exportCSV() {
  if (!_lastData) { showToast('Load a report first.', 'warning'); return; }

  let rows = [['Date','Type','Category','Description','Payment Method','Amount']];

  const transactions = Array.isArray(_lastData.transactions)
    ? _lastData.transactions
    : [];

  transactions.forEach(tx => {
    rows.push([
      tx.date, tx.type || '', tx.category || '',
      tx.description || '', tx.paymentMethod || '',
      (tx.type === 'expense' ? '-' : '') + (parseFloat(tx.amount) || 0),
    ]);
  });

  const csv = rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `mfp_report_${_activeTab}_${_reportMY || _reportYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}

/* ── PDF Export ─────────────────────────────────────────── */

function exportPDF() {
  if (!_lastData) { showToast('Load a report first.', 'warning'); return; }
  if (typeof window.jspdf === 'undefined') { showToast('PDF library not loaded.', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const user = getSessionUser();
  const now  = new Date().toLocaleDateString('en-IN');

  // Header
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('My Financial Partner', 14, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Report: ${_activeTab.toUpperCase()}  |  User: ${user?.username || ''}  |  Generated: ${now}`, 14, 20);

  doc.setTextColor(0, 0, 0);

  const transactions = _lastData.transactions || [];

  if (transactions.length) {
    doc.autoTable({
      startY: 36,
      head: [['Date','Type','Category','Description','Amount']],
      body: transactions.map(tx => [
        tx.date ? String(tx.date).split('T')[0] : '',
        tx.type || '',
        tx.category || '',
        tx.description || '',
        (tx.type === 'expense' ? '-₹' : '₹') + parseFloat(tx.amount || 0).toLocaleString('en-IN'),
      ]),
      styles: { font: 'helvetica', fontSize: 9 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
    });
  } else {
    doc.setFontSize(11);
    doc.text('No transaction data available for this period.', 14, 40);
  }

  doc.save(`mfp_report_${_activeTab}_${_reportMY || _reportYear}.pdf`);
  showToast('PDF exported!', 'success');
}
