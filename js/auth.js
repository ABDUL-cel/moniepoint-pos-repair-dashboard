const API_URL = 'https://moniepoint-pos-repair-dashboard.onrender.com';

function toggleAuth(showRegister) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  
  if (showRegister) {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  } else {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }
}

// LOGIN SUBMIT
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const techId = document.getElementById('loginTechId').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.disabled = true;
    loginBtn.innerText = 'Signing in...';

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
      alert('Could not connect to server.');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerText = 'Sign In';
    }
  });
}

// REGISTER SUBMIT (Includes selected transport days)
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('regName').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const regBtn = document.getElementById('regBtn');

    // Gather transport days selected
    const transportDays = {};
    document.querySelectorAll('.reg-day').forEach(cb => {
      transportDays[cb.value] = cb.checked;
    });

    regBtn.disabled = true;
    regBtn.innerText = 'Creating account...';

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, transportDays })
      });

      const data = await res.json();

      if (res.ok) {
        alert(`Account created successfully! Your Tech ID is: ${data.techId}`);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'dashboard.html';
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (err) {
      alert('Could not connect to server.');
    } finally {
      regBtn.disabled = false;
      regBtn.innerText = 'Register Account';
    }
  });
}
