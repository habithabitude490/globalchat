const API_ADMIN = '/api/admin';

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('token')) {
        window.location.href = '/pages/login.html';
        return;
    }

    checkAdminAccess();

    document.querySelectorAll('.admin-nav .nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.dataset.section;

            document.querySelectorAll('.admin-nav .nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
            document.getElementById(`${section}Section`).style.display = 'block';

            if (section === 'overview') loadStats();
            if (section === 'users') loadUsers();
            if (section === 'reports') loadReports();
            if (section === 'logs') loadLogs();
        });
    });

    loadStats();

    document.getElementById('adminUserSearch')?.addEventListener('input', debounce(function() {
        loadUsers();
    }, 300));
});

async function checkAdminAccess() {
    try {
        const result = await apiRequest('/api/auth/me');
        if (!result.user.is_admin) {
            window.location.href = '/pages/dashboard.html';
        }
    } catch (error) {
        window.location.href = '/pages/login.html';
    }
}

async function loadStats() {
    try {
        const result = await apiRequest(API_ADMIN + '/stats');

        document.getElementById('statTotalUsers').textContent = result.users?.total || 0;
        document.getElementById('statOnlineUsers').textContent = result.users?.online || 0;
        document.getElementById('statVerifiedUsers').textContent = result.users?.verified || 0;
        document.getElementById('statBannedUsers').textContent = result.users?.banned || 0;
        document.getElementById('statTodayUsers').textContent = result.users?.joined_today || 0;
        document.getElementById('statConversations').textContent = result.conversations?.total || 0;
        document.getElementById('statMessages').textContent = result.messages?.total || 0;
        document.getElementById('statPendingReports').textContent = result.reports?.pending || 0;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadUsers(page = 1) {
    const search = document.getElementById('adminUserSearch')?.value || '';
    const params = new URLSearchParams({ page, limit: 20 });
    if (search) params.set('search', search);

    try {
        const result = await apiRequest(`${API_ADMIN}/users?${params.toString()}`);
        const users = result.users || [];

        const tbody = document.getElementById('adminUsersTable');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray-medium);padding:40px;">No users found.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => {
            const initials = (user.display_name || user.username || '?').charAt(0).toUpperCase();
            return `
                <tr>
                    <td>
                        <div class="admin-user-cell">
                            <div class="admin-user-avatar">
                                <div style="width:32px;height:32px;border-radius:50%;background:var(--gray-light);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:600;color:var(--gray-medium);">${initials}</div>
                            </div>
                            <div>
                                <div class="admin-user-name">${escapeHtml(user.display_name || user.username)}</div>
                                <div style="font-size:0.75rem;color:var(--gray-medium);">@${escapeHtml(user.username)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${user.country || '-'}</td>
                    <td>${user.is_banned
                        ? '<span class="admin-badge admin-badge-banned">Banned</span>'
                        : '<span class="admin-badge admin-badge-active">Active</span>'}
                    </td>
                    <td>${user.is_verified ? 'Yes' : 'No'}</td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                        ${user.is_banned
                            ? `<button class="action-btn unban-btn" data-user-id="${user.id}">Unban</button>`
                            : `<button class="action-btn action-btn-danger ban-btn" data-user-id="${user.id}">Ban</button>`
                        }
                        ${user.is_admin ? '<span class="admin-badge admin-badge-admin">Admin</span>' : ''}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.ban-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const reason = prompt('Enter ban reason:');
                if (reason === null) return;
                await toggleBan(this.dataset.userId, true, reason);
            });
        });

        tbody.querySelectorAll('.unban-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                if (confirm('Unban this user?')) {
                    await toggleBan(this.dataset.userId, false);
                }
            });
        });

        const totalPages = Math.ceil((result.total || users.length) / 20);
        renderPagination('usersPagination', page, totalPages, (p) => loadUsers(p));
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function toggleBan(userId, ban, reason) {
    try {
        await apiRequest(`${API_ADMIN}/users/${userId}/ban`, {
            method: 'PATCH',
            body: JSON.stringify({ ban, reason })
        });
        loadUsers();
        showToast(ban ? 'User banned' : 'User unbanned', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadReports(page = 1) {
    try {
        const result = await apiRequest(`${API_ADMIN}/reports?page=${page}&limit=20`);
        const reports = result.reports || [];

        const tbody = document.getElementById('adminReportsTable');
        if (!tbody) return;

        if (reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray-medium);padding:40px;">No reports found.</td></tr>';
            return;
        }

        tbody.innerHTML = reports.map(r => `
            <tr>
                <td>${escapeHtml(r.reporter_name)}</td>
                <td>
                    <div class="admin-user-name">${escapeHtml(r.reported_display || r.reported_name)}</div>
                    <div style="font-size:0.75rem;color:var(--gray-medium);">@${escapeHtml(r.reported_name)}</div>
                </td>
                <td><span class="admin-badge" style="background:var(--beige);">${r.reason}</span></td>
                <td><span class="admin-badge ${r.status === 'pending' ? 'admin-badge-active' : r.status === 'resolved' ? 'admin-badge-admin' : ''}">${r.status}</span></td>
                <td>${new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                    ${r.status === 'pending' ? `
                        <button class="action-btn resolve-btn" data-id="${r.id}" data-status="resolved">Resolve</button>
                        <button class="action-btn dismiss-btn" data-id="${r.id}" data-status="dismissed">Dismiss</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.resolve-btn, .dismiss-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                await resolveReport(this.dataset.id, this.dataset.status);
            });
        });
    } catch (error) {
        console.error('Failed to load reports:', error);
    }
}

async function resolveReport(reportId, status) {
    try {
        await apiRequest(`${API_ADMIN}/reports/${reportId}/resolve`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        loadReports();
        loadStats();
        showToast(`Report ${status}`, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadLogs(page = 1) {
    try {
        const result = await apiRequest(`${API_ADMIN}/logs?page=${page}&limit=50`);
        const logs = result.logs || [];

        const tbody = document.getElementById('adminLogsTable');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-medium);padding:40px;">No logs found.</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${escapeHtml(log.admin_username)}</td>
                <td><code style="background:var(--beige);padding:2px 6px;border-radius:3px;font-size:0.8rem;">${log.action}</code></td>
                <td>${escapeHtml(log.target_type || '-')}</td>
                <td>${log.ip_address || '-'}</td>
                <td>${new Date(log.created_at).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

function renderPagination(containerId, currentPage, totalPages, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="${currentPage - 1}">Previous</button>`;

    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">Next</button>`;

    container.innerHTML = html;

    container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', function() {
            callback(parseInt(this.dataset.page));
        });
    });
}

function showToast(message, type) {
    const container = document.querySelector('.admin-main') || document.body;
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:4px;background:${type === 'error' ? '#C0392B' : '#27AE60'};color:#fff;font-size:0.85rem;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideIn 0.3s ease;`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
