const API_URL = 'https://moniepoint-pos-repair-dashboard.onrender.com';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = 'index.html';
}

// User Greetings
if (document.getElementById('techGreeting')) {
  document.getElementById('techGreeting').innerText = user.name || 'Technician';
}
if (document.getElementById('techIdDisplay')) {
  document.getElementById('techIdDisplay').innerText = `ID: ${user.techId || user.agentId || '---'}`;
}

// Theme Handlers
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerText = theme === 'dark' ? '☀️' : '🌙';
}

initTheme();

// LOAD DASHBOARD DATA
async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to fetch dashboard data');

    const todayCount = data.todayRepairsCount || 0;
    const weeklyCount = data.weeklyRepairsCount || 0;
    const monthlyCount = data.monthlyRepairsCount || 0;
    const yearlyCount = data.yearlyRepairsCount || 0;
    const missedWeeks = data.missedWeeks !== undefined ? data.missedWeeks : 0;

    // 1. KPI Counts as Progress Ratios
    if (document.getElementById('todayRepairCount')) {
      document.getElementById('todayRepairCount').innerText = `${todayCount} / 15`;
    }
    if (document.getElementById('weeklyRepairCount')) {
      document.getElementById('weeklyRepairCount').innerText = `${weeklyCount} / 72`;
    }
    if (document.getElementById('monthlyRepairCount')) {
      document.getElementById('monthlyRepairCount').innerText = `${monthlyCount} / 300`;
    }
    if (document.getElementById('yearlyRepairCount')) {
      document.getElementById('yearlyRepairCount').innerText = `${yearlyCount} Total`;
    }

    // 2. Daily Target Circle & Bar Calculations
    const dailyPct = Math.min(Math.round((todayCount / 15) * 100), 100);
    if (document.getElementById('dailyCountText')) document.getElementById('dailyCountText').innerText = todayCount;
    if (document.getElementById('dailyCircle')) document.getElementById('dailyCircle').setAttribute('stroke-dasharray', `${dailyPct}, 100`);
    if (document.getElementById('dailyBar')) document.getElementById('dailyBar').style.width = `${dailyPct}%`;
    if (document.getElementById('dailyBarLabel')) document.getElementById('dailyBarLabel').innerText = `${dailyPct}%`;

    // 3. Weekly Bonus Calculations
    const weeklyPct = Math.min(Math.round((weeklyCount / 72) * 100), 100);
    if (document.getElementById('weeklyCountText')) document.getElementById('weeklyCountText').innerText = weeklyCount;
    if (document.getElementById('weeklyCircle')) document.getElementById('weeklyCircle').setAttribute('stroke-dasharray', `${weeklyPct}, 100`);
    if (document.getElementById('weeklyBar')) document.getElementById('weeklyBar').style.width = `${weeklyPct}%`;
    if (document.getElementById('weeklyBarLabel')) document.getElementById('weeklyBarLabel').innerText = `${weeklyPct}%`;

    const bonusEarned = weeklyCount >= 72 ? 30000 : Math.round((weeklyCount / 72) * 30000);
    if (document.getElementById('bonusEarnedText')) document.getElementById('bonusEarnedText').innerText = `₦${bonusEarned.toLocaleString()}`;

    // 4. Monthly Tier UI Sync
    const missedSelect = document.getElementById('missedWeeksSelect');
    if (missedSelect) missedSelect.value = missedWeeks;
    calculateMonthlyPayUI(missedWeeks);

    // 5. Populate Transport Rate & Checkboxes
    const rateInput = document.getElementById('dailyTransportRate');
    if (rateInput) {
      rateInput.value = data.transportRate || user.transportRate || 4000;
    }

    const transportObj = data.transportDays || user.defaultTransportDays || {};
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
      const checkbox = document.getElementById(day);
      if (checkbox) {
        checkbox.checked = transportObj[day] !== undefined ? !!transportObj[day] : true;
      }
    });
    calculateTransportUI();

    // 6. Populate Table
    renderLogsTable(data.recentRepairs);

  } catch (err) {
    console.error('Dashboard Error:', err);
  }
}

// Calculate Monthly Tier Payout
function calculateMonthlyPayUI(missedCount) {
  let totalPayout = 200000;

  switch (parseInt(missedCount, 10)) {
    case 0: totalPayout = 320000; break;
    case 1: totalPayout = 300000; break;
    case 2: totalPayout = 280000; break;
    case 3: totalPayout = 200000; break;
    case 4: totalPayout = 200000; break;
    default: totalPayout = 200000; break;
  }

  const payoutEl = document.getElementById('monthlyPayoutText');
  if (payoutEl) {
    payoutEl.innerText = `₦${totalPayout.toLocaleString()}`;
  }
}

async function updateMissedWeeks(missedValue) {
  calculateMonthlyPayUI(missedValue);

  try {
    await fetch(`${API_URL}/api/monthly/missed-weeks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ missedWeeks: parseInt(missedValue, 10) })
    });
  } catch (err) {
    console.error('Failed to sync missed weeks:', err);
  }
}

// Render Table
function renderLogsTable(logs) {
  const tableBody = document.getElementById('repairLogsTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (!logs || logs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 16px 0; text-align: center; color: var(--text-muted);">
          No terminal records logged today.
        </td>
      </tr>`;
    return;
  }

  logs.forEach(log => {
    let badgeClass = 'badge-fixed';
    if (log.status === 'Replaced Terminal') badgeClass = 'badge-replaced';
    if (log.status === 'Pending Part') badgeClass = 'badge-pending';

    const logDate = log.createdAt || log.dateLogged ? new Date(log.createdAt || log.dateLogged) : new Date();
    const formattedDateTime = logDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-color)';
    row.innerHTML = `
      <td style="padding: 10px 4px; font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${formattedDateTime}</td>
      <td style="padding: 10px 4px; font-weight: 700;">${log.serialNumber}</td>
      <td style="padding: 10px 4px;">${log.merchantName}</td>
      <td style="padding: 10px 4px; color: var(--text-muted);">${log.faultType}</td>
      <td style="padding: 10px 4px;"><span class="badge ${badgeClass}">${log.status}</span></td>
    `;
    tableBody.appendChild(row);
  });
}


// Automatically set the date picker default to Today (YYYY-MM-DD)
const dateInput = document.getElementById('repairDate');
if (dateInput) {
  dateInput.value = new Date().toISOString().split('T')[0];
}

// Update the form submission payload:
const payload = {
  serialNumber: document.getElementById('serialNumber').value.trim(),
  merchantName: document.getElementById('merchantName').value.trim(),
  faultType: document.getElementById('faultType').value,
  status: document.getElementById('status').value,
  repairDate: document.getElementById('repairDate').value // Sent to custom date endpoint handler
};

    try {
      const res = await fetch(`${API_URL}/api/repairs/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        repairForm.reset();
        await loadDashboard();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to document repair');
      }
    } catch (err) {
      alert('Failed to connect to server');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = '+ Log Repair Record';
    }
  });
}

// Transport Allowance Update
async function updateTransport() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const transportDays = {};
  days.forEach(day => {
    const el = document.getElementById(day);
    transportDays[day] = el ? el.checked : false;
  });

  const rateInput = document.getElementById('dailyTransportRate');
  const transportRate = rateInput ? parseFloat(rateInput.value) || 0 : 4000;

  calculateTransportUI();

  try {
    await fetch(`${API_URL}/api/transport/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transportDays, transportRate })
    });
  } catch (err) {
    console.error('Failed to sync transport selection');
  }
}

function calculateTransportUI() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  let checkedCount = 0;
  
  days.forEach(day => {
    const el = document.getElementById(day);
    if (el && el.checked) checkedCount++;
  });

  const rateInput = document.getElementById('dailyTransportRate');
  const dailyRate = rateInput ? parseFloat(rateInput.value) || 0 : 4000;
  
  const transportTotalEl = document.getElementById('transportTotal');
  if (transportTotalEl) {
    transportTotalEl.innerText = `₦${(checkedCount * dailyRate).toLocaleString()}`;
  }

  const countLabelEl = document.getElementById('activeDaysCount');
  if (countLabelEl) {
    countLabelEl.innerText = `${checkedCount} day${checkedCount === 1 ? '' : 's'} active`;
  }
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

loadDashboard();
