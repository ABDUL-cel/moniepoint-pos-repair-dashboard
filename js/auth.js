const API_URL = '';

if (localStorage.getItem('token')) {
  window.location.href = 'dashboard.html';
}

function toggleAuth(showRegister) {
  document.getElementById('loginForm').style.display = showRegister ? 'none' : 'block';
  document.getElementById('registerForm').style.display = showRegister ? 'block' : 'none';
}

// Technician Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginBtn.innerText = 'Signing in...';

  const techId = document.getElementById('loginTechId').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ techId, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } else {
      alert(data.message || 'Login failed');
    }
  } catch (err) {
    alert('Failed to connect to the server');
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerText = 'Sign In';
  }
});

// Technician Registration
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const regBtn = document.getElementById('regBtn');
  regBtn.disabled = true;
  regBtn.innerText = 'Registering...';

  const name = document.getElementById('regName').value.trim();
  const password = document.getElementById('regPassword').value;

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert(`Registration successful!\n\nYour Tech ID is: ${data.techId}\n\nPlease save this ID to log in.`);
      document.getElementById('loginTechId').value = data.techId;
      toggleAuth(false);
    } else {
      alert(data.message || 'Registration failed');
    }
  } catch (err) {
    alert('Failed to connect to the server');
  } finally {
    regBtn.disabled = false;
    regBtn.innerText = 'Register Account';
  }
});
