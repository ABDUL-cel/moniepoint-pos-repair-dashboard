
const API_URL = '';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token) window.location.href = 'index.html';

document.getElementById('agentGreeting').innerText = `Welcome, ${user.name}`;
document.getElementById('agentIdDisplay').innerText = `Agent ID: ${user.agentId}`;

// Fetch Dashboard Data
async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    // Update Daily
    document.getElementById('todayCount').innerText = data.todayPos;
    const progressPercent = Math.min((data.todayPos / 15) * 100, 100);
    document.getElementById('dailyProgressBar').style.width = `${progressPercent}%`;

    // Update Weekly Bonus: (current_pos / 72) * 30000
    document.getElementById('weeklyCount').innerText = data.weeklyPos;
    const bonusEarned = Math.round((data.weeklyPos / 72) * 30000);
    document.getElementById('earnedBonus').innerText = `₦${bonusEarned.toLocaleString()}`;

    // Update Transport Checkboxes
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
      if (data.transportDays) {
        document.getElementById(day).checked = !!data.transportDays[day];
      }
    });
    calculateTransportUI();

  } catch (err) {
    console.error(err);
  }
}

// Deploy POS Button Click
async function deployPos() {
  try {
    const res = await fetch(`${API_URL}/api/dashboard/deploy`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) loadDashboard();
  } catch (err) {
    alert('Failed to deploy POS');
  }
}

// Update Transport Checkboxes
async function updateTransport() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const transportDays = {};
  days.forEach(day => {
    transportDays[day] = document.getElementById(day).checked;
  });

  try {
    await fetch(`${API_URL}/api/dashboard/transport`, {
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
    if (document.getElementById(day).checked) checkedCount++;
  });
  const total = checkedCount * 4000;
  document.getElementById('transportTotal').innerText = `₦${total.toLocaleString()}`;
}

function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

loadDashboard();
