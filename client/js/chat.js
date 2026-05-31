let activeConversationId = null;
let activeUserId = null;
let conversations = [];
let messagesCache = {};
let typingTimeout = null;
let currentPage = 1;
let hasMoreMessages = true;

const API_MESSAGES = '/api/messages';
const API_USERS = '/api/users';

function initChat() {
    loadConversations();

    document.addEventListener('socket:connected', function() {
        loadConversations();
    });

    document.addEventListener('message:received', function(e) {
        const message = e.detail;
        if (message.conversation_id === activeConversationId) {
            appendMessage(message);
            markMessagesAsRead([message.id]);

            if (message.sender_id !== getCurrentUserId()) {
                playNotification();
            }
        }
        updateConversationLastMessage(message);
        updateUnreadBadge();
    });

    document.addEventListener('message:sent', function(e) {
        const message = e.detail;
        if (message.conversation_id === activeConversationId) {
            if (!document.querySelector(`[data-message-id="${message.id}"]`)) {
                appendMessage(message);
            }
        }
        updateConversationLastMessage(message);
    });

    document.addEventListener('messages:read', function(e) {
        updateMessageReadStatus(e.detail.conversationId || e.detail.messageIds);
    });

    document.addEventListener('message:typing', function(e) {
        const data = e.detail;
        if (data.conversationId === activeConversationId && data.userId !== getCurrentUserId()) {
            showTypingIndicator(data.isTyping);
        }
    });

    document.addEventListener('user:status', function(e) {
        const data = e.detail;
        updateUserStatus(data.userId, data.status);
        updateConversationUserStatus(data.userId, data.status);
    });

    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');

    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            sendBtn.disabled = !this.value.trim();

            if (activeConversationId) {
                sendTypingIndicator();
            }
        });

        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    document.getElementById('uploadImageBtn')?.addEventListener('click', function() {
        document.getElementById('imageUploadInput').click();
    });

    document.getElementById('uploadFileBtn')?.addEventListener('click', function() {
        document.getElementById('fileUploadInput').click();
    });

    document.getElementById('imageUploadInput')?.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            uploadAndSendImage(e.target.files[0]);
        }
    });

    document.getElementById('fileUploadInput')?.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            uploadAndSendFile(e.target.files[0]);
        }
    });

    document.getElementById('searchMessagesBtn')?.addEventListener('click', function() {
        toggleMessageSearch();
    });


    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', function() {
            if (this.scrollTop < 50 && hasMoreMessages && activeConversationId) {
                loadMoreMessages();
            }
        });
    }
}

async function loadConversations() {
    try {
        const result = await apiRequest(API_MESSAGES + '/conversations');
        conversations = result.conversations || [];

        const list = document.getElementById('conversationsList');
        if (!list) return;

        if (conversations.length === 0) {
            list.innerHTML = '<div class="loading-state">No conversations yet. Search for people to chat with.</div>';
            return;
        }

        list.innerHTML = conversations.map(conv => createConversationItem(conv)).join('');
        updateUnreadBadge();

        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', function() {
                const convId = this.dataset.conversationId;
                const userId = this.dataset.userId;
                openConversation(convId, userId);
            });
        });

        if (activeConversationId) {
            const activeEl = list.querySelector(`[data-conversation-id="${activeConversationId}"]`);
            if (activeEl) activeEl.classList.add('active');
        }
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

function createConversationItem(conv) {
    const initials = (conv.other_display_name || '?').charAt(0).toUpperCase();
    const lastMsg = conv.last_message || '';
    const time = conv.last_message_time ? formatTime(conv.last_message_time) : '';
    const unread = conv.unread_count || 0;

    return `
        <div class="conversation-item" data-conversation-id="${conv.id}" data-user-id="${conv.other_user_id}">
            <div class="conversation-avatar">
                ${conv.other_avatar_url
                    ? `<img src="${conv.other_avatar_url}" alt="${conv.other_display_name}">`
                    : `<div class="avatar-placeholder" style="width:44px;height:44px;border-radius:50%;background:var(--gray-light);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1rem;color:var(--gray-medium)">${initials}</div>`
                }
            </div>
            <div class="conversation-info">
                <div class="conversation-name">
                    ${conv.other_display_name}
                    <span class="${conv.other_status === 'online' ? 'online-dot' : 'offline-dot'}"></span>
                </div>
                <div class="conversation-last-message">${escapeHtml(lastMsg)}</div>
            </div>
            <div class="conversation-meta">
                <span class="conversation-time">${time}</span>
                ${unread > 0 ? `<span class="badge">${unread}</span>` : ''}
            </div>
        </div>
    `;
}

async function openConversation(conversationId, userId) {
    activeConversationId = conversationId;
    activeUserId = userId;
    currentPage = 1;
    hasMoreMessages = true;

    const socket = getSocket();
    if (socket) {
        socket.emit('conversation:join', conversationId);
    }

    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (activeEl) activeEl.classList.add('active');

    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatActive').style.display = 'flex';

    const usersResult = await apiRequest(API_USERS + '/' + userId);
    const user = usersResult.user;

    if (user.avatar_url) {
        document.getElementById('chatAvatarImg').src = user.avatar_url;
        document.getElementById('chatAvatarImg').style.display = 'block';
        document.getElementById('chatAvatarPlaceholder').style.display = 'none';
    } else {
        document.getElementById('chatAvatarImg').style.display = 'none';
        document.getElementById('chatAvatarPlaceholder').style.display = 'flex';
        document.getElementById('chatAvatarPlaceholder').textContent = (user.display_name || '?').charAt(0).toUpperCase();
    }

    document.getElementById('chatUserName').textContent = user.display_name || user.username;
    document.getElementById('chatUserStatus').textContent = user.status === 'online' ? 'Online' : 'Offline';
    document.getElementById('chatUserStatus').style.color = user.status === 'online' ? 'var(--success)' : 'var(--gray-medium)';

    const messages = await fetchMessages(conversationId, 1);
    displayMessages(messages);
    markConversationAsRead(conversationId);

    document.getElementById('messageInput').focus();
}

function displayMessages(messages) {
    const container = document.getElementById('messagesList');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<div class="loading-state">No messages yet. Start a conversation!</div>';
        return;
    }

    container.innerHTML = messages.map(msg => createMessageElement(msg)).join('');
    scrollToBottom();
}

function createMessageElement(msg) {
    const isSent = msg.sender_id === getCurrentUserId();
    const time = formatMessageTime(msg.created_at);
    const readStatus = msg.is_read ? 'Read' : 'Sent';

    let contentHtml = '';

    if (msg.message_type === 'image') {
        contentHtml = `<a href="${msg.file_url}" target="_blank" class="message-image-link"><img src="${msg.file_url}" alt="Image" class="message-image" loading="lazy"></a>`;
    } else if (msg.message_type === 'file') {
        contentHtml = `<a href="${msg.file_url}" target="_blank" class="message-file">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${msg.file_name || 'File'}
        </a>`;
    } else {
        contentHtml = escapeHtml(msg.content || '');
    }

    return `
        <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}">
            <div class="message-bubble">
                ${contentHtml}
                <span class="message-time">${time}</span>
            </div>
        </div>
    `;
}

function appendMessage(msg) {
    const container = document.getElementById('messagesList');
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = createMessageElement(msg);
    container.appendChild(wrapper.firstElementChild);

    scrollToBottom();
}

async function fetchMessages(conversationId, page) {
    try {
        const result = await apiRequest(`${API_MESSAGES}/conversations/${conversationId}?page=${page}&limit=50`);
        return result.messages || [];
    } catch (error) {
        console.error('Failed to fetch messages:', error);
        return [];
    }
}

async function loadMoreMessages() {
    currentPage++;
    const messages = await fetchMessages(activeConversationId, currentPage);
    if (messages.length === 0) {
        hasMoreMessages = false;
        return;
    }

    const container = document.getElementById('messagesList');
    const scrollHeight = container.scrollHeight;

    const html = messages.map(msg => createMessageElement(msg)).join('');
    container.insertAdjacentHTML('afterbegin', html);

    container.scrollTop = container.scrollHeight - scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content || !activeConversationId) return;

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;

    try {
        const result = await apiRequest(`${API_MESSAGES}/conversations/${activeConversationId}`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        if (!document.querySelector(`[data-message-id="${result.message.id}"]`)) {
            appendMessage(result.message);
        }
    } catch (error) {
        showToast(error.message || 'Failed to send message', 'error');
    }
}

function sendTypingIndicator() {
    const socket = getSocket();
    if (!socket || !activeConversationId) return;

    socket.emit('message:typing', { conversationId: activeConversationId, isTyping: true });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('message:typing', { conversationId: activeConversationId, isTyping: false });
    }, 1000);
}

function showTypingIndicator(show) {
    const el = document.getElementById('typingIndicator');
    if (el) {
        el.style.display = show ? 'block' : 'none';
    }
}

function markMessagesAsRead(messageIds) {
    const socket = getSocket();
    if (socket && isSocketConnected()) {
        socket.emit('message:read', { messageIds });
    }
}

async function markConversationAsRead(conversationId) {
    try {
        await apiRequest(`${API_MESSAGES}/conversations/${conversationId}/read`, { method: 'POST' });
        updateUnreadBadge();
    } catch (error) {
        console.error('Failed to mark as read:', error);
    }
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}

async function uploadAndSendImage(file) {
    if (file.size > 10485760) {
        showToast('Image size exceeds 10MB limit', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
        const result = await apiRequest('/api/upload/image', {
            method: 'POST',
            headers: {},
            body: formData
        });

        const socket = getSocket();
        if (socket && isSocketConnected() && activeConversationId) {
            socket.emit('message:send', {
                conversationId: activeConversationId,
                content: '',
                messageType: 'image',
                fileUrl: result.url
            });
        }
    } catch (error) {
        showToast('Failed to upload image', 'error');
    }
}

async function uploadAndSendFile(file) {
    if (file.size > 10485760) {
        showToast('File size exceeds 10MB limit', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const result = await apiRequest('/api/upload/file', {
            method: 'POST',
            headers: {},
            body: formData
        });

        const socket = getSocket();
        if (socket && isSocketConnected() && activeConversationId) {
            socket.emit('message:send', {
                conversationId: activeConversationId,
                content: '',
                messageType: 'file',
                fileUrl: result.url,
                fileName: result.originalName,
                fileSize: result.size
            });
        }
    } catch (error) {
        showToast('Failed to upload file', 'error');
    }
}

function toggleMessageSearch() {
    const existing = document.querySelector('.message-search-bar');
    if (existing) {
        existing.remove();
        return;
    }

    const bar = document.createElement('div');
    bar.className = 'message-search-bar';
    bar.style.cssText = 'padding:8px 20px;border-bottom:1px solid var(--gray-light);background:var(--white);display:flex;gap:8px;';
    bar.innerHTML = `
        <input type="text" id="messageSearchInput" placeholder="Search in conversation..." style="flex:1;padding:6px 10px;border:1px solid var(--gray-light);border-radius:4px;font-size:0.85rem;outline:none;">
        <button class="btn-icon" id="closeSearchBtn">&times;</button>
    `;

    document.querySelector('.chat-header').after(bar);

    document.getElementById('messageSearchInput').addEventListener('keydown', async function(e) {
        if (e.key === 'Enter' && this.value.trim()) {
            try {
                const result = await apiRequest(`${API_MESSAGES}/conversations/${activeConversationId}/search?q=${encodeURIComponent(this.value.trim())}`);
                displayMessages(result.messages || []);
            } catch (error) {
                showToast('Search failed', 'error');
            }
        }
    });

    document.getElementById('closeSearchBtn').addEventListener('click', function() {
        bar.remove();
        loadConversations();
        if (activeConversationId) {
            fetchMessages(activeConversationId, 1).then(displayMessages);
        }
    });
}

function updateConversationLastMessage(message) {
    const item = document.querySelector(`[data-conversation-id="${message.conversation_id}"]`);
    if (item) {
        const lastMsgEl = item.querySelector('.conversation-last-message');
        if (lastMsgEl) {
            lastMsgEl.textContent = escapeHtml(message.content || '');
        }
        const timeEl = item.querySelector('.conversation-time');
        if (timeEl) {
            timeEl.textContent = formatTime(message.created_at);
        }
    }
}

function updateUserStatus(userId, status) {
    const items = document.querySelectorAll(`[data-user-id="${userId}"]`);
    items.forEach(item => {
        const dot = item.querySelector('.online-dot, .offline-dot');
        if (dot) {
            dot.className = status === 'online' ? 'online-dot' : 'offline-dot';
        }
    });
}

function updateConversationUserStatus(userId, status) {
    if (activeUserId === userId) {
        const el = document.getElementById('chatUserStatus');
        if (el) {
            el.textContent = status === 'online' ? 'Online' : 'Offline';
            el.style.color = status === 'online' ? 'var(--success)' : 'var(--gray-medium)';
        }
    }
}

async function updateUnreadBadge() {
    try {
        const result = await apiRequest(API_MESSAGES + '/unread');
        const count = result.unread_count || 0;
        const badge = document.getElementById('unreadBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Failed to update unread badge:', error);
    }
}

function getCurrentUserId() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        return user.id;
    } catch {
        return null;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);

    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function startConversation(userId) {
    try {
        const result = await apiRequest(`${API_USERS}/${userId}/conversation`, {
            method: 'POST'
        });
        const conversation = result.conversation;
        const otherUserId = conversation.participant_one === getCurrentUserId()
            ? conversation.participant_two
            : conversation.participant_one;
        await loadConversations();
        openConversation(conversation.id, otherUserId);
    } catch (error) {
        showToast(error.message || 'Failed to start conversation', 'error');
    }
}

function playNotification() {
    try {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New message', { body: 'You have a new message' });
        }
    } catch (e) {}
}

function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
