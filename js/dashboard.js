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

// Set Default Custom Log Date Picker to Today (YYYY-MM-DD)
const repairDateInput = document.getElementById('repairDate');
if (repairDateInput) {
  repairDateInput.value = new Date().toISOString().split('T')[0];
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

    // 1. KPI Counts
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

    // 3. Populate Recent Logs Table
    renderLogsTable(data.recentRepairs);

  } catch (err) {
    console.error('Dashboard Error:', err);
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

    const logDate = log.repairDate || (log.createdAt ? new Date(log.createdAt).toISOString().split('T')[0] : '---');

    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-color)';
    row.innerHTML = `
      <td style="padding: 10px 4px; font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">${logDate}</td>
      <td style="padding: 10px 4px; font-weight: 700;">${log.serialNumber}</td>
      <td style="padding: 10px 4px;">${log.merchantName}</td>
      <td style="padding: 10px 4px; color: var(--text-muted);">${log.faultType}</td>
      <td style="padding: 10px 4px;"><span class="badge ${badgeClass}">${log.status}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

// Handle Terminal Repair Logging
const repairForm = document.getElementById('repairForm');
if (repairForm) {
  repairForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Documenting...';

    const payload = {
      repairDate: document.getElementById('repairDate').value,
      serialNumber: document.getElementById('serialNumber').value.trim(),
      merchantName: document.getElementById('merchantName').value.trim(),
      faultType: document.getElementById('faultType').value,
      status: document.getElementById('status').value
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
        // Reset date back to current day after form reset
        if (repairDateInput) repairDateInput.value = new Date().toISOString().split('T')[0];
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

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

loadDashboard();

