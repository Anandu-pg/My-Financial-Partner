/**
 * savings.js – My Financial Partner
 * Savings goals: create, contribute, edit, delete, progress display.
 */

const GOAL_ICONS = {
  'Emergency Fund': 'shield',
  'New Phone':      'smartphone',
  'Laptop':         'laptop',
  'Travel':         'plane',
  'Default':        'piggy-bank',
};

function getGoalIcon(name) {
  for (const [key, icon] of Object.entries(GOAL_ICONS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return GOAL_ICONS['Default'];
}

async function initSavingsPage() {
  await loadGoals();
}

async function loadGoals() {
  const container = document.getElementById('goalsGrid');
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Loading…</span></div>';

  const result = await Savings.getAll();

  if (!result.success) {
    showToast(result.error || 'Failed to load goals.', 'error');
    return;
  }

  renderGoals(result.goals || []);
}

function renderGoals(goals) {
  const container = document.getElementById('goalsGrid');

  if (!goals.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:60px 20px">
        <div class="empty-icon" style="width:80px;height:80px">
          <i data-lucide="piggy-bank" style="width:36px;height:36px"></i>
        </div>
        <div class="empty-title">No savings goals yet</div>
        <div class="empty-desc">Start saving towards something meaningful!</div>
        <button class="btn btn-primary" style="margin-top:20px" onclick="openCreateGoalModal()">
          <i data-lucide="plus"></i> Create First Goal
        </button>
      </div>`;
    lucide.createIcons();
    return;
  }

  const active    = goals.filter(g => g.status !== 'completed');
  const completed = goals.filter(g => g.status === 'completed');

  let html = '<div class="goals-grid stagger">';

  html += active.map(g => renderGoalCard(g)).join('');

  if (completed.length) {
    html += `</div>
      <h3 style="font-size:.9rem;font-weight:700;color:var(--text-muted);margin:28px 0 14px;
        text-transform:uppercase;letter-spacing:.5px">Completed Goals</h3>
      <div class="goals-grid stagger">` +
      completed.map(g => renderGoalCard(g)).join('');
  }

  html += '</div>';
  container.innerHTML = html;
  lucide.createIcons();
}

function renderGoalCard(g) {
  const pct      = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
  const pctDisp  = pct.toFixed(1);
  const remaining = Math.max(0, g.target - g.saved);
  const icon     = getGoalIcon(g.goalName);
  const done     = g.status === 'completed';

  // Days remaining
  let daysLeft = '';
  if (g.targetDate) {
    const diff = Math.ceil((new Date(g.targetDate) - new Date()) / 86400000);
    if (diff > 0)     daysLeft = `${diff} days left`;
    else if (diff < 0) daysLeft = `${Math.abs(diff)} days overdue`;
    else               daysLeft = 'Due today';
  }

  return `
    <div class="goal-card ${done ? 'opacity-70' : ''}" id="goal-${g.goalId}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px">
        <div class="goal-icon-wrap" style="${done ? 'background:rgba(16,185,129,.15)' : ''}">
          <i data-lucide="${done ? 'check-circle' : icon}" style="width:22px;height:22px;color:${done ? 'var(--success)' : 'var(--primary)'}"></i>
        </div>
        <div class="d-flex gap-8" style="align-items:center">
          ${done ? `<span class="badge badge-success">✓ Completed</span>` : ''}
          <button class="btn btn-ghost btn-sm btn-icon" onclick="deleteGoal('${g.goalId}')" title="Delete goal" style="color:var(--danger)">
            <i data-lucide="trash-2" style="width:14px;height:14px"></i>
          </button>
        </div>
      </div>

      <div class="goal-name">${escapeHtml(g.goalName)}</div>

      ${daysLeft ? `<div style="font-size:.72rem;color:${daysLeft.includes('overdue') ? 'var(--danger)' : 'var(--text-muted)'};margin-bottom:10px">
        <i data-lucide="calendar" style="width:11px;height:11px;vertical-align:-1px"></i> ${daysLeft}
      </div>` : '<div style="margin-bottom:10px"></div>'}

      <div class="goal-amounts">
        <div>
          <div class="goal-saved">${formatCurrency(g.saved)}</div>
          <div style="font-size:.68rem;color:var(--text-muted)">Saved</div>
        </div>
        <div style="text-align:right">
          <div class="goal-target">${formatCurrency(g.target)}</div>
          <div style="font-size:.68rem;color:var(--text-muted)">Target</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="progress-bar" style="height:10px;margin-bottom:8px">
        <div class="progress-fill" style="width:${pctDisp}%;background:${done ? 'var(--success)' : 'var(--primary)'}"></div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-size:.72rem;color:var(--text-muted)">${pctDisp}% complete</span>
        <span style="font-size:.72rem;font-weight:700;color:var(--primary)">
          ${remaining > 0 ? formatCurrencyShort(remaining) + ' to go' : '🎉 Goal reached!'}
        </span>
      </div>

      ${!done ? `
        <button class="btn btn-outline w-100 btn-sm" onclick="openContributeModal('${g.goalId}', '${escapeHtml(g.goalName)}')">
          <i data-lucide="plus-circle"></i> Add Contribution
        </button>` : ''}
    </div>`;
}

/* ── Create Goal ────────────────────────────────────────── */

function openCreateGoalModal() {
  document.getElementById('goalName').value   = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalSaved').value  = '';
  document.getElementById('goalDate').value   = '';
  document.getElementById('goalNotes').value  = '';
  openModal('createGoalModal');
  lucide.createIcons();
}

async function handleCreateGoal() {
  const goalName     = document.getElementById('goalName').value.trim();
  const targetAmount = parseFloat(document.getElementById('goalTarget').value);
  const savedAmount  = parseFloat(document.getElementById('goalSaved').value) || 0;
  const targetDate   = document.getElementById('goalDate').value;
  const notes        = document.getElementById('goalNotes').value.trim();

  if (!goalName) { showToast('Goal name is required.', 'error'); return; }
  if (isNaN(targetAmount) || targetAmount <= 0) { showToast('Enter a valid target amount.', 'error'); return; }

  const btn = document.getElementById('createGoalBtn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  const result = await Savings.create({ goalName, targetAmount, savedAmount, targetDate, notes });

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="piggy-bank"></i> Create Goal';
  lucide.createIcons();

  if (result.success) {
    showToast('Savings goal created!', 'success');
    closeModal('createGoalModal');
    await loadGoals();
  } else {
    showToast(result.error || 'Failed to create goal.', 'error');
  }
}

/* ── Contribute ─────────────────────────────────────────── */

function openContributeModal(goalId, goalName) {
  document.getElementById('activeGoalId').value        = goalId;
  document.getElementById('contributeGoalName').textContent = '🎯 ' + goalName;
  document.getElementById('contributeAmount').value    = '';
  document.getElementById('contributeNotes').value     = '';
  openModal('contributeModal');
  lucide.createIcons();
}

async function handleContribute() {
  const goalId = document.getElementById('activeGoalId').value;
  const amount = parseFloat(document.getElementById('contributeAmount').value);
  const notes  = document.getElementById('contributeNotes').value.trim();

  if (isNaN(amount) || amount <= 0) { showToast('Enter a valid contribution amount.', 'error'); return; }

  const btn = document.getElementById('contributeBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const result = await Savings.contribute(goalId, amount, notes);

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="plus"></i> Add Contribution';
  lucide.createIcons();

  if (result.success) {
    showToast(`${formatCurrency(amount)} added to your savings goal!`, 'success', 'Contribution Added');
    closeModal('contributeModal');
    await loadGoals();
  } else {
    showToast(result.error || 'Failed to add contribution.', 'error');
  }
}

/* ── Delete ─────────────────────────────────────────────── */

async function deleteGoal(goalId) {
  if (!confirm('Delete this savings goal? This cannot be undone.')) return;

  const result = await Savings.delete(goalId);
  if (result.success) {
    showToast('Goal deleted.', 'success');
    await loadGoals();
  } else {
    showToast(result.error || 'Failed to delete goal.', 'error');
  }
}
