let searchTimer = null;
const API_USERS = '/api/users';

function initSearch() {
    const globalSearch = document.getElementById('globalSearch');
    const filterCountry = document.getElementById('filterCountry');
    const filterLanguage = document.getElementById('filterLanguage');
    const filterInterest = document.getElementById('filterInterest');

    if (globalSearch) {
        globalSearch.addEventListener('input', debouncedSearch);
    }

    [filterCountry, filterLanguage, filterInterest].forEach(input => {
        if (input) {
            input.addEventListener('input', debouncedSearch);
        }
    });

    document.getElementById('newChatBtn')?.addEventListener('click', function() {
        document.getElementById('modalOverlay').style.display = 'flex';
        setTimeout(() => document.getElementById('globalSearch')?.focus(), 100);
    });

    document.querySelector('.modal-close')?.addEventListener('click', closeSearchModal);

    document.getElementById('modalOverlay')?.addEventListener('click', function(e) {
        if (e.target === this) closeSearchModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeSearchModal();
    });

    document.addEventListener('user:searchResults', function(e) {
        displaySearchResults(e.detail);
    });
}

function debouncedSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(performSearch, 300);
}

async function performSearch() {
    const term = document.getElementById('globalSearch')?.value.trim() || '';
    const country = document.getElementById('filterCountry')?.value.trim() || '';
    const language = document.getElementById('filterLanguage')?.value.trim() || '';
    const interest = document.getElementById('filterInterest')?.value.trim() || '';

    const params = new URLSearchParams();
    if (term) params.set('q', term);
    if (country) params.set('country', country);
    if (language) params.set('language', language);
    if (interest) params.set('interest', interest);
    params.set('limit', '20');

    try {
        const result = await apiRequest(`${API_USERS}/search?${params.toString()}`);
        displaySearchResults(result.users || []);
    } catch (error) {
        console.error('Search failed:', error);
        document.getElementById('searchResults').innerHTML =
            '<div class="no-results">Search failed. Please try again.</div>';
    }
}

function displaySearchResults(users) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    if (users.length === 0) {
        container.innerHTML = '<div class="no-results">No users found. Try different search terms.</div>';
        return;
    }

    container.innerHTML = users.map(user => `
        <div class="search-result-item" data-user-id="${user.id}">
            <div class="search-result-avatar">
                ${user.avatar_url
                    ? `<img src="${user.avatar_url}" alt="${user.display_name}">`
                    : `<div style="width:40px;height:40px;border-radius:50%;background:var(--gray-light);display:flex;align-items:center;justify-content:center;font-weight:600;color:var(--gray-medium)">${(user.display_name || '?').charAt(0).toUpperCase()}</div>`
                }
            </div>
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(user.display_name)} <span style="color:var(--gray-medium);font-weight:400;">@${escapeHtml(user.username)}</span></div>
                <div class="search-result-detail">
                    ${user.country ? user.country : 'Unknown'} | ${user.languages && user.languages.length > 0 ? user.languages.slice(0, 2).join(', ') : 'No languages listed'}
                </div>
            </div>
            <div class="search-result-actions">
                <button class="btn btn-primary btn-sm start-chat-btn" data-user-id="${user.id}">Chat</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.start-chat-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            startConversation(this.dataset.userId);
        });
    });

    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', function() {
            startConversation(this.dataset.userId);
        });
    });
}

async function startConversation(userId) {
    try {
        const result = await apiRequest(`${API_USERS}/${userId}/conversation`, {
            method: 'POST'
        });

        closeSearchModal();

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

function closeSearchModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const msgNav = document.querySelector('.nav-item[data-section="messages"]');
    if (msgNav) msgNav.classList.add('active');
}
