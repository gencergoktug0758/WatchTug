// WatchTug V2 - Room JavaScript

// DOM Elements
const roomIdDisplay = document.getElementById('roomIdDisplay');
const usersContainer = document.getElementById('usersContainer');
const screenDisplay = document.getElementById('screenDisplay');
const waitingScreen = document.getElementById('waitingScreen');
const noPermissionScreen = document.getElementById('noPermissionScreen');
const connectingScreen = document.getElementById('connectingScreen');
const sharingControls = document.getElementById('sharingControls');
const shareScreenBtn = document.getElementById('shareScreenBtn');
const stopSharingBtn = document.getElementById('stopSharingBtn');
const tryAgainBtn = document.getElementById('tryAgainBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const copyRoomId = document.getElementById('copyRoomId');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const closeToast = document.getElementById('closeToast');
const localVideoEl = document.getElementById('localVideo');
const remoteVideoEl = document.getElementById('remoteVideo');
const userListEl = document.getElementById('userList');
const roomInfoEl = document.getElementById('roomInfo');
const roomIdEl = document.getElementById('roomId');
const usernameEl = document.getElementById('username');
const chatInput = document.getElementById('chatInput');
// Video kontrolleri elemanları
const volumeSlider = document.getElementById('volumeSlider');
const muteBtn = document.getElementById('muteBtn');
const theaterModeBtn = document.getElementById('theaterModeBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const videoControls = document.querySelector('.video-controls');

// Variables
let roomId = null;
let username = null;
let socketId = null;
let peerConnections = {};
let localStream = null;
let screenStream = null;
let isScreenSharing = false;
let isRoomOwner = false;
let users = [];
let isConnectedToServer = false;
let reconnectAttempts = 0;
let currentSharer = null;
let isMuted = false;
let isTheaterMode = false;
let isFullscreen = false;
let notificationTimeout = null;
let lastDisconnectTime = 0;
let hasJoinedBefore = false;
const RECONNECT_THRESHOLD = 2000; // 2 seconds
let activeStreamCheckInterval = null; // Interval for checking active streams

// Mobil cihaz kontrolü
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// ICE servers configuration (STUN & TURN servers)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

// Socket.io connection - connect explicitly with current URL
const socket = io(window.location.origin, { 
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 20,
    timeout: 10000,
    transports: ['websocket', 'polling'],
    forceNew: true
});

// Video kalitesi ve buffer ayarları
const VIDEO_QUALITY_LEVELS = {
    LOW: { width: 1280, height: 720, bitrate: 2500000, frameRate: 60 },
    MEDIUM: { width: 1920, height: 1080, bitrate: 5000000, frameRate: 120 },
    HIGH: { width: 2560, height: 1440, bitrate: 8000000, frameRate: 144 }
};

let currentQualityLevel = 'HIGH';
let networkQualityMonitor = null;
let bufferSize = 5; // Buffer boyutunu 5 saniyeye çıkardım
let lastQualityChangeTime = 0;
const QUALITY_CHANGE_COOLDOWN = 15000; // 15 saniye

// Chat spam kontrolü için değişkenler
let messageCount = 0;
let lastMessageTime = 0;
let isSpamBlocked = false;
let spamTimeout = null;
const MAX_MESSAGES = 7;
const MESSAGE_WINDOW = 1000; // 1 saniye
const SPAM_COOLDOWN = 30000; // 30 saniye

// Performance Monitoring
let fps = 0;
let lastTime = performance.now();
let frameCount = 0;
let lastPingTime = 0;
let bandwidthStats = { bytesReceived: 0, lastUpdate: 0 };
let cpuUsage = 0;
let memoryUsage = 0;

// Küfür ve uygunsuz kelime kontrolü için blockedWords array'i ekleyelim
const blockedWords = [
    'amk', 'aq', 'sg', 'oç', 'piç', 'yavşak', 'amına', 'sikerim', 'sikim', 'amcık', 'amcik',
    'ananısikim', 'ananisikim', 'anan', 'sikeyim', 'sikik', 'amq', 'amcık', 'amcik', 'amına koyayım',
    'amina koyayim', 'amına koyim', 'amina koyim', 'mk', 'aq', 'sg', 'oc', 'pic', 'yavşak',
    'amina', 'sikerim', 'sikim', 'amcik', 'amcık', 'ananisikim', 'ananısikim', 'anan', 'sikeyim',
    'sikik', 'amq', 'amcik', 'amcık', 'amina koyayim', 'amına koyayım', 'amina koyim', 'amına koyim'
];

// Input değerlerini temizle ve kontrol et
function sanitizeInput(input) {
    return input.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
}

function containsBlockedWords(text) {
    const lowerText = text.toLowerCase();
    // Metni kelimelere ayır
    const words = lowerText.split(/\s+/);
    
    // Her kelimeyi kontrol et
    return words.some(word => {
        // Noktalama işaretlerini temizle
        const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
        // Tam kelime eşleşmesi kontrol et
        return blockedWords.includes(cleanWord);
    });
}

// Validate input
function validateUsername(username) {
    const sanitizedUsername = sanitizeInput(username);
    
    if (!sanitizedUsername || sanitizedUsername.length < 2) {
        return {
            isValid: false,
            message: 'Lütfen en az 2 karakter içeren bir kullanıcı adı girin'
        };
    }

    if (containsBlockedWords(sanitizedUsername)) {
        return {
            isValid: false,
            message: 'Kullanıcı adında uygunsuz kelimeler bulunamaz'
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedUsername
    };
}

function updatePerformanceStats() {
    // FPS Calculation - Daha doğru FPS hesaplama
    const currentTime = performance.now();
    frameCount++;
    
    if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        document.getElementById('fpsCounter').textContent = fps;
        frameCount = 0;
        lastTime = currentTime;
    }

    // Ping Calculation - Daha doğru ping hesaplama
    if (socket && socket.connected) {
        const now = Date.now();
        if (now - lastPingTime >= 1000) {
            const start = performance.now();
            socket.emit('ping', () => {
                const latency = performance.now() - start;
                document.getElementById('pingCounter').textContent = `${Math.round(latency)} ms`;
            });
            lastPingTime = now;
        }
    }

    // Memory Usage - Daha doğru bellek kullanımı hesaplama
    if (window.performance && window.performance.memory) {
        const usedHeap = window.performance.memory.usedJSHeapSize;
        const totalHeap = window.performance.memory.totalJSHeapSize;
        memoryUsage = Math.round(usedHeap / (1024 * 1024));
        const memoryPercentage = Math.round((usedHeap / totalHeap) * 100);
        document.getElementById('memoryUsage').textContent = `${memoryUsage} MB (${memoryPercentage}%)`;
    }

    // Bandwidth Usage - Daha doğru bant genişliği hesaplama
    if (screenDisplay && screenDisplay.srcObject) {
        const tracks = screenDisplay.srcObject.getVideoTracks();
        if (tracks.length > 0) {
            tracks[0].getStats().then(stats => {
                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'video') {
                        const bytesReceived = report.bytesReceived || 0;
                        const now = performance.now();
                        const timeDiff = (now - bandwidthStats.lastUpdate) / 1000; // seconds
                        
                        if (timeDiff >= 1) {
                            const bytesPerSecond = (bytesReceived - bandwidthStats.bytesReceived) / timeDiff;
                            const kbps = bytesPerSecond / 1024;
                            document.getElementById('bandwidthUsage').textContent = `${Math.round(kbps)} KB/s`;
                            
                            bandwidthStats.bytesReceived = bytesReceived;
                            bandwidthStats.lastUpdate = now;
                        }
                    }
                });
            });
        }
    }

    // CPU Usage - Daha doğru CPU kullanımı hesaplama
    if (window.performance && window.performance.now) {
        const startTime = performance.now();
        let totalTime = 0;
        
        // CPU kullanımını hesapla
        for (let i = 0; i < 1000000; i++) {
            totalTime += Math.sqrt(i);
        }
        
        const endTime = performance.now();
        const processingTime = endTime - startTime;
        cpuUsage = Math.min(100, Math.round((processingTime / 10) * 100));
        document.getElementById('cpuUsage').textContent = `${cpuUsage}%`;
    }

    requestAnimationFrame(updatePerformanceStats);
}

function setupPerformanceMonitor() {
    const toggleBtn = document.getElementById('togglePerformanceBtn');
    const closeBtn = document.getElementById('closePerformanceBtn');
    const performancePanel = document.getElementById('performancePanel');

    toggleBtn.addEventListener('click', () => {
        performancePanel.classList.toggle('hidden');
    });

    closeBtn.addEventListener('click', () => {
        performancePanel.classList.add('hidden');
    });

    // Start performance monitoring
    updatePerformanceStats();
}

// Debug function - log everything to console
function debug(...args) {
    console.log('[WatchTug]', ...args);
}

// Utility functions
function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    const value = results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    debug(`URL parametresi alındı: ${name} = ${value}`);
    return value;
}

function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.classList.add('toast-slide-in');
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    
    setTimeout(() => {
        hideToast();
    }, duration);
}

function hideToast() {
    toast.classList.add('toast-slide-out');
    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
        toast.classList.remove('toast-slide-in');
        toast.classList.remove('toast-slide-out');
    }, 300);
}

function formatTime(date) {
    try {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch (e) {
        console.error('Tarih formatlanırken hata oluştu:', e);
        return '00:00';
    }
}

// Get user initials for avatar
function getUserInitials(name) {
    if (!name) return '?';
    
    const nameParts = name.split(' ');
    if (nameParts.length === 1) {
        return name.charAt(0).toUpperCase();
    } else {
        return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
    }
}

// Update users list
function updateUsersList(users) {
    debug('Kullanıcı listesi güncelleniyor:', users);
    usersContainer.innerHTML = '';
    
    if (!users || users.length === 0) {
        debug('Kullanıcı listesi boş!');
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'text-gray-500 text-center w-full p-2';
        emptyMessage.textContent = 'Odada henüz kimse yok';
        usersContainer.appendChild(emptyMessage);
        return;
    }
    
    // Filter unique users by ID - remove duplicates
    const uniqueUsers = [];
    const userIds = new Set();
    
    users.forEach(user => {
        if (!userIds.has(user.id)) {
            userIds.add(user.id);
            uniqueUsers.push(user);
        } else {
            debug(`Tekrarlanan kullanıcı ID'si atlandı: ${user.id} (${user.username})`);
        }
    });
    
    uniqueUsers.forEach(user => {
        const userElement = document.createElement('div');
        userElement.id = `user-${user.id}`;
        userElement.className = `user-item ${user.id === socketId ? 'self' : ''} ${user.id === currentSharer ? 'sharing' : ''}`;
        
        const avatarElement = document.createElement('div');
        avatarElement.className = 'user-avatar';
        avatarElement.textContent = getUserInitials(user.username);
        
        const usernameElement = document.createElement('div');
        usernameElement.textContent = user.username;
        
        userElement.appendChild(avatarElement);
        userElement.appendChild(usernameElement);
        
        if (user.id === currentSharer) {
            const sharingIcon = document.createElement('i');
            sharingIcon.className = 'fas fa-desktop ml-2 text-primary-400';
            userElement.appendChild(sharingIcon);
        }
        
        if (user.id === socketId) {
            const selfBadge = document.createElement('span');
            selfBadge.className = 'ml-2 text-xs text-primary-300';
            selfBadge.textContent = '(ben)';
            userElement.appendChild(selfBadge);
        }
        
        usersContainer.appendChild(userElement);
    });
    
    // Debug panel'i güncelle
    if (document.getElementById('debugPanel') && 
        !document.getElementById('debugPanel').classList.contains('hidden')) {
        document.getElementById('debugRoomId').textContent = roomId || 'Bulunamadı';
        document.getElementById('debugSocketId').textContent = socketId || 'Bağlantı Yok';
        document.getElementById('debugUsername').textContent = username || 'Ayarlanmadı';
        document.getElementById('debugUrl').textContent = window.location.href;
    }
}

// Add a chat message
function addChatMessage(message, isScrollToBottom = true) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.isSystem ? 'system-message' : ''}`;
    
    // Time
    const time = message.timestamp ? new Date(message.timestamp) : new Date();
    const timeElement = document.createElement('span');
    timeElement.className = 'text-xs text-gray-500';
    timeElement.textContent = formatTime(time);
    
    // Message content
    const contentWrapper = document.createElement('div');
    
    if (!message.isSystem) {
        const senderElement = document.createElement('span');
        senderElement.className = 'user-badge';
        senderElement.textContent = message.user;
        contentWrapper.appendChild(senderElement);
    }
    
    const messageText = document.createElement('span');
    messageText.textContent = message.message;
    contentWrapper.appendChild(messageText);
    
    messageElement.appendChild(timeElement);
    messageElement.appendChild(document.createElement('br'));
    messageElement.appendChild(contentWrapper);
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom if needed
    if (isScrollToBottom) {
        scrollChatToBottom();
    }

    // Eğer tam ekran modundaysak ve sistem mesajı değilse bildirim göster
    if (isFullscreen && !message.isSystem && message.user !== username) {
        showMessageNotification(message);
    }
}

// Sohbet mesajlarını en alta kaydır
function scrollChatToBottom() {
    if (!chatMessages) return;
    
    // Mobil cihazlarda daha agresif kaydırma
    if (isMobile) {
        // Önce normal kaydırma
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        // Sonra birkaç kez daha deneme (DOM güncellemesinin tamamlanmasını beklemek için)
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight + 1000; // Ekstra değer ekleyerek zorla kaydırma
            
            // Tiyatro modunda ekstra önlemler
            if (isTheaterMode) {
                // Birkaç kez daha deneme
                setTimeout(() => {
                    chatMessages.scrollTop = chatMessages.scrollHeight + 1000;
                    
                    // Son bir deneme daha
                    setTimeout(() => {
                        chatMessages.scrollTop = chatMessages.scrollHeight + 1000;
                        
                        // Scroll pozisyonunu kontrol et, eğer hala en altta değilse zorla
                        if (chatMessages.scrollHeight - chatMessages.scrollTop > chatMessages.clientHeight + 50) {
                            chatMessages.scrollTop = chatMessages.scrollHeight + 1000;
                        }
                    }, 300);
                }, 150);
            }
        }, 50);
    } else {
        // Masaüstü için normal kaydırma
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Mesaj bildirimi gösterme fonksiyonu
function showMessageNotification(message) {
    const notification = document.getElementById('messageNotification');
    const sender = notification.querySelector('.notification-sender');
    const time = notification.querySelector('.notification-time');
    const content = notification.querySelector('.notification-content');
    
    // Bildirim içeriğini güncelle
    sender.textContent = message.user;
    time.textContent = formatTime(new Date(message.timestamp || Date.now()));
    content.textContent = message.message;
    
    // Bildirimi göster
    notification.classList.remove('hidden');
    notification.classList.add('notification-slide-in');
    
    // Önceki zamanlayıcıyı temizle
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // 5 saniye sonra bildirimi gizle
    notificationTimeout = setTimeout(() => {
        notification.classList.add('notification-slide-out');
        setTimeout(() => {
            notification.classList.add('hidden');
            notification.classList.remove('notification-slide-in', 'notification-slide-out');
        }, 300);
    }, 5000);
}

// Network kalitesini izle
function startNetworkQualityMonitor() {
    if (networkQualityMonitor) return;
    
    networkQualityMonitor = setInterval(() => {
        if (!screenDisplay || !screenDisplay.srcObject) return;
        
        const stats = screenDisplay.getVideoPlaybackQuality();
        const droppedFrames = stats.droppedVideoFrames;
        const totalFrames = stats.totalVideoFrames;
        const frameDropRate = droppedFrames / totalFrames;
        
        // Kalite değişimi için cooldown kontrolü
        const now = Date.now();
        if (now - lastQualityChangeTime < QUALITY_CHANGE_COOLDOWN) return;
        lastQualityChangeTime = now;
        
        // Network kalitesine göre video kalitesini ayarla
        if (frameDropRate > 0.1) { // %10'dan fazla frame kaybı
            adjustVideoQuality('LOW');
        } else if (frameDropRate > 0.05) { // %5-%10 arası frame kaybı
            adjustVideoQuality('MEDIUM');
        } else if (frameDropRate < 0.02 && currentQualityLevel !== 'HIGH') { // %2'den az frame kaybı
            adjustVideoQuality('HIGH');
        }
    }, 5000); // Her 5 saniyede bir kontrol et
}

// Video kalitesini ayarla
function adjustVideoQuality(level) {
    if (currentQualityLevel === level) return;
    
    const quality = VIDEO_QUALITY_LEVELS[level];
    if (!quality) return;
    
    // Kalite değişimi için cooldown kontrolü
    const now = Date.now();
    if (now - lastQualityChangeTime < QUALITY_CHANGE_COOLDOWN) return;
    lastQualityChangeTime = now;
    
    currentQualityLevel = level;
    
    // Video elementinin buffer boyutunu ayarla
    if (screenDisplay) {
        screenDisplay.buffered = bufferSize;
    }
    
    // Ekran paylaşımı yapılıyorsa kaliteyi güncelle
    if (isScreenSharing && screenStream) {
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
            const constraints = {
                width: { ideal: quality.width },
                height: { ideal: quality.height },
                frameRate: { ideal: quality.frameRate },
                bitrate: quality.bitrate
            };
            
            videoTrack.applyConstraints(constraints)
                .then(() => {
                    debug(`Video kalitesi ${level} seviyesine ayarlandı`);
                    showToast(`Video kalitesi ${level} seviyesine ayarlandı`, 2000);
                })
                .catch(error => debug('Video kalitesi ayarlama hatası:', error));
        }
    }
}

// Initialize WebRTC - Ekran paylaşımını başlatma işlevi
async function initializeCall() {
    debug('Ekran paylaşımı başlatılıyor...');
    connectingScreen.classList.remove('hidden');
    waitingScreen.classList.add('hidden');
    
    try {
        // Ekran paylaşımı erişimi iste
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor',
                frameRate: { ideal: VIDEO_QUALITY_LEVELS[currentQualityLevel].frameRate },
                width: { ideal: VIDEO_QUALITY_LEVELS[currentQualityLevel].width },
                height: { ideal: VIDEO_QUALITY_LEVELS[currentQualityLevel].height }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 48000,
                channelCount: 2
            }
        });
        
        // Video track'ini optimize et
        const videoTrack = screenStream.getVideoTracks()[0];
        if (videoTrack) {
            const constraints = {
                width: { ideal: VIDEO_QUALITY_LEVELS[currentQualityLevel].width },
                height: { ideal: VIDEO_QUALITY_LEVELS[currentQualityLevel].height },
                frameRate: { ideal: VIDEO_QUALITY_LEVELS[currentQualityLevel].frameRate },
                bitrate: VIDEO_QUALITY_LEVELS[currentQualityLevel].bitrate
            };
            
            await videoTrack.applyConstraints(constraints);
            
            // Video track'ine özel ayarlar
            const settings = videoTrack.getSettings();
            debug('Video ayarları:', settings);
            
            // Video track'ini optimize et
            videoTrack.contentHint = 'detail'; // Daha yüksek kalite için
        }
        
        // Network kalitesi izlemeyi başlat
        startNetworkQualityMonitor();
        
        // Hide connecting screen
        connectingScreen.classList.add('hidden');
        
        // Show stop sharing button
        sharingControls.classList.remove('hidden');
        waitingScreen.classList.add('hidden');
        
        // Update UI
        isScreenSharing = true;
        currentSharer = socketId;
        
        // Ekran paylaşımını başlattığımızı sunucuya bildir
        socket.emit('start-sharing', roomId);
        debug('Ekran paylaşımı başlatıldı, diğer kullanıcılara bildiriliyor...');
        
        // Kendi ekranımızı göster
        screenDisplay.srcObject = screenStream;
        screenDisplay.buffered = bufferSize;
        screenDisplay.play()
            .then(() => debug('Yerel video oynatma başarılı'))
            .catch(error => debug('Yerel video oynatma hatası:', error));
        
        // Odadaki tüm kullanıcılara medya akışını gönder
        const userElements = document.querySelectorAll('.user-item');
        for (const userElement of userElements) {
            const peerId = userElement.id.split('-')[1];
            if (peerId !== socketId) {
                createPeerConnectionAndOffer(peerId);
            }
        }
    } catch (error) {
        debug('Ekran paylaşımı başlatma hatası:', error);
        connectingScreen.classList.add('hidden');
        noPermissionScreen.classList.remove('hidden');
    }
}

// Ekran paylaşımını durdur
async function stopSharing() {
    debug('Ekran paylaşımı durduruluyor...');
    
    if (screenStream) {
        // Ekran paylaşımını kapat
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }
    
    // Update UI
    waitingScreen.classList.remove('hidden');
    sharingControls.classList.add('hidden');
    isScreenSharing = false;
    
    // Sunucuya ekran paylaşımını durduğumuzu bildir
    socket.emit('stop-sharing', roomId);
    
    // Ekran paylaşımı yapan kullanıcı işaretini kaldır
    if (currentSharer === socketId) {
        currentSharer = null;
        
        // Arayüzü güncelle
        screenDisplay.srcObject = null;
        
        // Kullanıcı listesini güncelle
        const userElement = document.getElementById(`user-${socketId}`);
        if (userElement) {
            userElement.classList.remove('sharing');
            const icon = userElement.querySelector('.fa-desktop');
            if (icon) {
                icon.remove();
            }
        }
    }
    
    // Mevcut tüm bağlantıları kapat ve yeniden oluştur
    Object.keys(peerConnections).forEach(peerId => {
        if (peerConnections[peerId]) {
            peerConnections[peerId].close();
            delete peerConnections[peerId];
        }
    });
    
    showToast('Ekran paylaşımı durduruldu');
}

// Create a new RTCPeerConnection
function createPeerConnection(peerId) {
    debug(`Peer bağlantısı oluşturuluyor: ${peerId}`);
    
    if (peerConnections[peerId]) {
        debug(`${peerId} için zaten bir bağlantı var, kapatılıp yeniden oluşturuluyor`);
        peerConnections[peerId].close();
        delete peerConnections[peerId];
    }
    
    // Daha güçlü ICE sunucu yapılandırması
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
    });
    
    // ICE candidate event
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            debug(`ICE candidate gönderiliyor: ${peerId}`);
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                target: peerId,
                from: socketId,
                roomId: roomId
            });
        }
    };
    
    // Connection state changes
    peerConnection.onconnectionstatechange = () => {
        debug(`Bağlantı durumu değişti: ${peerConnection.connectionState}, Peer: ${peerId}`);
        
        // Bağlantı başarılı olduğunda
        if (peerConnection.connectionState === 'connected') {
            debug(`Peer bağlantısı başarılı: ${peerId}`);
            waitingScreen.classList.add('hidden');
        }
        
        // Bağlantı koptuğunda veya başarısız olduğunda
        if (peerConnection.connectionState === 'disconnected' || 
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'closed') {
            debug(`Peer bağlantısı koptu/başarısız oldu: ${peerId}`);
            
            // Eğer bu paylaşım yapan kullanıcıysa ve hala paylaşım yapıyorsa
            if (peerId === currentSharer) {
                // Bağlantıyı temizle ve yeniden dene
                cleanupPeerConnection(peerId);
                
                // Kısa bir süre sonra yeniden bağlanmayı dene
                setTimeout(() => {
                    socket.emit('ready', { 
                        roomId: roomId,
                        from: socketId,
                        to: peerId 
                    });
                }, 1000);
            }
        }
    };
    
    // ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
        debug(`ICE Bağlantı durumu: ${peerConnection.iceConnectionState}, Peer: ${peerId}`);
        
        if (peerConnection.iceConnectionState === 'disconnected' || 
            peerConnection.iceConnectionState === 'failed' ||
            peerConnection.iceConnectionState === 'closed') {
            debug(`ICE bağlantısı koptu/başarısız oldu: ${peerId}`);
            
            // Eğer bu paylaşım yapan kullanıcıysa ve hala paylaşım yapıyorsa
            if (peerId === currentSharer) {
                // Bağlantıyı temizle ve yeniden dene
            cleanupPeerConnection(peerId);
            
                // Kısa bir süre sonra yeniden bağlanmayı dene
                setTimeout(() => {
                    socket.emit('ready', { 
                        roomId: roomId,
                        from: socketId,
                        to: peerId 
                    });
                }, 1000);
            }
        }
    };
    
    // Track event - receiving remote stream
    peerConnection.ontrack = (event) => {
        debug(`${peerId} kullanıcısından medya track alındı:`, event.track.kind);
        
        // Tüm track'leri toplamak için bir MediaStream oluştur
        if (!screenDisplay.srcObject) {
            screenDisplay.srcObject = new MediaStream();
        }
        
        // Track'i ekle
        screenDisplay.srcObject.addTrack(event.track);
        
        // waitingScreen'i gizle
        waitingScreen.classList.add('hidden');
        
        // Video hazır olduğunda
        screenDisplay.onloadedmetadata = () => {
            debug('Video metadata yüklendi, oynatma başlatılıyor...');
            screenDisplay.play()
                .then(() => {
                    debug('Video oynatma başarılı');
                    waitingScreen.classList.add('hidden');
                    currentSharer = peerId;
                    
                    // Update users list
                    const userElement = document.getElementById(`user-${peerId}`);
                    if (userElement) {
                        userElement.classList.add('sharing');
                        
                        // Add sharing icon
                        if (!userElement.querySelector('.fa-desktop')) {
                            const sharingIcon = document.createElement('i');
                            sharingIcon.className = 'fas fa-desktop ml-2 text-primary-400';
                            userElement.appendChild(sharingIcon);
                        }
                    }
                })
                .catch(error => {
                    debug('Video oynatma hatası:', error);
                    // Otomatik oynatma engellendiyse tekrar dene
                    screenDisplay.muted = true;
                    screenDisplay.play()
                        .then(() => {
                            debug('Video sessiz modda başlatıldı');
                            screenDisplay.muted = false;
                            waitingScreen.classList.add('hidden');
                        })
                        .catch(err => {
                            debug('Video oynatma tekrar başarısız:', err);
                        });
                });
        };
        
        // Track bittiğinde
        event.track.onended = () => {
            debug(`Track sonlandı: ${event.track.kind}`);
            if (screenDisplay.srcObject) {
                screenDisplay.srcObject.removeTrack(event.track);
                // Eğer hiç track kalmadıysa
                if (!screenDisplay.srcObject.getTracks().length) {
                    screenDisplay.srcObject = null;
                    waitingScreen.classList.remove('hidden');
                    currentSharer = null;
                }
            }
        };
    };
    
    // Add screen stream if sharing
    if (isScreenSharing && screenStream) {
        debug(`${peerId} kullanıcısına ekran paylaşımı gönderiliyor`);
        try {
            screenStream.getTracks().forEach(track => {
                debug(`Track ekleniyor: ${track.kind}, enabled: ${track.enabled}, muted: ${track.muted}`);
                const sender = peerConnection.addTrack(track, screenStream);
                debug(`Track gönderici oluşturuldu:`, sender);
            });
        } catch (error) {
            debug('Track eklenirken hata:', error);
        }
    }
    
    peerConnections[peerId] = peerConnection;
    return peerConnection;
}

// Create a new RTCPeerConnection and send an offer
function createPeerConnectionAndOffer(peerId) {
    debug(`${peerId} için peer bağlantısı ve offer oluşturuluyor`);
    
    // Eğer zaten bir bağlantı varsa, önce onu temizle
    if (peerConnections[peerId]) {
        debug(`${peerId} için mevcut bağlantı temizleniyor`);
        peerConnections[peerId].close();
        delete peerConnections[peerId];
    }
    
    const peerConnection = createPeerConnection(peerId);
    
    // Create and send offer
    peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    })
    .then(offer => {
        debug(`Offer oluşturuldu:`, offer);
        return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
        debug(`${peerId} kullanıcısına offer gönderiliyor`);
        socket.emit('offer', {
            offer: peerConnection.localDescription,
            target: peerId,
            roomId: roomId,
            from: socketId
        });
    })
    .catch(error => {
        console.error('Offer oluşturulurken hata:', error);
        // Hata durumunda yeniden deneme
        setTimeout(() => {
            if (peerConnections[peerId]) {
                socket.emit('ready', { roomId, from: socketId, to: peerId });
            }
        }, 2000);
    });
    
    return peerConnection;
}

// Clean up peer connection
function cleanupPeerConnection(peerId) {
    debug(`Peer bağlantısı temizleniyor: ${peerId}`);
    
    if (peerConnections[peerId]) {
        peerConnections[peerId].close();
        delete peerConnections[peerId];
        
        // If this was the current sharer, clean up the video
        if (currentSharer === peerId) {
            screenDisplay.srcObject = null;
            waitingScreen.classList.remove('hidden');
            currentSharer = null;
        }
    }
}

// Socket.io event handlers
function setupSocketEvents() {
    // Connect event
    socket.on('connect', () => {
        debug('Sunucuya bağlanıldı');
        isConnectedToServer = true;
        reconnectAttempts = 0;
        
        // Local storage'dan kullanıcı bilgilerini al
        const savedUsername = localStorage.getItem('watchtug_username');
        const savedRoom = localStorage.getItem('watchtug_room');
        
        if (savedUsername) {
            username = savedUsername;
            socket.emit('set-username', username);
        }
        
        // Join room only if not joined before or after a significant time has passed
        if (!hasJoinedBefore || (Date.now() - lastDisconnectTime > RECONNECT_THRESHOLD)) {
            joinRoom();
            hasJoinedBefore = true;
        }
        
        showToast('Sunucuya bağlandı!', 2000);
    });
    
    // Username validation error
    socket.on('username-error', (data) => {
        debug(`Kullanıcı adı hatası: ${data.message}`);
        
        // Geçersiz kullanıcı adını localStorage'dan sil
        localStorage.removeItem('watchtug_username');
        
        // Varsayılan kullanıcı adını kullan
        username = 'Misafir';
        
        // Kullanıcıya bildir
        showToast(`Kullanıcı adı geçersiz: ${data.message}. 'Misafir' olarak devam ediliyor.`, 3000);
        
        // Yeni kullanıcı adıyla tekrar dene
        socket.emit('set-username', username);
    });
    
    // Username validation success
    socket.on('username-validated', (data) => {
        debug(`Kullanıcı adı doğrulandı: ${data.username}`);
        
        // Sunucudan gelen doğrulanmış kullanıcı adını kullan
        username = data.username;
        
        // Doğrulanmış kullanıcı adını localStorage'a kaydet
        localStorage.setItem('watchtug_username', username);
    });
    
    // Otomatik yayın bağlantısı
    socket.on('auto-connect-stream', (data) => {
        debug(`Otomatik yayın bağlantısı sinyali alındı: ${data.sharerId}`);
        
        // Yayın paylaşan kişiyi kaydet
        currentSharer = data.sharerId;
        
        // Yayına bağlan
        socket.emit('ready', { 
            roomId: data.roomId,
            from: socketId,
            to: data.sharerId 
        });
        
        // UI'ı güncelle - paylaşım yapan kullanıcıyı göster
        const userElement = document.getElementById(`user-${data.sharerId}`);
        if (userElement) {
            userElement.classList.add('sharing');
            
            // Paylaşım ikonunu ekle (eğer yoksa)
            if (!userElement.querySelector('.fa-desktop')) {
                const sharingIcon = document.createElement('i');
                sharingIcon.className = 'fas fa-desktop ml-2 text-primary-400';
                userElement.appendChild(sharingIcon);
            }
            
            // Kullanıcı adını al ve bildirim göster
            const sharingUsername = userElement.querySelector('div:not(.user-avatar)').textContent.replace('(ben)', '').trim();
            showToast(`${sharingUsername} ekran paylaşımına bağlanılıyor...`, 3000);
        }
    });
    
    // Disconnect event
    socket.on('disconnect', (reason) => {
        debug('Sunucu bağlantısı kesildi:', reason);
        isConnectedToServer = false;
        lastDisconnectTime = Date.now();
        
        // Clear active stream check interval
        if (activeStreamCheckInterval) {
            clearInterval(activeStreamCheckInterval);
            activeStreamCheckInterval = null;
        }
        
        // Bağlantı kesildiğinde bilgileri sakla
        if (username) {
            localStorage.setItem('watchtug_username', username);
        }
        if (roomId) {
            localStorage.setItem('watchtug_room', roomId);
        }
        
        // Show reconnecting message
        showToast('Sunucu bağlantısı kesildi. Yeniden bağlanılıyor...', 5000);
        
        // If disconnected due to transport close, clean up resources
        if (screenStream) {
            stopSharing();
        }
        
        // Clean up all peer connections
        Object.keys(peerConnections).forEach(peerId => {
            cleanupPeerConnection(peerId);
        });
    });
    
    // Reconnect event
    socket.on('reconnect', (attemptNumber) => {
        debug(`Sunucuya yeniden bağlanıldı (${attemptNumber} denemeden sonra)`);
        showToast('Sunucuya yeniden bağlanıldı! Odaya tekrar katılınıyor...', 3000);
        
        // Clean up all existing peer connections
        Object.keys(peerConnections).forEach(peerId => {
            cleanupPeerConnection(peerId);
        });
        
        // Set username again (to be safe)
        socket.emit('set-username', username);
        
        // Rejoin room
        joinRoom();
        
        // If we were sharing, restart sharing
        if (isScreenSharing && screenStream) {
            socket.emit('start-sharing', { roomId });
        } else {
            // If we were viewing, signal ready to receive stream
            socket.emit('viewer-ready', { roomId });
        }
    });
    
    // Reconnect attempt event
    socket.on('reconnect_attempt', (attempt) => {
        reconnectAttempts = attempt;
        debug(`Yeniden bağlanma denemesi: ${attempt}`);
        showToast(`Sunucuya yeniden bağlanılıyor (${attempt}. deneme)...`);
    });
    
    // Reconnect error
    socket.on('reconnect_error', (error) => {
        debug('Yeniden bağlanma hatası:', error);
        showToast(`Sunucuya bağlanılamadı. Tekrar deneniyor...`, 3000);
    });
    
    // Reconnect failed
    socket.on('reconnect_failed', () => {
        debug('Yeniden bağlanma başarısız oldu');
        showToast('Sunucuya bağlanılamadı. Sayfa yenileniyor...', 5000);
        
        // Reload page after a delay
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    });
    
    // Room joined event
    socket.on('room-joined', (data) => {
        debug('Odaya katılındı:', data);
        roomId = data.roomId;
        socketId = socket.id; // Socket ID'yi kaydet
        localStorage.setItem('watchtug_room', roomId);
        
        // Update room ID display
        roomIdDisplay.textContent = data.roomId;
        
        // Update users list
        if (data.users && Array.isArray(data.users)) {
            // Make sure our user ID is updated in the users list
            const existingUserIndex = data.users.findIndex(u => u.username === username);
            if (existingUserIndex !== -1 && data.users[existingUserIndex].id !== socketId) {
                debug(`Kullanıcı ID'si güncelleniyor: ${data.users[existingUserIndex].id} -> ${socketId}`);
                data.users[existingUserIndex].id = socketId;
            }
            
            updateUsersList(data.users);
        } else {
            debug('Kullanıcı listesi alınamadı!', data);
            updateUsersList([]);
        }
        
        // Eğer odada aktif bir yayıncı varsa
        if (data.currentSharer) {
            debug(`Odada aktif bir yayıncı var: ${data.currentSharer}`);
            currentSharer = data.currentSharer;
            
            // Yayıncıya hazır olduğumuzu bildir
            socket.emit('ready', { 
                roomId: roomId,
                from: socketId,
                to: data.currentSharer 
            });
        }
        
        // Start checking for active streams
        if (activeStreamCheckInterval) {
            clearInterval(activeStreamCheckInterval);
        }
        activeStreamCheckInterval = setInterval(checkForActiveStreams, 500); // Check every 0.5 seconds
        
        // Sayfa yenilemesinden sonra video akışı varsa waitingScreen'i gizle
        if (screenDisplay && screenDisplay.srcObject && screenDisplay.srcObject.active) {
            waitingScreen.classList.add('hidden');
        }
        
        // Show welcome toast
        showToast(`${data.roomId} odasına hoş geldiniz!`);
        
        // If this is our first join (not a reconnect), add a system message
        if (!hasJoinedBefore) {
            setTimeout(() => {
                // Check if the server already sent a join message
                const lastMessages = Array.from(chatMessages.children).slice(-3);
                const hasJoinMessage = lastMessages.some(msg => 
                    msg.classList.contains('system-message') && 
                    msg.textContent.includes(`${username} odaya katıldı`)
                );
                
                if (!hasJoinMessage) {
                    addChatMessage({
                        id: Date.now(),
                        user: 'Sistem',
                        message: `${username} odaya katıldı`,
                        timestamp: new Date(),
                        isSystem: true
                    });
                }
                
                hasJoinedBefore = true;
            }, 1000);
        }
    });
    
    // User joined event
    socket.on('user-joined', (user) => {
        debug('Kullanıcı odaya katıldı:', user);
        
        // Skip if this is our own join event
        if (user.id === socketId) {
            debug('Kendi katılım olayımızı atlıyoruz');
            return;
        }
        
        // Add user to the users list if not already there
        const existingUser = document.getElementById(`user-${user.id}`);
        if (!existingUser) {
            // Get current users from the DOM
            const usersList = Array.from(usersContainer.children)
                .filter(el => el.id && el.id.startsWith('user-'))
                .map(el => {
                    const userNameEl = el.querySelector('div:not(.user-avatar)');
                    return { 
                        id: el.id.replace('user-', ''),
                        username: userNameEl ? userNameEl.textContent.replace('(ben)', '').trim() : 'Kullanıcı'
                    };
                });
            
            // Add the new user
            usersList.push(user);
            
            // Update the users list
            updateUsersList(usersList);
            
            // If we're sharing, send a connection offer to the new user
            if (isScreenSharing && screenStream) {
                debug(`Yeni kullanıcıya (${user.id}) ekran paylaşımı gönderiliyor`);
                setTimeout(() => {
                    createPeerConnectionAndOffer(user.id);
                }, 1000);
            }
            
            // Check if a system message about this join is already in the chat
            setTimeout(() => {
                const lastMessages = Array.from(chatMessages.children).slice(-3);
                const hasJoinMessage = lastMessages.some(msg => 
                    msg.classList.contains('system-message') && 
                    msg.textContent.includes(`${user.username} odaya katıldı`)
                );
                
                if (!hasJoinMessage) {
                    addChatMessage({
                        id: Date.now(),
                        user: 'Sistem',
                        message: `${user.username} odaya katıldı`,
                        timestamp: new Date(),
                        isSystem: true
                    });
                }
            }, 500);
        }
    });
    
    // User disconnected event
    socket.on('user-disconnected', (userId) => {
        debug('Kullanıcı bağlantısı kesildi:', userId);
        
        // Find username before removing from UI
        let username = "Kullanıcı";
        const userElement = document.getElementById(`user-${userId}`);
        if (userElement) {
            const usernameElement = userElement.querySelector('div:not(.user-avatar)');
            if (usernameElement) {
                username = usernameElement.textContent.replace('(ben)', '').trim();
            }
            
            // Clean up peer connection
            cleanupPeerConnection(userId);
            
            // Remove user from the list
            userElement.remove();
            
            // If no more users, show empty message
            if (usersContainer.children.length === 0) {
                updateUsersList([]);
            }
            
            // Add system message to chat if not already added by server
            // This is a backup in case server message didn't arrive
            setTimeout(() => {
                const lastMessage = chatMessages.lastElementChild;
                const isDisconnectMessage = lastMessage && 
                                          lastMessage.classList.contains('system-message') && 
                                          lastMessage.textContent.includes(`${username} odadan ayrıldı`);
                
                if (!isDisconnectMessage) {
                    addChatMessage({
                        id: Date.now(),
                        user: 'Sistem',
                        message: `${username} odadan ayrıldı`,
                        timestamp: new Date(),
                        isSystem: true
                    });
                }
            }, 1000);
        }
    });
    
    // Chat message event
    socket.on('chat-message', (message) => {
        // Spam engeli sadece mesaj göndermeyi etkiler, gelen mesajları her zaman göster
        addChatMessage(message);
        
        // Her zaman mesajları aşağı kaydır, özellikle tiyatro modunda
        scrollChatToBottom();
    });
    
    // Chat history event
    socket.on('chat-history', (messages) => {
        debug('Sohbet geçmişi alındı:', messages);
        
        // Clear chat
        chatMessages.innerHTML = '';
        
        // Add messages
        if (messages && Array.isArray(messages)) {
            messages.forEach(message => {
                addChatMessage(message, false);
            });
            
            // Scroll to bottom
            scrollChatToBottom();
        }
    });
    
    // User sharing event
    socket.on('user-sharing', (data) => {
        debug('Kullanıcı ekran paylaşımı başlattı:', data.userId);
        currentSharer = data.userId;
        
        // Update UI to show who is sharing
        const userElement = document.getElementById(`user-${data.userId}`);
        if (userElement) {
            userElement.classList.add('sharing');
            
            // Add sharing icon
            if (!userElement.querySelector('.fa-desktop')) {
                const sharingIcon = document.createElement('i');
                sharingIcon.className = 'fas fa-desktop ml-2 text-primary-400';
                userElement.appendChild(sharingIcon);
            }
        }
    });
    
    // User stopped sharing event
    socket.on('user-stopped-sharing', (data) => {
        debug('Kullanıcı ekran paylaşımını durdurdu:', data.userId);
        
        // Clear video if this was the current sharer
        if (currentSharer === data.userId) {
            screenDisplay.srcObject = null;
            waitingScreen.classList.remove('hidden');
            currentSharer = null;
        }
        
        // Update UI
        const userElement = document.getElementById(`user-${data.userId}`);
        if (userElement) {
            userElement.classList.remove('sharing');
            const icon = userElement.querySelector('.fa-desktop');
            if (icon) {
                icon.remove();
            }
        }
    });
    
    // Room error event
    socket.on('room-error', (data) => {
        debug('Oda hatası:', data);
        
        // Hata mesajını daha belirgin şekilde göster
        const errorMessage = data.message || 'Bir hata oluştu';
        showToast(errorMessage, 5000); // 5 saniye göster
        
        // Konsola detaylı hata bilgisi
        console.error('Oda hatası detayları:', data);
        
        // Ana sayfaya yönlendirme zamanını uzat
        setTimeout(() => {
            debug('Ana sayfaya yönlendiriliyor...');
            window.location.href = '/';
        }, 5000); // 5 saniye sonra yönlendir
    });
    
    // Oturum geri yükleme
    socket.on('restore-session', (sessionData) => {
        debug('Oturum geri yükleniyor:', sessionData);
        
        // Kullanıcı adını ayarla
        if (sessionData.username) {
            username = sessionData.username;
            localStorage.setItem('watchtug_username', username);
        }
        
        // Odaya otomatik katıl
        if (sessionData.room) {
            roomId = sessionData.room;
            localStorage.setItem('watchtug_room', roomId);
            socket.emit('join-room', roomId);
        }
    });

    socket.on('offer', async (data) => {
        debug('Offer alındı:', data);
        
        try {
        // Create peer connection if not exists
        const peerConnection = createPeerConnection(data.from);
        
        // Set remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        debug(`${data.from} kullanıcısına answer gönderiliyor`);
        socket.emit('answer', {
            answer: peerConnection.localDescription,
            target: data.from,
            from: socketId,
            roomId: roomId
        });
            
            // Offer aldığımızda waitingScreen'i gizle (yayın gelecek demektir)
            waitingScreen.classList.add('hidden');
        } catch (error) {
            debug('Offer işlenirken hata:', error);
            
            // Hata durumunda bağlantıyı temizle ve yeniden dene
            cleanupPeerConnection(data.from);
            
            // Kısa bir süre sonra yeniden bağlanmayı dene
            setTimeout(() => {
                socket.emit('ready', { 
                    roomId: roomId,
                    from: socketId,
                    to: data.from 
                });
            }, 1000);
        }
    });

    socket.on('answer', async (data) => {
        debug('Answer alındı:', data);
        
        try {
        const peerConnection = peerConnections[data.from];
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            debug('Remote description başarıyla set edildi');
            } else {
                debug('Answer için peer bağlantısı bulunamadı, yeniden bağlanılıyor...');
                socket.emit('ready', { 
                    roomId: roomId,
                    from: socketId,
                    to: data.from 
                });
            }
        } catch (error) {
            debug('Answer işlenirken hata:', error);
            
            // Hata durumunda bağlantıyı temizle ve yeniden dene
            cleanupPeerConnection(data.from);
            
            // Kısa bir süre sonra yeniden bağlanmayı dene
            setTimeout(() => {
                socket.emit('ready', { 
                    roomId: roomId,
                    from: socketId,
                    to: data.from 
                });
            }, 1000);
        }
    });

    socket.on('ice-candidate', async (data) => {
        debug('ICE candidate alındı:', data);
        
        const peerConnection = peerConnections[data.from];
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                debug('ICE candidate başarıyla eklendi');
            } catch (error) {
                debug('ICE candidate eklenirken hata:', error);
            }
        }
    });
}

// Mevcut video bağlantısını temizle
function cleanupCurrentConnection() {
    // Tüm peer bağlantılarını kapat
    Object.keys(peerConnections).forEach(peerId => {
        if (peerConnections[peerId]) {
            debug(`Peer bağlantısı temizleniyor: ${peerId}`);
            peerConnections[peerId].close();
            delete peerConnections[peerId];
    }
    });
    
    // Video akışını temizle
    if (screenDisplay && screenDisplay.srcObject) {
        const tracks = screenDisplay.srcObject.getTracks();
        tracks.forEach(track => {
            track.stop();
            debug('Video track durduruldu');
        });
        screenDisplay.srcObject = null;
    }
    
    debug('Tüm bağlantılar temizlendi');
}

// Video kontrolleri için oynatma/durdurma işlevleri
function initVideoControls() {
    if (screenDisplay) {
        // Video hazır olduğunda
        screenDisplay.addEventListener('loadeddata', () => {
            debug('Video verisi yüklendi, kontroller etkinleştiriliyor...');
            videoControls.style.opacity = '1';
            
            // Video yüklendiğinde waitingScreen'i gizle
            waitingScreen.classList.add('hidden');
            
            // Buffer yönetimi
            screenDisplay.buffered = bufferSize;
            
            // Ses ve video senkronizasyonu
            if (screenDisplay.audioTracks && screenDisplay.videoTracks) {
                screenDisplay.audioTracks[0].enabled = true;
                screenDisplay.videoTracks[0].enabled = true;
            }
            
            // Mobil için otomatik oynatma ve ses ayarları
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                debug('Mobil cihaz algılandı, otomatik oynatma ve ses ayarları yapılıyor');
                
                // Video elementini otomatik oynatma için hazırla
                screenDisplay.autoplay = true;
                screenDisplay.playsInline = true;
                screenDisplay.muted = false;
                
                // Buffer boyutunu mobil için optimize et
                bufferSize = 3;
                screenDisplay.buffered = bufferSize;
                
                // Kullanıcı etkileşimi için dokunma olayı
                screenDisplay.addEventListener('touchstart', () => {
                    if (screenDisplay.paused) {
                        screenDisplay.play().catch(e => debug('Dokunma sonrası oynatma hatası:', e));
                    }
                });
                
                // Ses izni için kullanıcı etkileşimi
                const playWithAudio = () => {
                    screenDisplay.muted = false;
                    screenDisplay.play().catch(e => debug('Sesli oynatma hatası:', e));
                };
                
                // İlk dokunuşta sesi aç
                screenDisplay.addEventListener('touchstart', playWithAudio, { once: true });
                
                // Sayfa görünür olduğunda sesi aç
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden) {
                        playWithAudio();
                    }
                });
            }
        });
        
        // Hata durumunda
        screenDisplay.addEventListener('error', (e) => {
            debug('Video oynatma hatası:', e);
            if (currentSharer) {
                showToast('Video oynatılamıyor, yeniden bağlanmayı deniyorum...', 3000);
                cleanupCurrentConnection();
                setTimeout(() => socket.emit('ready', roomId), 2000);
            }
        });
    }
}

// Mobil için özel UI ayarları
function setupMobileUI() {
    if (isMobile) {
        debug('Mobil cihaz algılandı, özel UI ayarları yapılıyor...');
        
        // Video kontrollerini mobil için optimize et
        const videoControls = document.querySelector('.video-controls');
        if (videoControls) {
            videoControls.style.padding = '0 10px';
            
            // Kontrol butonlarını mobil için optimize et
            const buttons = videoControls.querySelectorAll('button');
            buttons.forEach(button => {
                button.style.padding = '8px';
            });
            
            // Ses kontrolünü mobil için optimize et
            const volumeSlider = document.getElementById('volumeSlider');
            if (volumeSlider) {
                volumeSlider.style.width = '80px';
            }
        }
        
        // Bekleme ekranını mobil için optimize et
        const waitingScreen = document.getElementById('waitingScreen');
        if (waitingScreen) {
            waitingScreen.style.padding = '15px';
            
            // Paylaşım butonunu mobil için optimize et
            const shareButton = waitingScreen.querySelector('button');
            if (shareButton) {
                shareButton.style.padding = '10px 20px';
            }
        }
        
        // Kullanıcı listesini mobil için optimize et
        const usersContainer = document.getElementById('usersContainer');
        if (usersContainer) {
            usersContainer.style.padding = '8px';
        }
        
        // Sohbet alanını mobil için optimize et
        const chatContainer = document.getElementById('chatContainer');
        if (chatContainer) {
            chatContainer.style.padding = '8px';
            
            // Mesaj giriş alanını mobil için optimize et
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
                messageInput.style.padding = '10px';
                
                // Mobil klavye açıldığında form pozisyonunu düzelt
                messageInput.addEventListener('focus', () => {
                    if (isTheaterMode) {
                        // Tiyatro modunda klavye açıldığında form'u yukarı kaydır
                        const chatForm = document.getElementById('chatForm');
                        if (chatForm) {
                            chatForm.style.position = 'fixed';
                            chatForm.style.bottom = '0';
                            
                            // Mesajları en alta kaydır
                            setTimeout(() => {
                                scrollChatToBottom();
                            }, 300);
                        }
                    }
                });
                
                // Klavye kapandığında form pozisyonunu düzelt
                messageInput.addEventListener('blur', () => {
                    if (isTheaterMode) {
                        // Kısa bir gecikme ile mesajları en alta kaydır
                        setTimeout(() => {
                            scrollChatToBottom();
                        }, 300);
                    }
                });
            }
        }
    }
}

// Mobil için dokunmatik kontroller
function setupTouchControls() {
    if (isMobile) {
        debug('Mobil dokunmatik kontroller ayarlanıyor...');
        
        const mediaArea = document.querySelector('.media-area');
        if (mediaArea) {
            let touchStartX = 0;
            let touchStartY = 0;
            let touchEndX = 0;
            let touchEndY = 0;
            
            // Dokunma başlangıcı
            mediaArea.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            });
            
            // Dokunma bitişi
            mediaArea.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].clientX;
                touchEndY = e.changedTouches[0].clientY;
                
                // Yatay kaydırma (ses kontrolü)
                const diffX = touchEndX - touchStartX;
                if (Math.abs(diffX) > 50) {
                    const volumeSlider = document.getElementById('volumeSlider');
                    if (volumeSlider) {
                        const currentVolume = parseInt(volumeSlider.value);
                        const newVolume = Math.max(0, Math.min(100, currentVolume + (diffX > 0 ? 10 : -10)));
                        volumeSlider.value = newVolume;
                        volumeSlider.dispatchEvent(new Event('input'));
                    }
                }
                
                // Dikey kaydırma (parlaklık kontrolü)
                const diffY = touchEndY - touchStartY;
                if (Math.abs(diffY) > 50) {
                    const video = document.getElementById('screenDisplay');
                    if (video) {
                        const currentBrightness = parseFloat(video.style.filter.replace('brightness(', '').replace(')', '')) || 1;
                        const newBrightness = Math.max(0.5, Math.min(1.5, currentBrightness + (diffY > 0 ? -0.1 : 0.1)));
                        video.style.filter = `brightness(${newBrightness})`;
                    }
                }
                
                // Tek dokunuş (kontrolleri göster/gizle)
                if (Math.abs(diffX) < 10 && Math.abs(diffY) < 10) {
                    const videoControls = document.querySelector('.video-controls');
                    if (videoControls) {
                        videoControls.style.opacity = videoControls.style.opacity === '1' ? '0' : '1';
                    }
                }
            });
        }
    }
}

// Mobil için performans optimizasyonları
function optimizeForMobile() {
    if (isMobile) {
        debug('Mobil performans optimizasyonları yapılıyor...');
        
        // Video kalitesini mobil için optimize et
        const video = document.getElementById('screenDisplay');
        if (video) {
            // Daha düşük çözünürlük ve bit hızı
            video.setAttribute('playsinline', '');
            video.setAttribute('x5-video-player-type', 'h5');
            video.setAttribute('x5-video-player-fullscreen', 'true');
            video.setAttribute('x5-video-orientation', 'portraint');
            
            // Video yüklendiğinde
            video.addEventListener('loadedmetadata', () => {
                // Mobil için daha düşük çözünürlük
                if (video.videoWidth > 1280) {
                    video.style.width = '100%';
                    video.style.height = 'auto';
                }
            });
        }
        
        // Bellek kullanımını optimize et
        window.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Sayfa gizlendiğinde video akışını durdur
                if (video && video.srcObject) {
                    video.srcObject.getTracks().forEach(track => track.enabled = false);
                }
            } else {
                // Sayfa görünür olduğunda video akışını başlat
                if (video && video.srcObject) {
                    video.srcObject.getTracks().forEach(track => track.enabled = true);
                }
            }
        });
    }
}

// Initialize the room
function initRoom() {
    debug('Oda başlatılıyor...');
    
    // Get room ID from URL
    roomId = getUrlParameter('room');
    if (!roomId) {
        debug('Oda ID bulunamadı, ana sayfaya yönlendiriliyor');
        window.location.href = '/';
        return;
    }
    
    debug(`Oda ID: ${roomId}`);
    roomIdDisplay.textContent = roomId;
    
    // Kullanıcı adını local storage'dan al ve doğrula
    const storedUsername = localStorage.getItem('watchtug_username');
    if (storedUsername) {
        const validation = validateUsername(storedUsername);
        if (validation.isValid) {
            username = validation.sanitizedValue;
        } else {
            // Eğer geçersizse localStorage'dan sil ve varsayılan değeri kullan
            localStorage.removeItem('watchtug_username');
            username = 'Misafir';
        }
    } else {
        username = 'Misafir';
    }
    
    debug(`Kullanıcı adı: ${username}`);
    
    // Mobil optimizasyonları
    setupMobileUI();
    setupTouchControls();
    optimizeForMobile();
    
    // Video kontrollerini başlat
    initVideoControls();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup socket events
    setupSocketEvents();

    // Setup performance monitor
    setupPerformanceMonitor();
    
    // Odaya katıl
    joinRoom();
}

// Kullanıcı adı modalini göster
function showUsernameModal() {
    usernameModal.style.display = 'flex';
    modalUsername.focus();
    
    // Modal içindeki katıl butonuna click event ekle
    joinWithUsername.addEventListener('click', handleUsernameSubmit);
    
    // Enter tuşuna basıldığında da submit et
    modalUsername.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUsernameSubmit();
        }
    });
}

// Kullanıcı adı gönderildiğinde
function handleUsernameSubmit() {
    const inputUsername = modalUsername.value;
    const validation = validateUsername(inputUsername);
    
    if (!validation.isValid) {
        usernameError.textContent = validation.message;
        usernameError.classList.remove('hidden');
        modalUsername.classList.add('border-red-500');
        return;
    }
    
    // Geçerli kullanıcı adını kaydet
    username = validation.sanitizedValue;
    localStorage.setItem('watchtug_username', username);
    
    // Modalı kapat
    usernameModal.style.display = 'none';
    
    // Odaya başla
    debug(`Kullanıcı adı ayarlandı: ${username}`);
    startRoom();
}

// Oda kurulumunu başlat - Modal sonrası çağrılır
function startRoom() {
    debug(`Oda kurulumu başlatılıyor. Kullanıcı: ${username}, Oda: ${roomId}`);
    
    // Mobil optimizasyonları
    setupMobileUI();
    setupTouchControls();
    optimizeForMobile();
    
    // Video kontrollerini başlat
    initVideoControls();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup socket events
    setupSocketEvents();

    // Setup performance monitor
    setupPerformanceMonitor();
    
    // Join room
    joinRoom();
}

// Sayfa tamamen yüklendiğinde
window.addEventListener('load', () => {
    debug('Sayfa tamamen yüklendi, yeniden bağlantı kontrolü yapılıyor...');
    
    // URL parametrelerini kontrol et
    const autoReconnect = getUrlParameter('reconnect') === 'true';
    
    // Yenileme sonrası özel yeniden bağlanma mantığı
    if (document.referrer.includes(window.location.hostname) || autoReconnect) {
        debug('Sayfa yenilemesi algılandı, özel yeniden bağlanma başlatılıyor...');
        
        // Mevcut bağlantıları tamamen temizle
        cleanupCurrentConnection();
        
        // Tüm peer bağlantılarını kapat
        Object.keys(peerConnections).forEach(peerId => {
            cleanupPeerConnection(peerId);
        });
        
        // Video elementini temizle
        if (screenDisplay && screenDisplay.srcObject) {
            const tracks = screenDisplay.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            screenDisplay.srcObject = null;
        }
        
        // Daha hızlı yeniden bağlanma için hazırlık
        setTimeout(() => {
            if (socket && socket.connected) {
                debug('Sunucuya yeniden bağlanılıyor...');
                
                // Önce odaya yeniden katıl
                socket.emit('join-room', roomId);
                
                // Aktif yayınları kontrol et ve bağlantıyı kur
                socket.emit('check-active-streams', { roomId }, (response) => {
                    if (response && response.sharer) {
                        debug(`Aktif yayın tespit edildi: ${response.sharer}. Bağlantı kuruluyor...`);
                        currentSharer = response.sharer;
                        
                        // Doğrudan yayıncıya ready sinyali gönder
                        socket.emit('ready', { 
                            roomId: roomId,
                            from: socketId,
                            to: currentSharer 
                        });
                        
                        // waitingScreen'i gizle, yayın bağlantısı kurulacak
                        waitingScreen.classList.add('hidden');
                        
                        // 2 saniye sonra video bağlantısını yenile
                        setTimeout(refreshVideoConnection, 2000);
                        }
                    });
            } else {
                debug('Halen bağlantı kurulmamış, yeniden deneniyor...');
                if (socket && typeof socket.connect === 'function') {
                    socket.connect();
                    
                    // Bağlantı kurulduktan sonra odaya katıl
                    socket.once('connect', () => {
                        socket.emit('join-room', roomId);
                    });
                }
            }
        }, 500); // Daha hızlı tepki için süreyi azalttım
    }
});

// Sayfanın görünürlük durumu değiştiğinde (sekme değişimi, sayfa yenileme, vb.)
function handleVisibilityChange() {
    debug('Sayfa görünürlüğü değişti. Gizli:', document.hidden);
    
    if (!document.hidden) {
        debug('Sayfa tekrar görünür hale geldi, bağlantı durumu kontrol ediliyor...');
        
        if (!isConnectedToServer) {
            debug('Sunucu bağlantısı yok. Yeniden bağlanılıyor...');
            reconnectToRoom();
        } else if (currentSharer && screenDisplay && (!screenDisplay.srcObject || !screenDisplay.srcObject.active)) {
            debug('Bağlantı var ama video akışı yok, yeniden bağlanma sinyali gönderiliyor...');
            waitingScreen.classList.remove('hidden');
            
            // Şimdiki bağlantıyı temizle
            cleanupCurrentConnection();
            
            // Yeniden bağlanma sinyali gönder
            setTimeout(() => {
                socket.emit('ready', roomId);
            }, 1000);
        }
    }
}

// İnternet bağlantısı değiştiğinde
function handleConnectionChange() {
    if (navigator.onLine && !isConnectedToServer) {
        debug('İnternet bağlantısı algılandı. Yeniden bağlanılıyor...');
        reconnectToRoom();
    }
}

// Bağlantı durumunu düzenli olarak kontrol et
function checkConnectionStatus() {
    if (navigator.onLine && screenDisplay) {
        // Sunucuya bağlı değilsek
        if (!isConnectedToServer) {
            debug('Sunucu bağlantısı kopuk durumda. Yeniden bağlanmaya çalışılıyor...');
            reconnectToRoom();
            return;
        }
        
        // Sunucuya bağlı, video ekranında paylaşılan içerik olması gerekirken yok
        if (currentSharer && (!screenDisplay.srcObject || !screenDisplay.srcObject.active)) {
            debug('Video akışı yok veya kesintiye uğradı ama paylaşım devam ediyor, yeniden hazır sinyali gönderiliyor...');
            waitingScreen.classList.remove('hidden');
            
            // Şimdiki bağlantıyı temizle
            cleanupCurrentConnection();
            
            // Yeniden bağlanma sinyali gönder
            setTimeout(() => {
                socket.emit('ready', roomId);
            }, 1000);
        }
    }
}

// Odaya yeniden bağlanma işlevi
function reconnectToRoom() {
    if (!roomId) {
        debug('Yeniden bağlanmak için oda ID bulunamadı!');
        return;
    }
    
    // Daha önce başarısız bir yeniden bağlanma var mı?
    const failedCount = parseInt(localStorage.getItem('reconnect_failed_count') || '0');
    
    if (failedCount > 5) {
        debug('Çok fazla başarısız yeniden bağlanma denemesi, sayfa yenileniyor...');
        localStorage.setItem('reconnect_failed_count', '0');
        
        // Sayfa yenileme parametresi ekleyerek yenile
        window.location.href = window.location.pathname + 
                              window.location.search.replace(/[\?&]reconnect=true/, '') + 
                              (window.location.search ? '&' : '?') + 'reconnect=true';
        return;
    }
    
    // İlk önce mevcut bağlantıları temizle
    cleanupCurrentConnection();
    
    if (socket.connected) {
        debug('Socket bağlantısı zaten var, odaya yeniden katılınıyor...');
        joinRoom();
    } else {
        debug('Socket bağlantısı yok, yeniden bağlanılıyor...');
        // Socket.io otomatik olarak yeniden bağlanmayı deneyecek
        socket.connect();
        
        // 5 saniye sonra hala bağlantı yoksa
        setTimeout(() => {
            if (!isConnectedToServer) {
                debug('5 saniye sonra hala bağlantı yok, başarısız sayacı artırılıyor...');
                localStorage.setItem('reconnect_failed_count', (failedCount + 1).toString());
            } else {
                // Başarılı bağlantıda sayacı sıfırla
                localStorage.setItem('reconnect_failed_count', '0');
            }
        }, 5000);
    }
    
    // Ekran görüntüsünü temizle ve "Bağlanılıyor..." ekranını göster
    if (screenDisplay) {
        screenDisplay.srcObject = null;
    }
    
    // Bağlantı ekranlarını güncelle
    if (waitingScreen) waitingScreen.classList.remove('hidden');
    if (connectingScreen) connectingScreen.classList.add('hidden');
    if (noPermissionScreen) noPermissionScreen.classList.add('hidden');
}

// Setup UI event listeners
function setupEventListeners() {
    // Share screen button
    shareScreenBtn.addEventListener('click', () => {
        if (!isConnectedToServer) {
            showToast('Sunucu bağlantısı kurulmadan ekran paylaşılamaz');
            return;
        }
        initializeCall();
    });
    
    // Stop sharing button
    stopSharingBtn.addEventListener('click', () => {
        stopSharing();
    });
    
    // Try again button
    tryAgainBtn.addEventListener('click', () => {
        noPermissionScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
    });
    
    // Leave room button
    leaveRoomBtn.addEventListener('click', () => {
        // Stop sharing if active
        if (isScreenSharing) {
            stopSharing();
        }
        
        // Navigate to home page
        window.location.href = '/';
    });
    
    // Copy room ID button
    copyRoomId.addEventListener('click', () => {
        navigator.clipboard.writeText(roomId)
            .then(() => {
                showToast('Oda ID kopyalandı!');
            })
            .catch(err => {
                console.error('Kopyalama işlemi başarısız:', err);
                // Fallback for browsers that don't support clipboard API
                const textArea = document.createElement('textarea');
                textArea.value = roomId;
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    showToast('Oda ID kopyalandı!');
                } catch (err) {
                    showToast('Kopyalama işlemi başarısız. Kendiniz seçip kopyalayın.');
                }
                
                document.body.removeChild(textArea);
            });
    });
    
    // Ses kontrolleri
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            if (screenDisplay.srcObject) {
                screenDisplay.volume = this.value / 100;
                
                // Ses açık/kapalı ikonunu güncelle
                if (this.value > 0) {
                    isMuted = false;
                    muteBtn.querySelector('i').className = 'fas fa-volume-up';
                } else {
                    isMuted = true;
                    muteBtn.querySelector('i').className = 'fas fa-volume-mute';
                }
            }
        });
    }
    
    // Sessiz butonu
    if (muteBtn) {
        muteBtn.addEventListener('click', function() {
            if (screenDisplay.srcObject) {
                if (isMuted) {
                    // Sesi geri aç
                    screenDisplay.volume = volumeSlider.value / 100;
                    muteBtn.querySelector('i').className = 'fas fa-volume-up';
                    isMuted = false;
                } else {
                    // Sesi kapat
                    screenDisplay.volume = 0;
                    muteBtn.querySelector('i').className = 'fas fa-volume-mute';
                    isMuted = true;
                }
            }
        });
    }
    
    // Tiyatro modu
    if (theaterModeBtn) {
        theaterModeBtn.addEventListener('click', function() {
            const mainContainer = document.getElementById('mainContainer');
            const videoContainer = document.getElementById('videoContainer');
            const chatContainer = document.getElementById('chatContainer');
            
            if (isTheaterMode) {
                // Normal moda dön
                mainContainer.classList.remove('theater-layout');
                videoContainer.classList.remove('theater-video');
                chatContainer.classList.remove('theater-chat');
                isTheaterMode = false;
                
                theaterModeBtn.querySelector('i').className = 'fas fa-film';
                
                // Normal moda döndüğünde chat mesajlarını en alta kaydır
                setTimeout(() => {
                    scrollChatToBottom();
                }, 100);
            } else {
                // Tiyatro moduna geç
                mainContainer.classList.add('theater-layout');
                videoContainer.classList.add('theater-video');
                chatContainer.classList.add('theater-chat');
                isTheaterMode = true;
                
                // Eğer tam ekran modundaysa fullscreen sınıfını ekle
                if (isFullscreen) {
                    mainContainer.classList.add('fullscreen');
                }
                
                theaterModeBtn.querySelector('i').className = 'fas fa-compress';
                
                // Tiyatro moduna geçtiğinde chat mesajlarını en alta kaydır
                // Mobil cihazlarda birkaç kez deneme yaparak
                if (isMobile) {
                    // İlk deneme
                    setTimeout(() => {
                        scrollChatToBottom();
                        
                        // İkinci deneme
                        setTimeout(() => {
                            scrollChatToBottom();
                            
                            // Üçüncü deneme
                            setTimeout(() => {
                                scrollChatToBottom();
                            }, 200);
                        }, 100);
                    }, 100);
                } else {
                    // Masaüstü için normal kaydırma
                    setTimeout(() => {
                        scrollChatToBottom();
                    }, 100);
                }
            }
        });
    }
    
    // Tam ekran
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', function() {
            const mediaArea = document.querySelector('.media-area');
            
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(err => {
                    debug('Tam ekrandan çıkma hatası:', err);
                });
                fullscreenBtn.querySelector('i').className = 'fas fa-expand';
            } else {
                mediaArea.requestFullscreen().catch(err => {
                    debug('Tam ekran hatası:', err);
                    showToast(`Tam ekran hatası: ${err.message}`);
                });
                fullscreenBtn.querySelector('i').className = 'fas fa-compress';
            }
        });
    }
    
    // Klavye kısayolları
    document.addEventListener('keydown', function(e) {
        // Odaklanmış bir input veya textarea varsa kısayolları devre dışı bırak
        if (document.activeElement.tagName === 'INPUT' || 
            document.activeElement.tagName === 'TEXTAREA') {
            return;
        }
        
        if (e.key === 'm' || e.key === 'M') {
            // M tuşu - Sessiz/sesli geçiş
            muteBtn.click();
        } else if (e.key === 't' || e.key === 'T') {
            // T tuşu - Tiyatro modu
            theaterModeBtn.click();
        } else if (e.key === 'f' || e.key === 'F') {
            // F tuşu - Tam ekran
            fullscreenBtn.click();
        }
    });
    
    // Tam ekran durumu değiştiğinde ikonu güncelle
    document.addEventListener('fullscreenchange', function() {
        isFullscreen = !!document.fullscreenElement;
        if (isFullscreen) {
            fullscreenBtn.querySelector('i').className = 'fas fa-compress';
            // Tam ekran modunda tiyatro düzenine fullscreen sınıfı ekle
            const mainContainer = document.getElementById('mainContainer');
            if (mainContainer.classList.contains('theater-layout')) {
                mainContainer.classList.add('fullscreen');
            }
        } else {
            fullscreenBtn.querySelector('i').className = 'fas fa-expand';
            // Tam ekran modundan çıkınca fullscreen sınıfını kaldır
            const mainContainer = document.getElementById('mainContainer');
            mainContainer.classList.remove('fullscreen');
        }
    });
    
    // Chat form submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (message) {
            sendChatMessage(message);
            messageInput.value = '';
        }
    });
    
    // Close toast
    closeToast.addEventListener('click', hideToast);
}

// Odaya katılma işlevi
function joinRoom() {
    debug(`Odaya katılınıyor... Oda: ${roomId}, Kullanıcı: ${username}`);
    
    // Sunucuya kullanıcı adını gönder ve doğrulama sonrası odaya katıl
    socket.emit('set-username', username);
    
    // Odaya katılma isteğini doğrulama sonrası gönderecek şekilde güncelle
    // Doğrulama sonucu socket.on('username-validated') event handler'ında işlenecek
    setTimeout(() => {
    socket.emit('join-room', roomId);
    }, 300); // Küçük bir gecikme ekleyerek doğrulama işleminin tamamlanmasını bekle
    
    // Socket disconnect sonrası yeniden bağlanmada kullanılmak üzere son bilgileri sakla
    hasJoinedBefore = true;
}

// Modern uyarı sistemi
function showSpamWarning() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'spamWarning';
    warningDiv.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-500/90 text-white p-6 rounded-lg shadow-xl z-50 flex flex-col items-center justify-center space-y-4';
    warningDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle text-4xl"></i>
        <h3 class="text-xl font-bold">Spam Tespit Edildi!</h3>
        <p class="text-center">Lütfen biraz sakin olun. ${SPAM_COOLDOWN/1000} saniye boyunca mesaj gönderemezsiniz.</p>
        <div class="w-full bg-white/20 rounded-full h-2">
            <div id="spamTimer" class="bg-white h-2 rounded-full transition-all duration-1000" style="width: 100%"></div>
        </div>
    `;
    document.body.appendChild(warningDiv);

    // Timer animasyonu
    let timeLeft = SPAM_COOLDOWN;
    const timerInterval = setInterval(() => {
        timeLeft -= 1000;
        const percentage = (timeLeft / SPAM_COOLDOWN) * 100;
        document.getElementById('spamTimer').style.width = `${percentage}%`;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            warningDiv.remove();
            isSpamBlocked = false;
            messageCount = 0;
            showToast('Artık mesaj gönderebilirsiniz!', 2000);
        }
    }, 1000);
}

// Chat mesajı gönderme fonksiyonu
function sendChatMessage(message) {
    const now = Date.now();
    
    // Spam kontrolü
    if (isSpamBlocked) {
        showToast('Lütfen bekleyin, spam koruması aktif!', 2000);
        return;
    }
    
    // Mesaj sayısı ve zaman kontrolü
    if (now - lastMessageTime < MESSAGE_WINDOW) {
        messageCount++;
        if (messageCount >= MAX_MESSAGES) {
            isSpamBlocked = true;
            showSpamWarning();
            if (spamTimeout) clearTimeout(spamTimeout);
            spamTimeout = setTimeout(() => {
                isSpamBlocked = false;
                messageCount = 0;
            }, SPAM_COOLDOWN);
            return;
        }
    } else {
        messageCount = 1;
    }
    
    lastMessageTime = now;
    
    // Mesajı sunucuya gönder
    socket.emit('chat-message', {
        roomId: roomId,
        message: message,
        user: username
    });
    
    // Mesajı yerel olarak chat listesine ekle
    addChatMessage({
        id: Date.now(),
        user: username,
        message: message,
        timestamp: new Date(),
        isSystem: false
    });
    
    // Her zaman mesajları aşağı kaydır
    scrollChatToBottom();
    
    // Mobil cihazlarda ekstra kaydırma
    if (isMobile) {
        setTimeout(() => {
            scrollChatToBottom();
        }, 100);
        
        // Tiyatro modunda ikinci bir kaydırma daha
        if (isTheaterMode) {
            setTimeout(() => {
                scrollChatToBottom();
            }, 300);
        }
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initRoom); 

// Check for active streams in the room
function checkForActiveStreams() {
    if (roomId && socket && socket.connected) {
        socket.emit('check-active-streams', { roomId }, (response) => {
            if (response && response.sharer && response.sharer !== currentSharer) {
                debug(`Aktif yayın tespit edildi: ${response.sharer}. Bağlantı kuruluyor...`);
                currentSharer = response.sharer;
                
                // Connect to the stream if not already connected
                if (!peerConnections[currentSharer]) {
                    socket.emit('ready', { 
                        roomId: roomId,
                        from: socketId,
                        to: currentSharer 
                    });
                    
                    // Update UI to show who is sharing
                    const userElement = document.getElementById(`user-${currentSharer}`);
                    if (userElement) {
                        userElement.classList.add('sharing');
                        
                        // Add sharing icon if not already there
                        if (!userElement.querySelector('.fa-desktop')) {
                            const sharingIcon = document.createElement('i');
                            sharingIcon.className = 'fas fa-desktop ml-2 text-primary-400';
                            userElement.appendChild(sharingIcon);
                        }
                        
                        // Show notification
                        const sharingUsername = userElement.querySelector('div:not(.user-avatar)').textContent.replace('(ben)', '').trim();
                        showToast(`${sharingUsername} ekran paylaşımına bağlanılıyor...`, 3000);
                    }
                }
            }
            
            // Sayfa yenilemesinden sonra video akışı varsa waitingScreen'i gizle
            if (screenDisplay && screenDisplay.srcObject && screenDisplay.srcObject.active) {
                waitingScreen.classList.add('hidden');
            }
        });
    }
}

// Clean up resources when leaving the page
window.addEventListener('beforeunload', () => {
    // Clear intervals
    if (activeStreamCheckInterval) {
        clearInterval(activeStreamCheckInterval);
    }
    
    // ... existing code if any ...
}); 

// Sayfa yenilendiğinde video akışının doğru şekilde görüntülenmesini sağla
window.addEventListener('pageshow', (event) => {
    // bfcache üzerinden geri dönüş durumunu kontrol et
    if (event.persisted) {
        debug('Sayfa bfcache üzerinden geri yüklendi, bağlantıları yeniliyorum...');
        
        // Tüm bağlantıları temizle
        cleanupCurrentConnection();
        
        // Odaya yeniden katıl
        if (socket && socket.connected && roomId) {
            socket.emit('join-room', roomId);
            
            // Aktif yayınları kontrol et
            socket.emit('check-active-streams', { roomId }, (response) => {
                if (response && response.sharer) {
                    currentSharer = response.sharer;
                    socket.emit('ready', { 
                        roomId: roomId,
                        from: socketId,
                        to: currentSharer 
                    });
                }
            });
        }
    }
}); 

// Video bağlantısını yenile
function refreshVideoConnection() {
    debug('Video bağlantısı yenileniyor...');
    
    // Eğer aktif bir yayıncı yoksa işlem yapma
    if (!currentSharer) {
        debug('Aktif yayıncı yok, işlem yapılmıyor');
        return;
    }
    
    // Mevcut video bağlantısını temizle ama track'leri durdurma
    if (peerConnections[currentSharer]) {
        debug(`Mevcut peer bağlantısı kapatılıyor: ${currentSharer}`);
        peerConnections[currentSharer].close();
        delete peerConnections[currentSharer];
    }
    
    // Yeni bir bağlantı oluştur
    debug(`Yayıncı ile yeni bağlantı kuruluyor: ${currentSharer}`);
    socket.emit('ready', { 
        roomId: roomId,
        from: socketId,
        to: currentSharer 
    });
    
    // waitingScreen'i göster, yeni bağlantı kurulana kadar
    waitingScreen.classList.remove('hidden');
    
    // 5 saniye içinde bağlantı kurulmazsa tekrar dene
    setTimeout(() => {
        if (waitingScreen.classList.contains('hidden') === false) {
            debug('Bağlantı kurulamadı, tekrar deneniyor...');
            socket.emit('ready', { 
                roomId: roomId,
                from: socketId,
                to: currentSharer 
            });
        }
    }, 5000);
} 