const API_URL = '';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

// Route guard: Redirect to login if user is not authenticated
if (!token || !user) {
  window.location.href = 'index.html';
}

// Display Technician Info
if (document.getElementById('techGreeting')) {
  document.getElementById('techGreeting').innerText = `Welcome, ${user.name || 'Technician'}`;
}
if (document.getElementById('techIdDisplay')) {
  document.getElementById('techIdDisplay').innerText = `Tech ID: ${user.techId || 'N/A'}`;
}

// Fetch Dashboard Metrics & Logs
async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Failed to fetch dashboard data');

    // Update Today & Weekly Repair Summary Counts
    if (document.getElementById('todayRepairCount')) {
      document.getElementById('todayRepairCount').innerText = `${data.todayRepairsCount || 0} Terminals`;
    }
    if (document.getElementById('weeklyRepairCount')) {
      document.getElementById('weeklyRepairCount').innerText = `${data.weeklyRepairsCount || 0} Terminals`;
    }

    // Populate Weekly Transport Allowance Checkboxes
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
      const checkbox = document.getElementById(day);
      if (checkbox && data.transportDays) {
        checkbox.checked = !!data.transportDays[day];
      }
    });
    calculateTransportUI();

    // Render Recent Repair Logs Table
    renderLogsTable(data.recentRepairs);

  } catch (err) {
    console.error('Dashboard Error:', err);
  }
}

// Render Recent Repair Logs with Colorful Status Badges
function renderLogsTable(logs) {
  const tableBody = document.getElementById('repairLogsTable');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (!logs || logs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 16px 0; text-align: center; color: var(--text-muted, #64748B);">
          No terminal records logged today.
        </td>
      </tr>`;
    return;
  }

  logs.forEach(log => {
    let badgeClass = 'badge-fixed';
    if (log.status === 'Replaced Terminal') badgeClass = 'badge-replaced';
    if (log.status === 'Pending Part') badgeClass = 'badge-pending';

    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-color, #E2E8F0)';
    row.innerHTML = `
      <td style="padding: 12px 4px; font-weight: 700;">${log.serialNumber}</td>
      <td style="padding: 12px 4px; color: var(--text-main, #0F172A);">${log.merchantName}</td>
      <td style="padding: 12px 4px; color: var(--text-muted, #64748B);">${log.faultType}</td>
      <td style="padding: 12px 4px;"><span class="badge ${badgeClass}">${log.status}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

// Document Terminal Repair Form Submission
const repairForm = document.getElementById('repairForm');
if (repairForm) {
  repairForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Documenting...';
    }

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

      const data = await res.json();

      if (res.ok) {
        repairForm.reset();
        loadDashboard(); // Refresh metrics & logs table
      } else {
        alert(data.message || 'Failed to document repair');
      }
    } catch (err) {
      alert('Failed to connect to server');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = '+ Log Repair Record';
      }
    }
  });
}

// Update Transport Checkbox Selections
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
    alert('Failed to update transport allowance selection');
  }
}

// Calculate Transport Allowance total (₦4,000 per checked day)
function calculateTransportUI() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  let checkedCount = 0;
  days.forEach(day => {
    const el = document.getElementById(day);
    if (el && el.checked) checkedCount++;
  });
  const total = checkedCount * 4000;
  const transportTotalEl = document.getElementById('transportTotal');
  if (transportTotalEl) {
    transportTotalEl.innerText = `₦${total.toLocaleString()}`;
  }
}

// Logout
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// Initial Load
loadDashboard();
