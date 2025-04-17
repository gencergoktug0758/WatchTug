// WatchTug V2 - Main JavaScript

// DOM Elements - Farklı ID'ler kullanılıyor olabilir, html dosyasına göre düzeltildi
const usernameInput = document.getElementById('username');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const customRoomId = document.getElementById('customRoomId');
const roomIdToJoin = document.getElementById('roomIdToJoin');
const createRoomTab = document.getElementById('createRoomTab');
const joinRoomTab = document.getElementById('joinRoomTab');
const createRoomPanel = document.getElementById('createRoomPanel');
const joinRoomPanel = document.getElementById('joinRoomPanel');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const closeToast = document.getElementById('closeToast');

// Socket.io bağlantısı
const socket = io(window.location.origin);

// Küfür ve uygunsuz kelime kontrolü
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
function validateInput(input, type = 'username') {
    const sanitizedInput = sanitizeInput(input);
    
    if (!sanitizedInput) {
        return {
            isValid: false,
            message: type === 'username' ? 'Lütfen bir kullanıcı adı girin' : 'Lütfen bir oda ID\'si girin'
        };
    }

    if (containsBlockedWords(sanitizedInput)) {
        return {
            isValid: false,
            message: `${type === 'username' ? 'Kullanıcı adında' : 'Oda ID\'sinde'} uygunsuz kelimeler bulunamaz`
        };
    }

    if (type === 'roomId' && sanitizedInput.length < 3) {
        return {
            isValid: false,
            message: 'Oda ID en az 3 karakter olmalıdır'
        };
    }

    return {
        isValid: true,
        sanitizedValue: sanitizedInput
    };
}

// Debug fonksiyonu
function debug(...args) {
    console.log('[WatchTug Ana Sayfa]', ...args);
}

// Rastgele oda ID'si oluştur 
function generateRandomId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Toast bildirimini göster
function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.classList.add('toast-slide-in');
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    
    setTimeout(() => {
        hideToast();
    }, duration);
}

// Toast bildirimini gizle
function hideToast() {
    toast.classList.add('toast-slide-out');
    setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
        toast.classList.remove('toast-slide-in');
        toast.classList.remove('toast-slide-out');
    }, 300);
}

// Loading screen functionality
function showLoadingScreen(isCreating = true) {
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingMessage = document.getElementById('loadingMessage');
    
    loadingMessage.textContent = isCreating ? 'Oda Oluşturuluyor...' : 'Odaya Katılınıyor...';
    loadingScreen.classList.remove('hidden');
    loadingScreen.classList.add('flex');
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.add('hidden');
    loadingScreen.classList.remove('flex');
}

// VPN Detection için gelişmiş ve çok faktörlü analiz
async function detectVPN() {
    try {
        // Sonuçları saklamak için obje
        const vpnScores = {
            multiplePublicIPs: 0,
            rtcDelayAnomaly: 0,
            knownVpnPorts: 0,
            dnsLeakCheck: 0,
            locationMismatch: 0,
            totalScore: 0,
            threshold: 65, // %65 ve üzeri VPN olarak değerlendirilir
            confidenceLevel: 0
        };
        
        // 1. WebRTC analizi
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        });

        pc.createDataChannel('');

        // Zaman ölçümü başlat
        const rtcStartTime = performance.now();
        
        // Create offer ve yerel tanımlama ayarla
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        let publicIPs = new Set();
        let privateIPs = new Set();
        let candidateTypeCounts = {
            host: 0,
            srflx: 0,
            prflx: 0,
            relay: 0
        };
        
        // Toplam STUN yanıt sürelerini ölçme
        let responseCount = 0;
        let totalResponseTime = 0;

        return new Promise((resolve) => {
            // 10 saniye timeout - sonuç alınamazsa
            const timeoutId = setTimeout(() => {
                pc.close();
                
                // Zaman aşımında orta seviye güven ile sonuç döndür
                vpnScores.totalScore = 40;
                vpnScores.confidenceLevel = 50;
                
                const isVpn = vpnScores.totalScore >= vpnScores.threshold;
                resolve({ 
                    vpnDetected: isVpn, 
                    scores: vpnScores,
                    confidence: vpnScores.confidenceLevel
                });
                
            }, 10000);
            
            // IP adreslerini topla
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    responseCount++;
                    const currentTime = performance.now();
                    totalResponseTime += (currentTime - rtcStartTime);
                    
                    // Aday türünü say
                    const candidateTypeMatch = /typ ([a-z]+)/.exec(event.candidate.candidate);
                    if (candidateTypeMatch && candidateTypeMatch[1]) {
                        candidateTypeCounts[candidateTypeMatch[1]]++;
                    }
                    
                    // IP adresini izole et
                    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                    const ipMatch = ipRegex.exec(event.candidate.candidate);
                    
                    if (ipMatch) {
                        const ip = ipMatch[1];
                        
                        // Port tespiti (VPN'ler genellikle belli portlar kullanır)
                        const portRegex = / ([0-9]{2,5}) /;
                        const portMatch = portRegex.exec(event.candidate.candidate);
                        
                        if (portMatch) {
                            const port = parseInt(portMatch[1]);
                            // VPN'lerin sıklıkla kullandığı portları kontrol et
                            const vpnCommonPorts = [500, 1194, 1701, 1723, 4500, 8080, 443, 80];
                            if (vpnCommonPorts.includes(port)) {
                                vpnScores.knownVpnPorts += 15;
                            }
                        }
                        
                        // IP türünü belirle (özel veya genel)
                        if (ip.startsWith('10.') || 
                            ip.startsWith('192.168.') || 
                            (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31) ||
                            ip.startsWith('169.254.') || 
                            ip.startsWith('127.')) {
                            privateIPs.add(ip);
                        } else {
                            publicIPs.add(ip);
                        }
                    }
                } else {
                    // Tüm adaylar toplandı, analiz et
                    clearTimeout(timeoutId);
                    pc.close();
                    
                    // 1. Birden çok Public IP puanlaması
                    if (publicIPs.size > 1) {
                        vpnScores.multiplePublicIPs = 40;
                    } else if (publicIPs.size == 1 && privateIPs.size == 0) {
                        // Sadece 1 public IP ve hiç private IP olmaması genelde VPN göstergesidir
                        vpnScores.multiplePublicIPs = 30;
                    }
                    
                    // 2. Yanıt süresi anomali tespiti
                    if (responseCount > 0) {
                        const avgResponseTime = totalResponseTime / responseCount;
                        // Yüksek yanıt süresi genellikle bir VPN göstergesidir
                        if (avgResponseTime > 500) {
                            vpnScores.rtcDelayAnomaly = 20;
                        } else if (avgResponseTime > 250) {
                            vpnScores.rtcDelayAnomaly = 10;
                        }
                    }
                    
                    // 3. STUN aday tür dağılımı analizi
                    // VPN kullanımında genellikle "relay" türü adaylar daha fazla olur
                    if (candidateTypeCounts.relay > candidateTypeCounts.srflx) {
                        vpnScores.dnsLeakCheck += 15;
                    }
                    
                    // 4. Konum tutarlılık kontrolü 
                    try {
                        // Tarayıcının zaman dilimini kontrol et
                        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        
                        // Tarayıcı dilini kontrol et
                        const browserLanguage = navigator.language || navigator.userLanguage;
                        
                        // IP tabanlı konum bilgisi için hızlı bir kontrol
                        // Gerçek uygulamada bu kısım için API kullanmanız daha doğru olacaktır
                        if (browserTimezone.includes('US') && browserLanguage.startsWith('tr')) {
                            vpnScores.locationMismatch += 25;
                        }
                    } catch (e) {
                        console.log('Konum kontrolü hatası:', e);
                    }
                    
                    // Toplam puanı hesapla
                    vpnScores.totalScore = 
                        vpnScores.multiplePublicIPs + 
                        vpnScores.rtcDelayAnomaly + 
                        vpnScores.knownVpnPorts + 
                        vpnScores.dnsLeakCheck + 
                        vpnScores.locationMismatch;
                    
                    // Güven seviyesi - ne kadar veri toplanabildi?
                    vpnScores.confidenceLevel = Math.min(100, 
                        40 + // baz güven 
                        (responseCount * 5) + // toplanan yanıt sayısı
                        (publicIPs.size > 0 ? 20 : 0) + // en az bir IP elde edildi mi
                        (privateIPs.size > 0 ? 10 : 0) // en az bir özel IP elde edildi mi
                    );
                    
                    // Debug için puanlamayı yazdır
                    console.log('VPN Tespit Puanları:', vpnScores);
                    console.log('Public IPs:', [...publicIPs]);
                    console.log('Private IPs:', [...privateIPs]);
                    console.log('Candidate Types:', candidateTypeCounts);
                    
                    // Sonucu belirle
                    const isVpn = vpnScores.totalScore >= vpnScores.threshold;
                    
                    // VPN tespit edilirse uyarı göster
                    if (isVpn && vpnScores.confidenceLevel >= 70) {
                        // Yüksek güvenle VPN tespit edildi
                        showVpnAlert('yuksek');
                    } else if (isVpn) {
                        // Düşük güvenle VPN tespit edildi
                        showVpnAlert('dusuk');
                    }
                    
                    resolve({ 
                        vpnDetected: isVpn, 
                        scores: vpnScores,
                        confidence: vpnScores.confidenceLevel
                    });
                }
            };
        });

    } catch (err) {
        console.error('VPN detection error:', err);
        return { vpnDetected: false, scores: {}, confidence: 0 };
    }
}

// VPN Alert functionality - geliştirilmiş versiyon
function showVpnAlert(guvenSeviyesi = 'normal') {
    vpnAlert.classList.remove('translate-x-full', 'opacity-0');
    vpnAlertDesktop.classList.remove('translate-x-full', 'opacity-0');
    vpnAlert.classList.add('opacity-100');
    vpnAlertDesktop.classList.add('opacity-100');
    
    // Güven seviyesine göre mesajı güncelle
    const vpnAlertMessage = document.getElementById('vpnAlertMessage') || document.getElementById('vpnMessage');
    const vpnAlertDesktopMessage = document.getElementById('vpnAlertDesktopMessage') || document.getElementById('vpnMessageDesktop');
    
    let message = '';
    
    if (guvenSeviyesi === 'yuksek') {
        message = 'VPN kullanımı tespit edildi. Bu, ekran paylaşım performansını olumsuz etkileyebilir. Daha iyi bir deneyim için VPN bağlantınızı devre dışı bırakmanızı öneririz.';
    } else if (guvenSeviyesi === 'dusuk') {
        message = 'VPN veya proxy kullanıyor olabilirsiniz. Bu durum ekran paylaşım performansını etkileyebilir.';
    } else {
        message = 'VPN kullanımı tespit edildi. Ekran paylaşım performansını artırmak için VPN bağlantınızı devre dışı bırakabilirsiniz.';
    }
    
    if (vpnAlertMessage) vpnAlertMessage.textContent = message;
    if (vpnAlertDesktopMessage) vpnAlertDesktopMessage.textContent = message;
    
    // 15 saniye sonra otomatik kapat
    setTimeout(hideVpnAlert, 15000);
}

// VPN Alert functionality
const vpnAlert = document.getElementById('vpnAlert');
const vpnAlertDesktop = document.getElementById('vpnAlertDesktop');
const closeVpnAlert = document.getElementById('closeVpnAlert');
const closeVpnAlertDesktop = document.getElementById('closeVpnAlertDesktop');

function hideVpnAlert() {
    vpnAlert.classList.remove('opacity-100');
    vpnAlertDesktop.classList.remove('opacity-100');
    vpnAlert.classList.add('opacity-0');
    vpnAlertDesktop.classList.add('opacity-0');
    vpnAlert.classList.add('translate-x-full');
    vpnAlertDesktop.classList.add('translate-x-full');
}

// Sayfa yüklendiğinde VPN kontrolü yap
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        detectVPN(); // VPN tespitini aktif et
    }, 1000);
});

// Close button event listeners
closeVpnAlert.addEventListener('click', hideVpnAlert);
closeVpnAlertDesktop.addEventListener('click', hideVpnAlert);

// Initialize
function init() {
    debug('Ana sayfa başlatılıyor...');
    
    // Check for username in localStorage
    const savedUsername = localStorage.getItem('watchtug_username');
    if (savedUsername) {
        const validation = validateInput(savedUsername);
        if (validation.isValid) {
            usernameInput.value = validation.sanitizedValue;
            debug('Kaydedilmiş kullanıcı adı yüklendi:', validation.sanitizedValue);
        } else {
            localStorage.removeItem('watchtug_username');
        }
    }

    // Modal event listeners
    const helpModal = document.getElementById('helpModal');
    const aboutModal = document.getElementById('aboutModal');
    const helpButton = document.getElementById('helpButton');
    const aboutButton = document.getElementById('aboutButton');
    const closeHelpModal = document.getElementById('closeHelpModal');
    const closeAboutModal = document.getElementById('closeAboutModal');

    function openModal(modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        // Trigger animation after a small delay to ensure display: flex is applied
        setTimeout(() => {
            modal.classList.add('show');
            modal.querySelector('.modal-content').classList.add('show');
        }, 10);
    }

    function closeModal(modal) {
        modal.classList.remove('show');
        modal.querySelector('.modal-content').classList.remove('show');
        // Wait for animation to finish before hiding
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }, 300);
    }

    // Help Modal
    helpButton.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(helpModal);
    });

    closeHelpModal.addEventListener('click', () => {
        closeModal(helpModal);
    });

    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            closeModal(helpModal);
        }
    });

    // About Modal
    aboutButton.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(aboutModal);
    });

    closeAboutModal.addEventListener('click', () => {
        closeModal(aboutModal);
    });

    aboutModal.addEventListener('click', (e) => {
        if (e.target === aboutModal) {
            closeModal(aboutModal);
        }
    });

    // Tab switching
    createRoomTab.addEventListener('click', () => {
        createRoomTab.classList.add('bg-primary-600', 'text-white');
        createRoomTab.classList.remove('text-gray-300');
        joinRoomTab.classList.remove('bg-primary-600', 'text-white');
        joinRoomTab.classList.add('text-gray-300');
        createRoomPanel.classList.remove('hidden');
        joinRoomPanel.classList.add('hidden');
    });
    
    joinRoomTab.addEventListener('click', () => {
        joinRoomTab.classList.add('bg-primary-600', 'text-white');
        joinRoomTab.classList.remove('text-gray-300');
        createRoomTab.classList.remove('bg-primary-600', 'text-white');
        createRoomTab.classList.add('text-gray-300');
        joinRoomPanel.classList.remove('hidden');
        createRoomPanel.classList.add('hidden');
    });
    
    // Close toast
    closeToast.addEventListener('click', hideToast);
    
    // Create room button
    createRoomBtn.addEventListener('click', handleCreateRoom);
    
    // Join room button
    joinRoomBtn.addEventListener('click', handleJoinRoom);
    
    // Handle enter key in room ID inputs
    customRoomId.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleCreateRoom();
        }
    });
    
    roomIdToJoin.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleJoinRoom();
        }
    });
    
    // Check for socket connection
    socket.on('connect', () => {
        debug('Sunucu bağlantısı kuruldu');
    });
    
    socket.on('disconnect', () => {
        debug('Sunucu bağlantısı kesildi');
        showToast('Sunucu bağlantısı kesildi. Sayfa yenileniyor...');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    });
}

// Room creation handler
function handleCreateRoom() {
    // Validate username
    const usernameValidation = validateInput(usernameInput.value);
    if (!usernameValidation.isValid) {
        showToast(usernameValidation.message);
        usernameInput.value = '';
        return;
    }
    
    const username = usernameValidation.sanitizedValue;
    debug('Kullanıcı adı:', username);
    
    // Save username
    localStorage.setItem('watchtug_username', username);
    
    // Set username on server
    socket.emit('set-username', username);
    
    // Get custom room ID if provided, or generate one
    let roomId = customRoomId.value.trim();
    if (roomId) {
        const roomValidation = validateInput(roomId, 'roomId');
        if (!roomValidation.isValid) {
            showToast(roomValidation.message);
            customRoomId.value = '';
            return;
        }
        roomId = roomValidation.sanitizedValue;
    } else {
        roomId = generateRandomId();
    }
    
    debug('Oda oluşturma isteği gönderiliyor. OdaID:', roomId);
    
    // Show loading screen
    showLoadingScreen(true);
    
    // Create room
    socket.emit('create-room', roomId);
}

// Join room handler
function handleJoinRoom() {
    // Validate username
    const usernameValidation = validateInput(usernameInput.value);
    if (!usernameValidation.isValid) {
        showToast(usernameValidation.message);
        usernameInput.value = '';
        return;
    }
    
    const username = usernameValidation.sanitizedValue;
    debug('Kullanıcı adı:', username);
    
    // Save username
    localStorage.setItem('watchtug_username', username);
    
    // Set username on server
    socket.emit('set-username', username);
    
    // Validate room ID
    const roomValidation = validateInput(roomIdToJoin.value, 'roomId');
    if (!roomValidation.isValid) {
        showToast(roomValidation.message);
        roomIdToJoin.value = '';
        return;
    }
    
    const roomId = roomValidation.sanitizedValue;
    debug('Odaya katılma isteği gönderiliyor. OdaID:', roomId);
    
    // Show loading screen
    showLoadingScreen(false);
    
    // Join room
    socket.emit('join-room', roomId);
}

// Socket event handlers
socket.on('username-set', (username) => {
    debug('Kullanıcı adı sunucuda ayarlandı:', username);
});

socket.on('room-created', (data) => {
    debug('Oda oluşturuldu:', data.roomId);
    
    // Hide loading screen after a minimum duration
    setTimeout(() => {
        hideLoadingScreen();
        // Redirect to room page
        const redirectUrl = `/room.html?room=${encodeURIComponent(data.roomId)}`;
        debug('Yönlendiriliyor:', redirectUrl);
        window.location.href = redirectUrl;
    }, 1500); // Minimum 1.5 saniye göster
});

socket.on('room-joined', (data) => {
    debug('Odaya katılındı:', data.roomId);
    
    // Hide loading screen after a minimum duration
    setTimeout(() => {
        hideLoadingScreen();
        // Redirect to room page
        const redirectUrl = `/room.html?room=${encodeURIComponent(data.roomId)}`;
        debug('Yönlendiriliyor:', redirectUrl);
        window.location.href = redirectUrl;
    }, 1500); // Minimum 1.5 saniye göster
});

socket.on('room-error', (data) => {
    debug('Oda hatası:', data.message);
    hideLoadingScreen();
    showToast(data.message);
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', init); 