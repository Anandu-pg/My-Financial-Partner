/**
 * salary.js – My Financial Partner
 * Salary module: set expected salary, mark received, view history.
 */

let _currentSalaryMY = getCurrentMonthYear();
let _currentSalaryId = null;

async function initSalaryPage() {
  // Set default dates
  document.getElementById('salExpectedDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('salReceivedDate').value = new Date().toISOString().split('T')[0];

  // Set year filter to current year
  const yearFilter = document.getElementById('yearFilter');
  const currentYear = new Date().getFullYear();
  yearFilter.innerHTML = '';
  for (let y = currentYear; y >= currentYear - 4; y--) {
    yearFilter.innerHTML += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
  }
  yearFilter.addEventListener('change', () => loadSalaryHistory(yearFilter.value));

  // Month selector
  createMonthSelector('monthSelectorWrap', _currentSalaryMY, (newMY) => {
    _currentSalaryMY = newMY;
    loadSalaryForMonth();
  });

  // Salary form submit
  document.getElementById('salaryForm').addEventListener('submit', handleSetSalary);

  await loadSalaryForMonth();
  await loadSalaryHistory(currentYear);
}

async function loadSalaryForMonth() {
  const result = await Salary.getForMonth(_currentSalaryMY);
  const statusEl = document.getElementById('salaryStatus');
  const markSection = document.getElementById('markReceivedSection');

  if (result.success && result.salary) {
    const sal = result.salary;
    _currentSalaryId = sal.salaryId;

    // Pre-fill expected amount
    document.getElementById('salExpected').value      = sal.expectedAmount || '';
    document.getElementById('salExpectedDate').value  = sal.expectedDate   || '';
    document.getElementById('salNotes').value         = sal.notes          || '';
    if (sal.receivedAmount) {
      document.getElementById('salReceived').value      = sal.receivedAmount;
      document.getElementById('salReceivedDate').value  = sal.receivedDate || new Date().toISOString().split('T')[0];
    }

    if (sal.status === 'received') {
      statusEl.innerHTML = `
        <div style="background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.2);
          border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px">
          <i data-lucide="check-circle" style="width:20px;height:20px;color:var(--success)"></i>
          <div>
            <div style="font-weight:700;color:var(--success);font-size:.9rem">Salary Received ✓</div>
            <div style="font-size:.78rem;color:var(--text-muted)">
              ${formatCurrency(sal.receivedAmount)} on ${formatDate(sal.receivedDate)}
            </div>
          </div>
        </div>`;
      markSection.style.display = 'none';
    } else {
      statusEl.innerHTML = `
        <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.2);
          border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:10px">
          <i data-lucide="clock" style="width:20px;height:20px;color:var(--warning)"></i>
          <div>
            <div style="font-weight:700;color:var(--warning);font-size:.9rem">Salary Pending</div>
            <div style="font-size:.78rem;color:var(--text-muted)">
              Expected: ${formatCurrency(sal.expectedAmount)} on ${formatDate(sal.expectedDate) || 'TBD'}
            </div>
          </div>
        </div>`;
      markSection.style.display = 'block';
    }
  } else {
    _currentSalaryId = null;
    statusEl.innerHTML = `
      <div style="background:var(--bg-hover);border:1px solid var(--border);
        border-radius:10px;padding:14px 16px;text-align:center">
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:8px">
          No salary set for ${formatMonthYear(_currentSalaryMY)}.
        </p>
        <p style="font-size:.75rem;color:var(--text-muted)">
          Fill the form below to set your expected salary.
        </p>
      </div>`;
    markSection.style.display = 'none';
  }

  lucide.createIcons();
}

async function handleSetSalary(e) {
  e.preventDefault();

  const expected     = document.getElementById('salExpected').value;
  const expectedDate = document.getElementById('salExpectedDate').value;
  const notes        = document.getElementById('salNotes').value.trim();

  if (!expected || parseFloat(expected) <= 0) {
    showToast('Please enter a valid salary amount.', 'error');
    return;
  }

  setButtonLoading('salSetBtn', true, 'Set Expected Salary');

  const result = await Salary.set({
    monthYear: _currentSalaryMY,
    expectedAmount: parseFloat(expected),
    expectedDate,
    notes,
  });

  setButtonLoading('salSetBtn', false, '<i data-lucide="save"></i> Set Expected Salary');
  lucide.createIcons();

  if (result.success) {
    showToast('Salary expectation saved!', 'success');
    _currentSalaryId = result.salaryId;
    await loadSalaryForMonth();
    await loadSalaryHistory(new Date().getFullYear());
  } else {
    showToast(result.error || 'Failed to save salary.', 'error');
  }
}

async function handleMarkReceived() {
  if (!_currentSalaryId) {
    showToast('Please set an expected salary first.', 'warning');
    return;
  }

  const received     = document.getElementById('salReceived').value;
  const receivedDate = document.getElementById('salReceivedDate').value;

  const result = await Salary.markReceived(_currentSalaryId, {
    receivedAmount: parseFloat(received) || undefined,
    receivedDate,
  });

  if (result.success) {
    showToast('Salary marked as received and added to income!', 'success', 'Salary Received');
    await loadSalaryForMonth();
    await loadSalaryHistory(new Date().getFullYear());
  } else {
    showToast(result.error || 'Failed to mark as received.', 'error');
  }
}

async function loadSalaryHistory(year) {
  const container = document.getElementById('salaryHistory');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>';

  const result = await Salary.getHistory(year);

  if (!result.success) {
    container.innerHTML = `<p style="color:var(--danger);font-size:.83rem;padding:10px">Failed to load history.</p>`;
    return;
  }

  const history = result.history || [];

  if (!history.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i data-lucide="briefcase" style="width:28px;height:28px"></i></div>
        <div class="empty-title">No salary history for ${year}</div>
        <div class="empty-desc">Set your salary for a month to see history here.</div>
      </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Expected</th>
            <th>Expected Date</th>
            <th>Received</th>
            <th>Received Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${history.map(h => `
            <tr>
              <td style="font-weight:600">${formatMonthYear(h.monthYear)}</td>
              <td class="td-income">${formatCurrency(h.expectedAmount)}</td>
              <td style="color:var(--text-muted);font-size:.78rem">${formatDate(h.expectedDate) || '—'}</td>
              <td class="td-income">${h.receivedAmount ? formatCurrency(h.receivedAmount) : '—'}</td>
              <td style="color:var(--text-muted);font-size:.78rem">${formatDate(h.receivedDate) || '—'}</td>
              <td>
                <span class="badge ${h.status === 'received' ? 'badge-success' : 'badge-warning'}">
                  ${h.status === 'received' ? '✓ Received' : '⏳ Pending'}
                </span>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
