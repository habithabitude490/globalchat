let currentOnlineCount = 0;
let previousOnlineCount = 0;
let countSocket = null;

document.addEventListener('DOMContentLoaded', function() {
    fetchInitialCounts();
    setupLiveCounterSocket();

    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.classList.toggle('show');
            this.classList.toggle('active');
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
});

async function fetchInitialCounts() {
    try {
        const response = await fetch('/api/users/online-count');
        const data = await response.json();
        if (data && typeof data.online_users === 'number') {
            currentOnlineCount = data.online_users;
            previousOnlineCount = currentOnlineCount;
            animateCounter('onlineNow', currentOnlineCount, 1.5);
            updateLiveCounter(currentOnlineCount);
        }
        if (data && typeof data.total_users === 'number') {
            animateCounter('totalUsers', data.total_users, 2.5);
        }
    } catch (e) {
        animateCounter('onlineNow', 0, 1.5);
        animateCounter('totalUsers', 0, 2.5);
    }
}

function setupLiveCounterSocket() {
    try {
        countSocket = io('/', {
            transports: ['websocket', 'polling'],
            forceNew: true
        });

        countSocket.on('connect', function() {
            console.log('[LiveCounter] Connected');
        });

        countSocket.on('online:count', function(data) {
            if (data && typeof data.count === 'number') {
                previousOnlineCount = currentOnlineCount;
                currentOnlineCount = data.count;

                animateCounter('onlineNow', currentOnlineCount, 0.8);
                updateLiveCounter(currentOnlineCount);
            }
        });

        countSocket.on('disconnect', function() {
            console.log('[LiveCounter] Disconnected');
        });
    } catch (e) {
        console.log('[LiveCounter] Socket unavailable');
    }
}

function updateLiveCounter(count) {
    const counter = document.getElementById('liveCounter');
    const text = document.getElementById('liveCountText');
    if (!counter || !text) return;

    counter.style.display = 'block';
    text.textContent = count.toLocaleString() + ' users online';

    counter.style.animation = 'none';
    void counter.offsetHeight;
    counter.style.animation = 'fadeInUp 0.5s ease';
}

function animateCounter(elementId, target, duration) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const current = parseInt(element.textContent.replace(/,/g, ''), 10) || 0;
    if (current === target) return;

    const diff = target - current;
    const steps = Math.max(1, Math.floor(duration * 60));
    const increment = diff / steps;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        const value = Math.round(current + increment * step);
        if (step >= steps || Math.abs(value - target) <= 1) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = value.toLocaleString();
        }
    }, 16);
}