const API_URL = '';

function toggleAuth(showRegister) {
  document.getElementById('loginForm').style.display = showRegister ? 'none' : 'block';
  document.getElementById('registerForm').style.display = showRegister ? 'block' : 'none';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const agentId = document.getElementById('loginAgentId').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Failed to connect to server');
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const agentId = document.getElementById('regAgentId').value;
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, agentId, password })
    });
    const data = await res.json();
    if (res.ok) {
      alert('Registration successful! Please login.');
      toggleAuth(false);
    } else {
      alert(data.message);
    }
  } catch (err) {
    alert('Failed to register');
  }
});
