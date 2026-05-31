let onlineUsersData = [];

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('token')) {
        window.location.href = '/pages/login.html';
        return;
    }

    loadCurrentUser();
    loadOnlineUsers();

    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            if (this.dataset.section === 'contacts') {
                loadContacts();
            }
        });
    });

    initChat();

    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversation');
    const userId = urlParams.get('user');
    if (convId && userId) {
        setTimeout(function() { openConversation(convId, userId); }, 500);
    }

    if (document.getElementById('conversationSearch')) {
        document.getElementById('conversationSearch').addEventListener('input', function() {
            filterConversations(this.value);
        });
    }

    document.addEventListener('user:status', function(e) {
        const data = e.detail;
        if (data.status === 'online') {
            addOnlineUser(data);
        } else {
            removeOnlineUser(data.userId);
        }
    });

    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

function filterConversations(query) {
    const items = document.querySelectorAll('.conversation-item');
    const q = query.toLowerCase().trim();

    items.forEach(item => {
        const name = item.querySelector('.conversation-name')?.textContent?.toLowerCase() || '';
        const lastMsg = item.querySelector('.conversation-last-message')?.textContent?.toLowerCase() || '';
        item.style.display = (!q || name.includes(q) || lastMsg.includes(q)) ? 'flex' : 'none';
    });
}

async function loadOnlineUsers() {
    try {
        const result = await apiRequest('/api/users/online');
        onlineUsersData = result.users || [];
        renderOnlineUsers();
    } catch (error) {
        console.error('Failed to load online users:', error);
    }
}

function renderOnlineUsers() {
    const container = document.getElementById('onlineUsersList');
    const items = document.getElementById('onlineUsersItems');
    const title = document.getElementById('onlineUsersTitle');
    if (!container || !items) return;

    const filtered = onlineUsersData.filter(u => u.id !== getCurrentUserId());

    if (filtered.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    if (title) title.textContent = 'Online \u2014 ' + filtered.length;

    items.innerHTML = filtered.map(user => {
        const initials = (user.display_name || '?').charAt(0).toUpperCase();
        return `
            <div class="online-user-item" data-user-id="${user.id}">
                <span class="online-user-dot"></span>
                <div class="online-user-avatar">
                    ${user.avatar_url
                        ? `<img src="${user.avatar_url}" alt="${user.display_name}">`
                        : `<div class="online-user-avatar-placeholder">${initials}</div>`
                    }
                </div>
                <span class="online-user-name">${escapeHtml(user.display_name)}</span>
                <button class="online-user-chat-btn" title="Discuter avec ${escapeHtml(user.display_name)}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </button>
            </div>
        `;
    }).join('');

    items.querySelectorAll('.online-user-chat-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const userId = this.closest('.online-user-item').dataset.userId;
            startConversation(userId);
        });
    });
}

function addOnlineUser(data) {
    if (data.userId === getCurrentUserId()) return;
    if (onlineUsersData.some(u => u.id === data.userId)) return;

    onlineUsersData.push({
        id: data.userId,
        display_name: data.displayName || data.username || 'User',
        username: data.username || '',
        avatar_url: data.avatarUrl || null,
        country: data.country || ''
    });
    renderOnlineUsers();
}

function removeOnlineUser(userId) {
    const before = onlineUsersData.length;
    onlineUsersData = onlineUsersData.filter(u => u.id !== userId);
    if (onlineUsersData.length !== before) {
        renderOnlineUsers();
    }
}

async function loadContacts() {
    try {
        const result = await apiRequest('/api/users/contacts/list');
        const contacts = result.contacts || [];

        const list = document.getElementById('conversationsList');
        if (!list) return;

        if (contacts.length === 0) {
            list.innerHTML = '<div class="loading-state">No contacts yet.</div>';
            return;
        }

        list.innerHTML = contacts.map(contact => {
            const initials = (contact.display_name || '?').charAt(0).toUpperCase();
            return `
                <div class="conversation-item" data-user-id="${contact.id}">
                    <div class="conversation-avatar">
                        ${contact.avatar_url
                            ? `<img src="${contact.avatar_url}" alt="${contact.display_name}">`
                            : `<div class="avatar-placeholder" style="width:44px;height:44px;border-radius:50%;background:var(--gray-light);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1rem;color:var(--gray-medium)">${initials}</div>`
                        }
                    </div>
                    <div class="conversation-info">
                        <div class="conversation-name">
                            ${contact.display_name}
                            <span class="${contact.status === 'online' ? 'online-dot' : 'offline-dot'}"></span>
                        </div>
                        <div class="conversation-last-message">${contact.country || 'Unknown'}</div>
                    </div>
                    <div class="conversation-meta">
                        <button class="btn btn-primary btn-sm start-chat-btn" data-user-id="${contact.id}">Chat</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.start-chat-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                startConversation(this.dataset.userId);
            });
        });
    } catch (error) {
        console.error('Failed to load contacts:', error);
    }
}


