const API_MESSAGES = '/api/messages';
const API_USERS = '/api/users';

let activeConversationId = null;
let activeUserId = null;
let conversations = [];
let hasMoreMessages = true;
let currentPage = 1;
let typingTimeout = null;

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('token')) {
        window.location.href = '/pages/login.html';
        return;
    }

    connectSocket();
    loadConversations();

    document.getElementById('backToDashBtn')?.addEventListener('click', function() {
        window.location.href = '/pages/dashboard.html';
    });

    document.getElementById('sendBtn')?.addEventListener('click', sendMessage);
    document.getElementById('messageInput')?.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        document.getElementById('sendBtn').disabled = !this.value.trim();
        if (activeConversationId) sendTypingIndicator();
    });
    document.getElementById('messageInput')?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.getElementById('conversationSearch')?.addEventListener('input', function() {
        filterConversations(this.value);
    });

    document.getElementById('uploadImageBtn')?.addEventListener('click', function() {
        document.getElementById('imageUploadInput').click();
    });
    document.getElementById('uploadFileBtn')?.addEventListener('click', function() {
        document.getElementById('fileUploadInput').click();
    });
    document.getElementById('imageUploadInput')?.addEventListener('change', function(e) {
        if (e.target.files.length > 0) uploadAndSendImage(e.target.files[0]);
    });
    document.getElementById('fileUploadInput')?.addEventListener('change', function(e) {
        if (e.target.files.length > 0) uploadAndSendFile(e.target.files[0]);
    });


    document.getElementById('messagesContainer')?.addEventListener('scroll', function() {
        if (this.scrollTop < 50 && hasMoreMessages && activeConversationId) {
            loadMoreMessages();
        }
    });

    document.addEventListener('socket:connected', function() {
        loadConversations();
    });

    document.addEventListener('message:received', function(e) {
        const message = e.detail;
        if (message.conversation_id === activeConversationId) {
            appendMessage(message);
            markMessagesAsRead([message.id]);
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

    const urlParams = new URLSearchParams(window.location.search);
    const convId = urlParams.get('conversation');
    const userId = urlParams.get('user');
    if (convId && userId) {
        setTimeout(function() { openConversation(convId, userId); }, 500);
    }
});

async function loadConversations() {
    try {
        const result = await apiRequest(API_MESSAGES + '/conversations');
        conversations = result.conversations || [];
        const list = document.getElementById('conversationsList');
        if (!list) return;

        if (conversations.length === 0) {
            list.innerHTML = '<div class="no-conv-msg">No conversations yet. <a href="/pages/search.html">Find people to chat with</a>.</div>';
            return;
        }

        list.innerHTML = conversations.map(conv => createConversationItem(conv)).join('');
        updateUnreadBadge();

        list.querySelectorAll('.conversation-item-full').forEach(function(item) {
            item.addEventListener('click', function() {
                openConversation(this.dataset.conversationId, this.dataset.userId);
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
        <div class="conversation-item-full" data-conversation-id="${conv.id}" data-user-id="${conv.other_user_id}">
            <div class="conv-avatar">
                ${conv.other_avatar_url
                    ? `<img src="${conv.other_avatar_url}" alt="${conv.other_display_name}">`
                    : `<div class="avatar-placeholder-sm" style="width:44px;height:44px;border-radius:50%;background:var(--gray-light);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:1rem;color:var(--gray-medium)">${initials}</div>`
                }
            </div>
            <div class="conv-info">
                <div class="conv-name">
                    ${conv.other_display_name}
                    <span class="${conv.other_status === 'online' ? 'online-dot' : 'offline-dot'}"></span>
                </div>
                <div class="conv-last-msg">${escapeHtml(lastMsg)}</div>
            </div>
            <div class="conv-meta">
                <span class="conv-time">${time}</span>
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
    if (socket) socket.emit('conversation:join', conversationId);

    document.querySelectorAll('.conversation-item-full').forEach(function(el) {
        el.classList.remove('active');
    });
    const activeEl = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (activeEl) activeEl.classList.add('active');

    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatActive').style.display = 'flex';

    try {
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
    } catch (error) {
        console.error('Failed to open conversation:', error);
    }
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
    container.parentElement.scrollTop = container.parentElement.scrollHeight - scrollHeight;
}

function displayMessages(messages) {
    const container = document.getElementById('messagesList');
    if (!container) return;

    if (messages.length === 0) {
        container.innerHTML = '<div class="no-conv-msg" style="padding:40px;">No messages yet. Start the conversation!</div>';
        return;
    }

    container.innerHTML = messages.map(msg => createMessageElement(msg)).join('');
    scrollToBottom();
}

function createMessageElement(msg) {
    const isSent = msg.sender_id === getCurrentUserId();
    const time = formatMessageTime(msg.created_at);

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
        <div class="message ${isSent ? 'sent' : 'received'}">
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

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !activeConversationId) return;

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;

    const socket = getSocket();
    if (socket && isSocketConnected()) {
        socket.emit('message:send', {
            conversationId: activeConversationId,
            content: content
        }, function(response) {
            if (response && response.success) {
                if (!document.querySelector(`[data-message-id="${response.message.id}"]`)) {
                    appendMessage(response.message);
                }
            } else {
                showToast(response?.error || 'Failed to send message', 'error');
            }
        });
    } else {
        try {
            const result = await apiRequest(`${API_MESSAGES}/conversations/${activeConversationId}`, {
                method: 'POST',
                body: JSON.stringify({ content })
            });
            appendMessage(result.message);
        } catch (error) {
            showToast('Failed to send message', 'error');
        }
    }
}

function sendTypingIndicator() {
    const socket = getSocket();
    if (!socket || !activeConversationId) return;
    socket.emit('message:typing', { conversationId: activeConversationId, isTyping: true });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function() {
        socket.emit('message:typing', { conversationId: activeConversationId, isTyping: false });
    }, 1000);
}

function showTypingIndicator(show) {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.display = show ? 'block' : 'none';
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

async function updateUnreadBadge() {
    try {
        const result = await apiRequest(API_MESSAGES + '/unread');
        const count = result.unread_count || 0;
        const items = document.querySelectorAll('.badge');
        // Update sidebar badge via event
    } catch (error) {
        console.error('Failed to update unread badge:', error);
    }
}

function updateConversationLastMessage(message) {
    const item = document.querySelector(`[data-conversation-id="${message.conversation_id}"]`);
    if (item) {
        const lastMsgEl = item.querySelector('.conv-last-msg');
        if (lastMsgEl) lastMsgEl.textContent = escapeHtml(message.content || '');
        const timeEl = item.querySelector('.conv-time');
        if (timeEl) timeEl.textContent = formatTime(message.created_at);
    }
}

function updateUserStatus(userId, status) {
    document.querySelectorAll(`[data-user-id="${userId}"]`).forEach(function(item) {
        const dot = item.querySelector('.online-dot, .offline-dot');
        if (dot) dot.className = status === 'online' ? 'online-dot' : 'offline-dot';
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

function filterConversations(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.conversation-item-full').forEach(function(item) {
        const name = item.querySelector('.conv-name')?.textContent?.toLowerCase() || '';
        const lastMsg = item.querySelector('.conv-last-msg')?.textContent?.toLowerCase() || '';
        item.style.display = (!q || name.includes(q) || lastMsg.includes(q)) ? 'flex' : 'none';
    });
}

async function uploadAndSendImage(file) {
    if (file.size > 10485760) { showToast('Image size exceeds 10MB limit', 'error'); return; }
    const formData = new FormData();
    formData.append('image', file);
    try {
        const result = await apiRequest('/api/upload/image', { method: 'POST', headers: {}, body: formData });
        const socket = getSocket();
        if (socket && isSocketConnected() && activeConversationId) {
            socket.emit('message:send', { conversationId: activeConversationId, content: '', messageType: 'image', fileUrl: result.url });
        }
    } catch (error) { showToast('Failed to upload image', 'error'); }
}

async function uploadAndSendFile(file) {
    if (file.size > 10485760) { showToast('File size exceeds 10MB limit', 'error'); return; }
    const formData = new FormData();
    formData.append('file', file);
    try {
        const result = await apiRequest('/api/upload/file', { method: 'POST', headers: {}, body: formData });
        const socket = getSocket();
        if (socket && isSocketConnected() && activeConversationId) {
            socket.emit('message:send', { conversationId: activeConversationId, content: '', messageType: 'file', fileUrl: result.url, fileName: result.originalName, fileSize: result.size });
        }
    } catch (error) { showToast('Failed to upload file', 'error'); }
}

function getCurrentUserId() {
    try {
        const user = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
        return user.id;
    } catch { return null; }
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        setTimeout(function() { container.scrollTop = container.scrollHeight; }, 50);
    }
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
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
}

function updateMessageReadStatus(data) {
    // placeholder
}