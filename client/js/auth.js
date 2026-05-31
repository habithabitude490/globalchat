const API_BASE = '/api/auth';

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function isAuthenticated() {
    return !!getToken();
}

function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        window.location.href = '/pages/dashboard.html';
    }
}

function redirectIfNotAuthenticated() {
    if (!isAuthenticated()) {
        window.location.href = '/pages/login.html';
    }
}

async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        if (error.message.includes('TOKEN_EXPIRED') || error.message.includes('Invalid token')) {
            removeToken();
            window.location.href = '/pages/login.html';
        }
        throw error;
    }
}

async function loadCurrentUser() {
    try {
        const result = await apiRequest('/api/auth/me');
        const user = result.user;
        if (!user) { handleLogout(); return; }
        sessionStorage.setItem('currentUser', JSON.stringify(user));

        const sidebarName = document.getElementById('sidebarName');
        if (sidebarName) sidebarName.textContent = user.display_name || user.username;

        const avatarImg = document.getElementById('avatarImg');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        if (user.avatar_url && avatarImg) {
            avatarImg.src = user.avatar_url;
            avatarImg.style.display = 'block';
            if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
        } else if (avatarPlaceholder) {
            avatarPlaceholder.textContent = (user.display_name || '?').charAt(0).toUpperCase();
            avatarPlaceholder.style.display = 'flex';
            if (avatarImg) avatarImg.style.display = 'none';
        }

        const adminNav = document.querySelector('[data-section="admin"]');
        if (adminNav) adminNav.style.display = user.is_admin ? 'flex' : 'none';

        if (user.is_admin) {
            const existing = document.querySelector('.sidebar-nav a[href="/pages/admin.html"]');
            if (!existing) {
                const adminItem = document.createElement('a');
                adminItem.href = '/pages/admin.html';
                adminItem.className = 'nav-item';
                adminItem.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Admin</span>';
                document.querySelector('.sidebar-nav')?.appendChild(adminItem);
            }
        }
    } catch (error) {
        console.error('Failed to load user:', error);
        if (error.message.includes('Token') || error.message.includes('Authentication')) {
            handleLogout();
        }
    }
}

async function handleLogout() {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    if (typeof disconnectSocket === 'function') disconnectSocket();
    removeToken();
    sessionStorage.removeItem('currentUser');
    window.location.href = '/pages/login.html';
}

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    const resetForm = document.getElementById('resetForm');

    if (loginForm) {
        redirectIfAuthenticated();
        setupLoginForm(loginForm);
    }

    if (registerForm) {
        redirectIfAuthenticated();
        setupRegisterForm(registerForm);
    }

    if (forgotForm) {
        setupForgotForm(forgotForm);
    }

    if (resetForm) {
        setupResetForm(resetForm);
    }

    setupVerifyPage();
});

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
    }
}

function hideError(elementId) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}

function showFieldError(input, message) {
    const errorEl = input.parentElement.querySelector('.form-error');
    if (errorEl) {
        errorEl.textContent = message;
    }
    input.classList.add('input-error');
}

function clearFieldError(input) {
    const errorEl = input.parentElement.querySelector('.form-error');
    if (errorEl) {
        errorEl.textContent = '';
    }
    input.classList.remove('input-error');
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.disabled = loading;
        btn.textContent = loading ? 'Processing...' : btn.dataset.originalText || btn.textContent;
        if (!btn.dataset.originalText) {
            btn.dataset.originalText = btn.textContent;
        }
    }
}

function setupLoginForm(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideError('loginError');

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showError('loginError', 'Please fill in all fields');
            return;
        }

        setLoading('loginBtn', true);

        try {
            const result = await apiRequest(`${API_BASE}/login`, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            setToken(result.token);
            window.location.href = '/pages/dashboard.html';
        } catch (error) {
            showError('loginError', error.message);
        } finally {
            setLoading('loginBtn', false);
        }
    });

    document.querySelectorAll('#loginForm input').forEach(input => {
        input.addEventListener('input', function() { clearFieldError(this); });
    });
}

function setupRegisterForm(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideError('registerError');

        const username = document.getElementById('username').value.trim();
        const display_name = document.getElementById('display_name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password_confirm').value;

        let valid = true;

        if (!username || username.length < 3) {
            showFieldError(document.getElementById('username'), 'Username must be at least 3 characters');
            valid = false;
        }
        if (!display_name || display_name.length < 2) {
            showFieldError(document.getElementById('display_name'), 'Display name is required');
            valid = false;
        }
        if (!email) {
            showFieldError(document.getElementById('email'), 'Valid email is required');
            valid = false;
        }
        if (password.length < 8) {
            showFieldError(document.getElementById('password'), 'Password must be at least 8 characters');
            valid = false;
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            showFieldError(document.getElementById('password'), 'Password must contain uppercase, lowercase, and a number');
            valid = false;
        }
        if (password !== passwordConfirm) {
            showFieldError(document.getElementById('password_confirm'), 'Passwords do not match');
            valid = false;
        }

        if (!valid) return;

        const termsCheckbox = form.querySelector('input[name="terms"]');
        if (termsCheckbox && !termsCheckbox.checked) {
            showError('registerError', 'You must agree to the Terms of Service');
            return;
        }

        setLoading('registerBtn', true);

        try {
            const result = await apiRequest(`${API_BASE}/register`, {
                method: 'POST',
                body: JSON.stringify({ username, display_name, email, password })
            });

            setToken(result.token);
            window.location.href = '/pages/dashboard.html';
        } catch (error) {
            showError('registerError', error.message);
        } finally {
            setLoading('registerBtn', false);
        }
    });

    document.querySelectorAll('#registerForm input').forEach(input => {
        input.addEventListener('input', function() { clearFieldError(this); });
    });
}

function setupForgotForm(form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideError('forgotError');
        hideError('forgotSuccess');

        const email = document.getElementById('email').value.trim();

        if (!email) {
            showError('forgotError', 'Please enter your email');
            return;
        }

        setLoading('forgotBtn', true);

        try {
            const result = await apiRequest(`${API_BASE}/forgot-password`, {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            document.getElementById('forgotSuccess').textContent = result.message;
            document.getElementById('forgotSuccess').style.display = 'block';
            form.querySelector('button').disabled = true;
        } catch (error) {
            showError('forgotError', error.message);
        } finally {
            setLoading('forgotBtn', false);
        }
    });
}

function setupResetForm(form) {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        document.getElementById('token').value = token;
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideError('resetError');
        hideError('resetSuccess');

        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password_confirm').value;
        const token = document.getElementById('token').value;

        if (!token) {
            showError('resetError', 'Invalid reset link');
            return;
        }

        if (password.length < 8) {
            showError('resetError', 'Password must be at least 8 characters');
            return;
        }
        if (password !== passwordConfirm) {
            showError('resetError', 'Passwords do not match');
            return;
        }

        setLoading('resetBtn', true);

        try {
            const result = await apiRequest(`${API_BASE}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({ token, password })
            });

            document.getElementById('resetSuccess').textContent = result.message;
            document.getElementById('resetSuccess').style.display = 'block';
            setTimeout(() => {
                window.location.href = '/pages/login.html';
            }, 2000);
        } catch (error) {
            showError('resetError', error.message);
        } finally {
            setLoading('resetBtn', false);
        }
    });
}

async function setupVerifyPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) return;

    try {
        const result = await apiRequest(`${API_BASE}/verify-email/${token}`);

        document.getElementById('verifyIcon').innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="1.5">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>`;
        document.getElementById('verifyTitle').textContent = 'Email Verified!';
        document.getElementById('verifyMessage').textContent = 'Your email has been verified successfully.';
        document.getElementById('verifySuccess').style.display = 'block';
    } catch (error) {
        document.getElementById('verifyIcon').innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`;
        document.getElementById('verifyTitle').textContent = 'Verification Failed';
        document.getElementById('verifyMessage').textContent = error.message || 'The link is invalid or expired.';
        document.getElementById('verifyError').style.display = 'block';
    }
}
