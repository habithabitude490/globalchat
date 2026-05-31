const API_USERS = '/api/users';
let searchTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('token')) {
        window.location.href = '/pages/login.html';
        return;
    }

    loadCurrentUser();

    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    const searchInput = document.getElementById('searchInput');
    const filterCountry = document.getElementById('filterCountry');
    const filterLanguage = document.getElementById('filterLanguage');
    const filterInterest = document.getElementById('filterInterest');

    [searchInput, filterCountry, filterLanguage, filterInterest].forEach(input => {
        if (input) {
            input.addEventListener('input', debouncedSearch);
        }
    });
});

async function loadCurrentUser() {
    try {
        const result = await apiRequest('/api/auth/me');
        const user = result.user;
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
    } catch (error) {
        console.error('Failed to load user:', error);
    }
}

function debouncedSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(performSearch, 350);
}

async function performSearch() {
    const term = document.getElementById('searchInput')?.value.trim() || '';
    const country = document.getElementById('filterCountry')?.value.trim() || '';
    const language = document.getElementById('filterLanguage')?.value.trim() || '';
    const interest = document.getElementById('filterInterest')?.value.trim() || '';

    if (!term && !country && !language && !interest) {
        document.getElementById('searchResults').innerHTML = `
            <div class="search-empty">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#B5B5B5" stroke-width="1"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <h3>Discover people around the world</h3>
                <p>Start typing to find someone to chat with.</p>
            </div>`;
        document.getElementById('searchCount').textContent = '';
        return;
    }

    const params = new URLSearchParams();
    if (term) params.set('q', term);
    if (country) params.set('country', country);
    if (language) params.set('language', language);
    if (interest) params.set('interest', interest);
    params.set('limit', '30');

    try {
        const container = document.getElementById('searchResults');
        container.innerHTML = '<div class="search-empty"><p>Searching...</p></div>';

        const result = await apiRequest(`${API_USERS}/search?${params.toString()}`);
        const users = result.users || [];

        document.getElementById('searchCount').textContent = users.length > 0 ? `${users.length} user${users.length > 1 ? 's' : ''} found` : '';

        if (users.length === 0) {
            container.innerHTML = `
                <div class="search-empty">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#B5B5B5" stroke-width="1"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <h3>No users found</h3>
                    <p>Try different search terms or filters.</p>
                </div>`;
            return;
        }

        container.innerHTML = users.map(user => {
            const initials = (user.display_name || '?').charAt(0).toUpperCase();
            const languages = Array.isArray(user.languages) ? user.languages : [];
            const interests = Array.isArray(user.interests) ? user.interests : [];

            return `
                <div class="search-result-card" data-user-id="${user.id}">
                    <div class="result-avatar">
                        ${user.avatar_url
                            ? `<img src="${user.avatar_url}" alt="${user.display_name}">`
                            : `<div class="result-avatar-placeholder">${initials}</div>`
                        }
                    </div>
                    <div class="result-info">
                        <div class="result-name">
                            ${escapeHtml(user.display_name)}
                            <span>@${escapeHtml(user.username)}</span>
                        </div>
                        <div class="result-details">
                            ${user.country ? escapeHtml(user.country) : 'Unknown'}
                            ${languages.length > 0 ? ' | ' + languages.slice(0, 3).join(', ') : ''}
                            ${!user.country && languages.length === 0 ? 'No location data' : ''}
                        </div>
                        <div class="result-status ${user.status === 'online' ? 'online' : 'offline'}">
                            ${user.status === 'online' ? 'Online now' : 'Offline'}
                            ${user.last_seen ? ' - Last seen ' + formatTimeAgo(user.last_seen) : ''}
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-primary btn-sm chat-now-btn" data-user-id="${user.id}">Chat</button>
                    </div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.chat-now-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                startConversation(this.dataset.userId);
            });
        });

        container.querySelectorAll('.search-result-card').forEach(card => {
            card.addEventListener('click', function() {
                const userId = this.dataset.userId;
                if (userId) startConversation(userId);
            });
        });
    } catch (error) {
        console.error('Search failed:', error);
        document.getElementById('searchResults').innerHTML = `
            <div class="search-empty">
                <h3>Search failed</h3>
                <p>Please try again later.</p>
            </div>`;
    }
}

async function startConversation(userId) {
    try {
        const result = await apiRequest(`${API_USERS}/${userId}/conversation`, {
            method: 'POST'
        });
        const conversation = result.conversation;
        window.location.href = `/pages/dashboard.html?conversation=${conversation.id}&user=${userId}`;
    } catch (error) {
        showToast(error.message || 'Failed to start conversation', 'error');
    }
}

async function handleLogout() {
    try {
        await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    disconnectSocket();
    removeToken();
    window.location.href = '/pages/login.html';
}

function showToast(message, type) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString();
}