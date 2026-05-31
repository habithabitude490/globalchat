document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.getItem('token')) {
        window.location.href = '/pages/login.html';
        return;
    }

    loadCurrentUser();

    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (userId) {
        loadOtherUserProfile(userId);
    } else {
        loadMyProfile();
    }

    const avatarUpload = document.getElementById('avatarUpload');
    document.getElementById('changeAvatarBtn')?.addEventListener('click', function() {
        avatarUpload?.click();
    });
    avatarUpload?.addEventListener('change', function(e) {
        if (e.target.files.length > 0) uploadAvatar(e.target.files[0]);
    });

    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        setupSettingsForm(settingsForm);
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', function() {
            window.location.href = '/pages/forgot-password.html';
        });
    }
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}

async function loadMyProfile() {
    try {
        const result = await apiRequest('/api/auth/me');
        const user = result.user;
        renderProfile(user);
    } catch (error) {
        console.error('Failed to load profile:', error);
    }
}

async function loadOtherUserProfile(userId) {
    try {
        const result = await apiRequest(`/api/users/${userId}`);
        const user = result.user;
        renderProfile(user);

        document.getElementById('changeAvatarBtn')?.remove();

        if (user.is_blocked) {
            addBlockedBadge();
        }
    } catch (error) {
        console.error('Failed to load user profile:', error);
    }
}

function renderProfile(user) {
    const nameEl = document.getElementById('profileName');
    const usernameEl = document.getElementById('profileUsername');
    const bioEl = document.getElementById('profileBio');
    const countryEl = document.getElementById('profileCountry');
    const languagesEl = document.getElementById('profileLanguages');
    const joinedEl = document.getElementById('profileJoined');
    const statusEl = document.getElementById('profileStatus');
    const interestsEl = document.getElementById('profileInterests');
    const avatarImg = document.getElementById('profileAvatarImg');
    const avatarPlaceholder = document.getElementById('profileAvatarPlaceholder');

    if (nameEl) nameEl.textContent = user.display_name || user.username;
    if (usernameEl) usernameEl.textContent = `@${user.username}`;
    if (bioEl) bioEl.textContent = user.biography || 'No biography yet.';
    if (countryEl) countryEl.textContent = user.country || 'Not specified';
    if (languagesEl) languagesEl.textContent = (user.languages && user.languages.length > 0) ? user.languages.join(', ') : 'None';
    if (joinedEl) joinedEl.textContent = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    if (statusEl) {
        statusEl.textContent = user.status === 'online' ? 'Online' : 'Offline';
        statusEl.style.color = user.status === 'online' ? 'var(--success)' : 'var(--gray-medium)';
    }

    if (user.avatar_url && avatarImg) {
        avatarImg.src = user.avatar_url;
        avatarImg.style.display = 'block';
        if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    } else if (avatarPlaceholder) {
        avatarPlaceholder.textContent = (user.display_name || '?').charAt(0).toUpperCase();
        avatarPlaceholder.style.display = 'flex';
        if (avatarImg) avatarImg.style.display = 'none';
    }

    if (interestsEl && user.interests && user.interests.length > 0) {
        interestsEl.innerHTML = user.interests.map(i => `<span class="interest-tag">${escapeHtml(i)}</span>`).join('');
    } else if (interestsEl) {
        interestsEl.innerHTML = '<span class="text-muted">No interests listed.</span>';
    }

    if (user.is_admin) {
        const adminBadge = document.createElement('span');
        adminBadge.style.cssText = 'display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.75rem;background:#FEF3E2;color:#E67E22;margin-left:8px;';
        adminBadge.textContent = 'Admin';
        nameEl?.appendChild(adminBadge);
    }
}

function addBlockedBadge() {
    const el = document.querySelector('.profile-meta');
    if (el) {
        const badge = document.createElement('div');
        badge.style.cssText = 'grid-column:1/-1;padding:8px 12px;background:#FDEDEC;border-radius:4px;color:#C0392B;font-size:0.85rem;';
        badge.textContent = 'You have blocked this user.';
        el.appendChild(badge);
    }
}

async function uploadAvatar(file) {
    if (file.size > 10485760) {
        showToast('Image size exceeds 10MB limit', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const result = await apiRequest('/api/users/avatar', {
            method: 'PUT',
            headers: {},
            body: formData
        });

        document.getElementById('profileAvatarImg').src = result.avatar_url;
        document.getElementById('profileAvatarImg').style.display = 'block';
        document.getElementById('profileAvatarPlaceholder').style.display = 'none';

        document.getElementById('avatarImg').src = result.avatar_url;
        document.getElementById('avatarImg').style.display = 'block';
        document.getElementById('avatarPlaceholder').style.display = 'none';

        showToast('Avatar updated', 'success');
    } catch (error) {
        showToast(error.message || 'Failed to upload avatar', 'error');
    }
}

function setupSettingsForm(form) {
    loadSettingsData();

    const bioEl = document.getElementById('settingsBio');
    if (bioEl) {
        bioEl.addEventListener('input', function() {
            document.getElementById('bioCount').textContent = `${this.value.length}/500`;
        });
    }

    setupLanguageInput();
    setupInterestInput();

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        hideError('settingsError');
        hideError('settingsSuccess');

        const data = {
            display_name: document.getElementById('settingsName').value.trim(),
            biography: document.getElementById('settingsBio').value.trim(),
            country: document.getElementById('settingsCountry').value
        };

        const languages = getSelectedLanguages();
        if (languages.length > 0) data.languages = languages;

        const interests = getSelectedInterests();
        if (interests.length > 0) data.interests = interests;

        try {
            const result = await apiRequest('/api/users/profile', {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            document.getElementById('settingsSuccess').textContent = 'Settings saved successfully!';
            document.getElementById('settingsSuccess').style.display = 'block';

            if (result.user) {
                sessionStorage.setItem('currentUser', JSON.stringify(result.user));
            }

            loadMyProfile();
        } catch (error) {
            document.getElementById('settingsError').textContent = error.message;
            document.getElementById('settingsError').style.display = 'block';
        }
    });
}

async function loadSettingsData() {
    try {
        const result = await apiRequest('/api/auth/me');
        const user = result.user;

        document.getElementById('settingsName').value = user.display_name || '';
        document.getElementById('settingsBio').value = user.biography || '';

        const countrySelect = document.getElementById('settingsCountry');
        if (countrySelect) {
            const countries = [
                '', 'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Australia', 'Austria',
                'Bangladesh', 'Belgium', 'Brazil', 'Canada', 'China', 'Colombia', 'Croatia',
                'Denmark', 'Egypt', 'Finland', 'France', 'Germany', 'Ghana', 'Greece',
                'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
                'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait',
                'Lebanon', 'Malaysia', 'Mexico', 'Morocco',
                'Netherlands', 'New Zealand', 'Nigeria', 'Norway',
                'Pakistan', 'Peru', 'Philippines', 'Poland', 'Portugal',
                'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Senegal', 'Serbia', 'Singapore',
                'Slovakia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden', 'Switzerland', 'Syria',
                'Taiwan', 'Thailand', 'Tunisia', 'Turkey',
                'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
                'Uruguay', 'Uzbekistan', 'Vatican City', 'Venezuela', 'Vietnam',
                'Yemen', 'Zambia', 'Zimbabwe'
            ];

            countries.forEach(c => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c || 'Select your country';
                if (c === user.country) option.selected = true;
                countrySelect.appendChild(option);
            });
        }

        if (user.languages) {
            user.languages.forEach(lang => addLanguageTag(lang));
        }

        if (user.interests) {
            user.interests.forEach(interest => addInterestTag(interest));
        }

        loadBlockedUsers();
    } catch (error) {
        console.error('Failed to load settings data:', error);
    }
}

function setupLanguageInput() {
    const input = document.getElementById('languageInput');
    if (!input) return;

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const lang = this.value.trim();
            if (lang && !isLanguageSelected(lang)) {
                addLanguageTag(lang);
            }
            this.value = '';
        }
    });
}

function isLanguageSelected(lang) {
    return Array.from(document.querySelectorAll('#selectedLanguages .selected-tag'))
        .some(el => el.dataset.value?.toLowerCase() === lang.toLowerCase());
}

function addLanguageTag(lang) {
    const container = document.getElementById('selectedLanguages');
    if (!container) return;

    const tag = document.createElement('span');
    tag.className = 'selected-tag';
    tag.dataset.value = lang;
    tag.innerHTML = `${escapeHtml(lang)} <button type="button" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(tag);
}

function getSelectedLanguages() {
    return Array.from(document.querySelectorAll('#selectedLanguages .selected-tag'))
        .map(el => el.dataset.value);
}

function setupInterestInput() {
    const input = document.getElementById('interestInput');
    if (!input) return;

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const interest = this.value.trim();
            if (interest && !isInterestSelected(interest)) {
                addInterestTag(interest);
            }
            this.value = '';
        }
    });
}

function isInterestSelected(interest) {
    return Array.from(document.querySelectorAll('#selectedInterests .selected-tag'))
        .some(el => el.dataset.value?.toLowerCase() === interest.toLowerCase());
}

function addInterestTag(interest) {
    const container = document.getElementById('selectedInterests');
    if (!container) return;

    const tag = document.createElement('span');
    tag.className = 'selected-tag';
    tag.dataset.value = interest;
    tag.innerHTML = `${escapeHtml(interest)} <button type="button" onclick="this.parentElement.remove()">&times;</button>`;
    container.appendChild(tag);
}

function getSelectedInterests() {
    return Array.from(document.querySelectorAll('#selectedInterests .selected-tag'))
        .map(el => el.dataset.value);
}

async function loadBlockedUsers() {
    const container = document.getElementById('blockedUsersList');
    if (!container) return;

    try {
        const result = await apiRequest('/api/users/blocks/list');
        const blocked = result.blocked || [];

        if (blocked.length === 0) {
            container.innerHTML = '<p class="text-muted">No blocked users.</p>';
            return;
        }

        container.innerHTML = blocked.map(user => `
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--gray-light);">
                <span style="flex:1;">${escapeHtml(user.display_name)} (@${escapeHtml(user.username)})</span>
                <button class="btn btn-outline btn-sm unblock-btn" data-user-id="${user.id}">Unblock</button>
            </div>
        `).join('');

        container.querySelectorAll('.unblock-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                try {
                    await apiRequest(`/api/users/${this.dataset.userId}/unblock`, { method: 'POST' });
                    this.closest('div').remove();
                    showToast('User unblocked', 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        });
    } catch (error) {
        console.error('Failed to load blocked users:', error);
    }
}
