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
window.initTheme = function() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButton(savedTheme);
};

window.toggleTheme = function() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeButton(newTheme);
};

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

    // 2. Daily Target
    const dailyPct = Math.min(Math.round((todayCount / 15) * 100), 100);
    if (document.getElementById('dailyCountText')) document.getElementById('dailyCountText').innerText = todayCount;
    if (document.getElementById('dailyCircle')) document.getElementById('dailyCircle').setAttribute('stroke-dasharray', `${dailyPct}, 100`);
    if (document.getElementById('dailyBar')) document.getElementById('dailyBar').style.width = `${dailyPct}%`;
    if (document.getElementById('dailyBarLabel')) document.getElementById('dailyBarLabel').innerText = `${dailyPct}%`;

    // 3. Weekly Bonus
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

    // 5. Transport UI Sync
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

    // 6. Table
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

window.updateMissedWeeks = async function(missedValue) {
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
};

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

// Automatically set date picker default to Today
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('repairDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
});

// Form Submission Event Listener
document.addEventListener('DOMContentLoaded', () => {
  const repairForm = document.getElementById('repairForm');
  if (repairForm) {
    repairForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Documenting...';
      }

      const dateEl = document.getElementById('repairDate');

      const payload = {
        serialNumber: document.getElementById('serialNumber').value.trim(),
        merchantName: document.getElementById('merchantName').value.trim(),
        faultType: document.getElementById('faultType').value,
        status: document.getElementById('status').value,
        repairDate: dateEl ? dateEl.value : new Date().toISOString().split('T')[0]
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
          if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
          await loadDashboard();
        } else {
          const data = await res.json();
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
});

// Transport Allowance Update Handler
window.updateTransport = async function() {
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
};

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

// PDF EXPORT FUNCTIONALITY
window.downloadPerformancePDF = async function(type = 'weekly') {
  if (!window.jspdf) {
    alert('PDF generation library is loading, please try again in a moment.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const techName = user?.name || 'Technician';
  const techId = user?.techId || user?.agentId || 'N/A';
  const today = new Date().toLocaleDateString('en-GB');

  let repairs = [];
  try {
    const res = await fetch(`${API_URL}/api/repairs/export?range=${type}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      repairs = await res.json();
    }
  } catch (err) {
    console.warn("Could not fetch remote export data, building table from DOM.");
  }

  // 1. Header Banner
  doc.setFillColor(0, 82, 255); // Moniepoint Blue
  doc.rect(0, 0, 210, 24, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("MONIEPOINT FIELD OPS - PERFORMANCE REPORT", 14, 15);

  // 2. Metadata Section
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  doc.text(`Technician: ${techName} (${techId})`, 14, 33);
  doc.text(`Report Period: ${type.toUpperCase()} SUMMARY`, 14, 40);
  doc.text(`Generated: ${today}`, 14, 47);

  const weeklyCount = document.getElementById('weeklyRepairCount')?.innerText || '0';
  const monthlyCount = document.getElementById('monthlyRepairCount')?.innerText || '0';
  const payout = document.getElementById('monthlyPayoutText')?.innerText || '₦0';

  doc.setFont("helvetica", "bold");
  if (type === 'weekly') {
    doc.text(`Weekly Repairs: ${weeklyCount}`, 125, 33);
    doc.text(`Target: 72 Terminals`, 125, 40);
  } else {
    doc.text(`Monthly Repairs: ${monthlyCount}`, 125, 33);
    doc.text(`Projected Pay: ${payout}`, 125, 40);
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 52, 196, 52);

  // 3. Table Rows
  const tableRows = [];

  if (repairs && repairs.length > 0) {
    repairs.forEach(item => {
      tableRows.push([
        new Date(item.createdAt || item.repairDate).toLocaleDateString(),
        item.serialNumber || 'N/A',
        item.merchantName || 'N/A',
        item.faultType || 'N/A',
        item.status || 'N/A'
      ]);
    });
  } else {
    // Read from current HTML table as fallback
    const rows = document.querySelectorAll('#repairLogsTable tr');
    rows.forEach(tr => {
      const cols = tr.querySelectorAll('td');
      if (cols.length >= 5 && !cols[0].innerText.includes('Loading')) {
        tableRows.push([
          cols[0].innerText.trim(),
          cols[1].innerText.trim(),
          cols[2].innerText.trim(),
          cols[3].innerText.trim(),
          cols[4].innerText.trim()
        ]);
      }
    });
  }

  // 4. AutoTable Generation
  doc.autoTable({
    startY: 56,
    head: [['Date / Time', 'Serial Number', 'Merchant Name', 'Fault Type', 'Status']],
    body: tableRows.length > 0 ? tableRows : [['-', 'No logged repairs found for this period', '-', '-', '-']],
    headStyles: { fillColor: [0, 82, 255], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { bottom: 25 }
  });

  // 5. PDF Footer Credit
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Created by Khalid Abdulazeez | Page ${i} of ${pageCount}`,
      105,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  doc.save(`Moniepoint_${type.toUpperCase()}_Report_${today.replace(/\//g, '-')}.pdf`);
};

window.logout = function() {
  localStorage.clear();
  window.location.href = 'index.html';
};

loadDashboard();
