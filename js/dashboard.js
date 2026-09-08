const API_URL = 'https://moniepoint-pos-repair-dashboard.onrender.com';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = 'index.html';
}

// Set Greeting
if (document.getElementById('techGreeting')) {
  document.getElementById('techGreeting').innerText = user.name || 'Technician';
}
if (document.getElementById('techIdDisplay')) {
  document.getElementById('techIdDisplay').innerText = `ID: ${user.techId || user.agentId || '---'}`;
}

// --- DARK MODE TOGGLE LOGIC ---
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

// --- FETCH DASHBOARD DATA ---
async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to fetch dashboard data');

    const todayCount = data.todayRepairsCount || 0;
    const weeklyCount = data.weeklyRepairsCount || 0;
    const yearlyCount = data.yearlyRepairsCount || 0;

    // 1. KPI Counts
    if (document.getElementById('todayRepairCount')) document.getElementById('todayRepairCount').innerText = todayCount;
    if (document.getElementById('weeklyRepairCount')) document.getElementById('weeklyRepairCount').innerText = weeklyCount;
    if (document.getElementById('yearlyRepairCount')) document.getElementById('yearlyRepairCount').innerText = yearlyCount;

    // 2. Daily Target Calculations (15 / Day)
    const dailyPct = Math.min(Math.round((todayCount / 15) * 100), 100);
    if (document.getElementById('dailyCountText')) document.getElementById('dailyCountText').innerText = todayCount;
    if (document.getElementById('dailyCircle')) document.getElementById('dailyCircle').setAttribute('stroke-dasharray', `${dailyPct}, 100`);
    if (document.getElementById('dailyBar')) document.getElementById('dailyBar').style.width = `${dailyPct}%`;
    if (document.getElementById('dailyBarLabel')) document.getElementById('dailyBarLabel').innerText = `${dailyPct}%`;

    // 3. Weekly Bonus Target Calculations (72 = ₦30,000)
    const weeklyPct = Math.min(Math.round((weeklyCount / 72) * 100), 100);
    if (document.getElementById('weeklyCountText')) document.getElementById('weeklyCountText').innerText = weeklyCount;
    if (document.getElementById('weeklyCircle')) document.getElementById('weeklyCircle').setAttribute('stroke-dasharray', `${weeklyPct}, 100`);
    if (document.getElementById('weeklyBar')) document.getElementById('weeklyBar').style.width = `${weeklyPct}%`;
    if (document.getElementById('weeklyBarLabel')) document.getElementById('weeklyBarLabel').innerText = `${weeklyPct}%`;

    const bonusEarned = Math.round((weeklyCount / 72) * 30000);
    if (document.getElementById('bonusEarnedText')) document.getElementById('bonusEarnedText').innerText = `₦${bonusEarned.toLocaleString()}`;

    // 4. Transport Selection Sync
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
      const checkbox = document.getElementById(day);
      if (checkbox && data.transportDays) {
        checkbox.checked = !!data.transportDays[day];
      }
    });
    calculateTransportUI();

    // 5. Render History Logs
    renderLogsTable(data.recentRepairs);

  } catch (err) {
    console.error('Dashboard Error:', err);
  }
}

// Render Table Logs
function renderLogsTable(logs) {
  const tableBody = document.getElementById('repairLogsTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (!logs || logs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 16px 0; text-align: center; color: var(--text-muted);">
          No terminal records logged today.
        </td>
      </tr>`;
    return;
  }

  logs.forEach(log => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-color)';
    row.innerHTML = `
      <td style="padding: 10px 4px; font-weight: 700;">${log.serialNumber}</td>
      <td style="padding: 10px 4px;">${log.merchantName}</td>
      <td style="padding: 10px 4px; color: var(--text-muted);">${log.faultType}</td>
      <td style="padding: 10px 4px;"><span class="badge">${log.status}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

// Form Submission
const repairForm = document.getElementById('repairForm');
if (repairForm) {
  repairForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Documenting...';

    const payload = {
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
        loadDashboard();
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

// Update Transport
async function updateTransport() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const transportDays = {};
  days.forEach(day => {
    const el = document.getElementById(day);
    transportDays[day] = el ? el.checked : false;
  });

  try {
    await fetch(`${API_URL}/api/transport/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ transportDays })
    });
    calculateTransportUI();
  } catch (err) {
    alert('Failed to update transport selection');
  }
}

function calculateTransportUI() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  let checkedCount = 0;
  days.forEach(day => {
    const el = document.getElementById(day);
    if (el && el.checked) checkedCount++;
  });
  
  const transportTotalEl = document.getElementById('transportTotal');
  if (transportTotalEl) {
    transportTotalEl.innerText = `₦${(checkedCount * 4000).toLocaleString()}`;
  }
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

loadDashboard();
