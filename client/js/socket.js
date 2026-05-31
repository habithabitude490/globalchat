let socket = null;
let socketConnected = false;

function connectSocket() {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
        socket = io('/', {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000
        });

        socket.on('connect', function() {
            socketConnected = true;
            console.log('[Socket] Connected');
            document.dispatchEvent(new CustomEvent('socket:connected'));
        });

        socket.on('disconnect', function(reason) {
            socketConnected = false;
            console.log('[Socket] Disconnected:', reason);
            document.dispatchEvent(new CustomEvent('socket:disconnected'));
        });

        socket.on('connect_error', function(error) {
            console.error('[Socket] Connection error:', error.message);
        });

        socket.on('error', function(data) {
            console.error('[Socket] Error:', data.message);
        });

        socket.on('user:status', function(data) {
            document.dispatchEvent(new CustomEvent('user:status', { detail: data }));
        });

        socket.on('message:sent', function(message) {
            document.dispatchEvent(new CustomEvent('message:sent', { detail: message }));
        });

        socket.on('message:received', function(message) {
            document.dispatchEvent(new CustomEvent('message:received', { detail: message }));
        });

        socket.on('message:typing', function(data) {
            document.dispatchEvent(new CustomEvent('message:typing', { detail: data }));
        });

        socket.on('messages:read', function(data) {
            document.dispatchEvent(new CustomEvent('messages:read', { detail: data }));
        });

        socket.on('user:searchResults', function(results) {
            document.dispatchEvent(new CustomEvent('user:searchResults', { detail: results }));
        });

        socket.on('online:count', function(data) {
            document.dispatchEvent(new CustomEvent('online:count', { detail: data }));
        });

        return socket;
    } catch (error) {
        console.error('[Socket] Initialization error:', error);
        return null;
    }
}

function getSocket() {
    return socket;
}

function isSocketConnected() {
    return socketConnected;
}

function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
        socketConnected = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('token')) {
        connectSocket();
    }
});
