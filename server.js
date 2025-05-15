const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Express uygulamasını oluştur
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  path: "/socket.io/",
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Konsola renkli loglar
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // Cyan
    success: '\x1b[32m%s\x1b[0m',  // Green
    warning: '\x1b[33m%s\x1b[0m',  // Yellow
    error: '\x1b[31m%s\x1b[0m'     // Red
  };
  
  const timestamp = new Date().toLocaleTimeString();
  console.log(colors[type], `[${timestamp}] ${message}`);
}

// Oda bilgilerini tutacak nesne
const rooms = {};

// Kullanıcı IP'lerini ve bilgilerini tutacak nesne
const userSessions = {};

// IP ve kullanıcı eşleştirme fonksiyonu
function getUserByIp(ip) {
    return userSessions[ip];
}

// Debug bilgisi için tüm odaları listele
function logRooms() {
    console.log('Mevcut odalar:', Object.keys(rooms));
    Object.keys(rooms).forEach(room => {
        console.log(`-- Oda: ${room}, Kullanıcı sayısı: ${rooms[room].users.length}`);
    });
}

// Kullanıcı adını doğrula
function validateUsername(username) {
    // Boş veya çok kısa kullanıcı adlarını reddet
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
        return {
            isValid: false,
            message: 'Kullanıcı adı en az 2 karakter olmalıdır'
        };
    }
    
    // Kullanıcı adını temizle
    const sanitizedUsername = username.trim();
    
    // Küfür ve uygunsuz kelime kontrolü
    const blockedWords = [
        'amk', 'aq', 'sg', 'oç', 'piç', 'yavşak', 'amına', 'sikerim', 'sikim', 'amcık', 'amcik',
        'ananısikim', 'ananisikim', 'anan', 'sikeyim', 'sikik', 'amq', 'amcık', 'amcik', 'amına koyayım',
        'amina koyayim', 'amına koyim', 'amina koyim', 'mk', 'aq', 'sg', 'oc', 'pic', 'yavşak'
    ];
    
    const lowerUsername = sanitizedUsername.toLowerCase();
    for (const word of blockedWords) {
        if (lowerUsername.includes(word)) {
            return {
                isValid: false,
                message: 'Kullanıcı adında uygunsuz kelimeler bulunamaz'
            };
        }
    }
    
    // Maksimum uzunluk kontrolü
    if (sanitizedUsername.length > 20) {
        return {
            isValid: false,
            message: 'Kullanıcı adı en fazla 20 karakter olabilir'
        };
    }
    
    return {
        isValid: true,
        sanitizedValue: sanitizedUsername
    };
}

// Socket.io bağlantı işlemleri
io.on('connection', (socket) => {
    // Kullanıcının IP adresini al
    const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    console.log(`Yeni bağlantı: ${socket.id} from IP: ${clientIp}`);
    
    // IP'ye göre önceki oturum kontrolü
    const existingSession = getUserByIp(clientIp);
    if (existingSession) {
        console.log(`Mevcut oturum bulundu: ${existingSession.username}`);
        socket.username = existingSession.username;
        socket.previousRoom = existingSession.room;
        socket.emit('restore-session', {
            username: existingSession.username,
            room: existingSession.room
        });
    }

    // Kullanıcı adını ayarla
    socket.on('set-username', (username) => {
        // Kullanıcı adını doğrula
        const validation = validateUsername(username);
        
        if (!validation.isValid) {
            console.log(`Geçersiz kullanıcı adı: ${username} - ${validation.message}`);
            socket.emit('username-error', { message: validation.message });
            return;
        }
        
        const validatedUsername = validation.sanitizedValue;
        console.log(`Kullanıcı adı ayarlandı: ${socket.id} -> ${validatedUsername}`);
        socket.username = validatedUsername;
        
        // IP ile kullanıcı bilgilerini eşleştir
        userSessions[clientIp] = {
            socketId: socket.id,
            username: validatedUsername,
            room: socket.room
        };
        
        // Kullanıcıya başarılı doğrulama bilgisi gönder
        socket.emit('username-validated', { username: validatedUsername });
    });
    
    // Check active streams in a room
    socket.on('check-active-streams', (data, callback) => {
        const roomId = data.roomId;
        
        if (!roomId || !rooms[roomId]) {
            callback({ error: 'Oda bulunamadı' });
            return;
        }
        
        // Return the active sharer in the room if there is one
        if (rooms[roomId].sharer) {
            callback({ 
                sharer: rooms[roomId].sharer,
                mediaState: rooms[roomId].mediaState || { hasAudio: true, hasVideo: true }
            });
        } else {
            callback({ sharer: null });
        }
    });
    
    // Oda oluşturma
    socket.on('create-room', (roomId) => {
        // Oda ID'sindeki boşlukları temizle
        let cleanRoomId = roomId.trim();
        
        console.log(`Oda oluşturma isteği: ${cleanRoomId} (isteyen: ${socket.id})`);
        
        if (rooms[cleanRoomId]) {
            // Eğer oda var ama silinme zamanlayıcısı varsa iptal et ve odaya katıl
            if (rooms[cleanRoomId].deleteTimer) {
                cancelRoomDeletion(cleanRoomId);
                
                // Kullanıcıyı odaya ekle
                const username = socket.username || `Misafir-${socket.id.substr(0, 6)}`;
                const userInfo = { id: socket.id, username };
                rooms[cleanRoomId].users.push(userInfo);
                socket.join(cleanRoomId);
                socket.room = cleanRoomId;
                
                // Kullanıcıya bilgi gönder
                socket.emit('room-joined', { 
                    roomId: cleanRoomId,
                    users: rooms[cleanRoomId].users
                });
                
                console.log(`Oda silme iptal edildi ve kullanıcı katıldı: ${cleanRoomId}`);
                return;
            }
            
            console.log(`Hata: ${cleanRoomId} odası zaten mevcut`);
            socket.emit('room-error', { message: 'Bu oda ID zaten kullanılıyor.' });
            return;
        }
        
        // Odayı oluştur ve kullanıcıyı odaya ekle
        rooms[cleanRoomId] = {
            creator: socket.id,
            users: [{ id: socket.id, username: socket.username || `Misafir-${socket.id.substr(0, 6)}` }],
            messages: [], // Oda mesajlarını saklamak için dizi
            createdAt: new Date(),
            initialJoins: new Set() // İlk katılımları takip etmek için
        };
        
        socket.join(cleanRoomId);
        socket.room = cleanRoomId;
        
        // Oturum bilgilerini güncelle
        if (userSessions[clientIp]) {
            userSessions[clientIp].room = cleanRoomId;
        }
        
        socket.emit('room-created', { roomId: cleanRoomId });
        console.log(`Oda başarıyla oluşturuldu: ${cleanRoomId}`);
        logRooms();
    });
    
    // Odaya katılma
    socket.on('join-room', (roomId) => {
        let cleanRoomId = roomId.trim();
        
        // Oturum bilgilerini güncelle
        if (userSessions[clientIp]) {
            userSessions[clientIp].room = cleanRoomId;
        }
        
        console.log(`Odaya katılma isteği: ${cleanRoomId} (isteyen: ${socket.id})`);
        
        if (!rooms[cleanRoomId]) {
            console.log(`Hata: ${cleanRoomId} odası bulunamadı`);
            socket.emit('room-error', { message: 'Oda bulunamadı.' });
            return;
        }
        
        // Oda silme zamanlayıcısı varsa iptal et
        cancelRoomDeletion(cleanRoomId);
        
        // Kullanıcı zaten bu odada mı?
        const existingUser = rooms[cleanRoomId].users.find(user => 
            user.username === socket.username || user.id === socket.id
        );
        
        if (existingUser) {
            console.log(`Bilgi: Kullanıcı zaten ${cleanRoomId} odasında - Yeniden bağlanıyor`);
            
            // Kullanıcının socket ID'sini güncelle
            existingUser.id = socket.id;
            
            // Kullanıcı listesi için sharing bilgisini ekle
            const roomUsers = rooms[cleanRoomId].users.map(user => ({
                id: user.id,
                username: user.username,
                isSharing: user.id === rooms[cleanRoomId].sharer
            }));
            
            socket.join(cleanRoomId);
            socket.room = cleanRoomId;
            
            socket.emit('room-joined', { 
                roomId: cleanRoomId,
                users: roomUsers
            });
            
            // Geçmiş mesajları gönder
            if (rooms[cleanRoomId].messages && rooms[cleanRoomId].messages.length > 0) {
                socket.emit('chat-history', rooms[cleanRoomId].messages);
            }
            
            // Diğer kullanıcılara socket ID güncellemesini bildir
            socket.to(cleanRoomId).emit('user-reconnected', {
                oldId: existingUser.id,
                newId: socket.id,
                username: existingUser.username
            });
            
            return;
        }
        
        // Odada zaten 6 kişi var mı kontrolü
        if (rooms[cleanRoomId].users.length >= 6) {
            console.log(`Hata: ${cleanRoomId} odası dolu`);
            socket.emit('room-error', { message: 'Oda dolu (Maksimum 6 kişi).' });
            return;
        }
        
        // Kullanıcı bilgilerini hazırla
        const username = socket.username || `Misafir-${socket.id.substr(0, 6)}`;
        const userInfo = { id: socket.id, username };
        
        // Kullanıcıyı odaya ekle
        rooms[cleanRoomId].users.push(userInfo);
        socket.join(cleanRoomId);
        socket.room = cleanRoomId;
        
        // Kullanıcı listesi için sharing bilgisini ekle
        const roomUsers = rooms[cleanRoomId].users.map(user => ({
            id: user.id,
            username: user.username,
            isSharing: user.id === rooms[cleanRoomId].sharer
        }));
        
        // Kullanıcıya oda bilgilerini gönder
        socket.emit('room-joined', { 
            roomId: cleanRoomId,
            users: roomUsers,
            currentSharer: rooms[cleanRoomId].sharer || null // Aktif yayıncı bilgisini ekle
        });
        
        // Geçmiş mesajları gönder
        if (rooms[cleanRoomId].messages && rooms[cleanRoomId].messages.length > 0) {
            socket.emit('chat-history', rooms[cleanRoomId].messages);
        }
        
        console.log(`Kullanıcı odaya katıldı: ${socket.id} -> ${cleanRoomId}`);
        
        // İlk kez katılım kontrolü
        const isFirstJoin = !rooms[cleanRoomId].initialJoins.has(socket.id);
        if (isFirstJoin) {
            rooms[cleanRoomId].initialJoins.add(socket.id);
            
            // Odadaki kullanıcılara katılım mesajı gönder
            const systemMessage = {
                id: Date.now(),
                user: 'Sistem',
                message: `${username} odaya katıldı`,
                timestamp: new Date(),
                isSystem: true
            };
            
            io.to(cleanRoomId).emit('chat-message', systemMessage);
            
            // Kullanıcı katılım mesajını mesaj geçmişine ekle
            if (rooms[cleanRoomId]) {
                rooms[cleanRoomId].messages.push(systemMessage);
                
                // Odadaki diğer kullanıcılara yeni kullanıcı bilgisini gönder
                socket.to(cleanRoomId).emit('user-joined', {...userInfo, isSharing: false});
                
                // Eğer odada aktif bir ekran paylaşımı varsa, kullanıcıya bildir
                if (rooms[cleanRoomId].sharer) {
                    socket.emit('user-sharing', { userId: rooms[cleanRoomId].sharer });
                }
            }
        }
        
        logRooms();
    });
    
    // Hazır sinyali
    socket.on('ready', (payload) => {
        // Payload bir string veya obje olabilir
        let roomId, targetId;
        
        if (typeof payload === 'string') {
            roomId = payload.trim();
            console.log(`Hazır sinyali (genel): ${socket.id} -> ${roomId}`);
            
            // Odadaki diğer kullanıcılara hazır sinyalini gönder
            socket.broadcast.to(roomId).emit('ready', { from: socket.id });
        } else if (typeof payload === 'object') {
            roomId = payload.roomId;
            targetId = payload.to;
            
            console.log(`Hazır sinyali (özel): ${socket.id} -> ${targetId} (Oda: ${roomId})`);
            
            // Sadece belirtilen kullanıcıya hazır sinyalini gönder
            if (targetId) {
                io.to(targetId).emit('ready', { from: socket.id });
            } else {
                // Hedef belirtilmemişse odadaki herkese gönder
                socket.broadcast.to(roomId).emit('ready', { from: socket.id });
            }
        }
    });
    
    // WebRTC teklifi (offer)
    socket.on('offer', (payload) => {
        console.log(`Offer: ${socket.id} -> ${payload.target} (Oda: ${payload.roomId})`);
        if (!payload.target) {
            console.error("Offer hedefi belirtilmemiş");
            return;
        }
        
        io.to(payload.target).emit('offer', {
            offer: payload.offer,
            from: socket.id
        });
    });
    
    // WebRTC cevabı (answer)
    socket.on('answer', (payload) => {
        console.log(`Answer: ${socket.id} -> ${payload.target} (Oda: ${payload.roomId})`);
        if (!payload.target) {
            console.error("Answer hedefi belirtilmemiş");
            return;
        }
        
        io.to(payload.target).emit('answer', {
            answer: payload.answer,
            from: socket.id
        });
    });
    
    // ICE adayları
    socket.on('ice-candidate', (payload) => {
        console.log(`ICE candidate: ${socket.id} -> ${payload.target} (Oda: ${payload.roomId})`);
        if (!payload.target) {
            console.error("ICE candidate hedefi belirtilmemiş");
            return;
        }
        
        io.to(payload.target).emit('ice-candidate', {
            candidate: payload.candidate,
            from: socket.id
        });
    });
    
    // Ekran paylaşımını başlat
    socket.on('start-sharing', (payload) => {
        const { roomId, hasAudio, hasVideo } = payload;
        
        if (!roomId || !rooms[roomId]) {
            console.error(`Ekran paylaşımı için geçerli bir oda ID'si belirtilmedi`);
            return;
        }
        
        console.log(`Ekran paylaşımı başlatıldı: ${socket.id} (Oda: ${roomId}, Ses: ${hasAudio}, Kamera: ${hasVideo})`);
        
        // Bu odadaki ekran paylaşımı yapan kullanıcıyı ve medya bilgilerini kaydet
        rooms[roomId].sharer = socket.id;
        rooms[roomId].mediaState = {
            hasAudio,
            hasVideo
        };
        
        // Diğer kullanıcılara bildirim gönder
        socket.to(roomId).emit('user-sharing', { 
            userId: socket.id,
            hasAudio,
            hasVideo
        });
        
        // Odadaki tüm kullanıcıların otomatik olarak yayına bağlanmasını sağla
        rooms[roomId].users.forEach(user => {
            // Paylaşım yapan kullanıcı hariç herkese ready sinyali gönder
            if (user.id !== socket.id) {
                console.log(`Otomatik ready sinyali gönderiliyor: ${user.id} -> ${socket.id}`);
                io.to(user.id).emit('auto-connect-stream', { 
                    roomId: roomId,
                    sharerId: socket.id
                });
            }
        });
    });
    
    // Medya durumu değişikliği
    socket.on('media-state-change', (payload) => {
        const { roomId, hasAudio, hasVideo } = payload;
        
        if (!roomId || !rooms[roomId]) {
            console.error(`Medya durum değişikliği için geçerli bir oda ID'si belirtilmedi`);
            return;
        }
        
        if (rooms[roomId].sharer === socket.id) {
            rooms[roomId].mediaState = {
                hasAudio,
                hasVideo
            };
            
            // Diğer kullanıcılara medya durum değişikliğini bildir
            socket.to(roomId).emit('media-state-changed', {
                userId: socket.id,
                hasAudio,
                hasVideo
            });
        }
    });
    
    // Ekran paylaşımını durdur
    socket.on('stop-sharing', (roomId) => {
        if (!roomId || !rooms[roomId]) {
            console.error(`Ekran paylaşımı durdurma için geçerli bir oda ID'si belirtilmedi`);
            return;
        }
        
        console.log(`Ekran paylaşımı durduruldu: ${socket.id} (Oda: ${roomId})`);
        
        // Ekran paylaşımı yapan kullanıcıyı temizle
        if (rooms[roomId].sharer === socket.id) {
            delete rooms[roomId].sharer;
        }
        
        // Diğer kullanıcılara bildirim gönder
        socket.to(roomId).emit('user-stopped-sharing', { userId: socket.id });
    });
    
    // Chat mesajları
    socket.on('chat-message', (data) => {
        const username = socket.username || `Misafir-${socket.id.substr(0, 6)}`;
        
        // Mesaj nesnesini oluştur
        const messageObj = {
            id: Date.now(),
            user: username,
            message: data.message,
            timestamp: new Date(),
            isSystem: false
        };
        
        // Mesajı diğer kullanıcılara gönder
        socket.broadcast.to(data.roomId).emit('chat-message', messageObj);
        
        // Mesajı odanın mesaj geçmişine ekle
        if (rooms[data.roomId]) {
            rooms[data.roomId].messages = rooms[data.roomId].messages || [];
            rooms[data.roomId].messages.push(messageObj);
            
            // Mesaj geçmişini belirli bir sayıda tutmak için
            const MAX_MESSAGES = 100; // Son 100 mesajı sakla
            if (rooms[data.roomId].messages.length > MAX_MESSAGES) {
                rooms[data.roomId].messages = rooms[data.roomId].messages.slice(-MAX_MESSAGES);
            }
        }
        
        console.log(`Chat mesajı: ${username} -> "${data.message}" (Oda: ${data.roomId})`);
    });
    
    // Bağlantı kesildiğinde
    socket.on('disconnect', () => {
        console.log(`Kullanıcı ayrıldı: ${socket.id}`);
        
        // Oturumu hemen silme, yenileme durumu olabilir
        setTimeout(() => {
            const isReconnected = Array.from(io.sockets.sockets.values())
                .some(s => s.handshake.headers['x-forwarded-for'] === clientIp);
            
            if (!isReconnected) {
                delete userSessions[clientIp];
                console.log(`Oturum silindi: ${clientIp}`);
            }
        }, 5000); // 5 saniye bekle
        
        // Kullanıcının olduğu odaları temizle
        for (const roomId in rooms) {
            // Kullanıcı bu odada mı?
            const userIndex = rooms[roomId].users.findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                // Kullanıcı bilgilerini al
                const username = rooms[roomId].users[userIndex].username;
                
                // Kullanıcıyı odadan çıkar
                rooms[roomId].users.splice(userIndex, 1);
                
                // Odada başka kullanıcı kalmadıysa odayı hemen silme - 30 saniye bekle
                if (rooms[roomId].users.length === 0) {
                    console.log(`Boş oda için silme zamanlayıcısı başlatılıyor: ${roomId}`);
                    
                    // Odayı hemen silmek yerine bir timer ayarla
                    rooms[roomId].deleteTimer = setTimeout(() => {
                        // Hala boş mu kontrol et
                        if (rooms[roomId] && rooms[roomId].users.length === 0) {
                            delete rooms[roomId];
                            console.log(`Oda silindi (zamanlayıcı): ${roomId}`);
                            logRooms();
                        } else if (rooms[roomId]) {
                            console.log(`Oda silinmedi, kullanıcı var: ${roomId}`);
                        }
                    }, 30000); // 30 saniye bekle
                } else {
                    // Kullanıcı ayrıldı sistem mesajı
                    const systemMessage = {
                        id: Date.now(),
                        user: 'Sistem',
                        message: `${username} odadan ayrıldı`,
                        timestamp: new Date(),
                        isSystem: true
                    };
                    
                    io.to(roomId).emit('chat-message', systemMessage);
                    
                    // Ayrılma mesajını mesaj geçmişine ekle
                    if (rooms[roomId]) {
                        rooms[roomId].messages = rooms[roomId].messages || [];
                        rooms[roomId].messages.push(systemMessage);
                    }
                    
                    // Kalan kullanıcılara bildir
                    io.to(roomId).emit('user-disconnected', socket.id);
                }
            }
        }
        logRooms();
    });
});

// Yeni bir katılımda, varsa odanın silme zamanlayıcısını iptal et
function cancelRoomDeletion(roomId) {
    if (rooms[roomId] && rooms[roomId].deleteTimer) {
        console.log(`Oda silme zamanlayıcısı iptal edildi: ${roomId}`);
        clearTimeout(rooms[roomId].deleteTimer);
        delete rooms[roomId].deleteTimer;
    }
}

// Otomatik oda temizleme (24 saat boyunca kullanılmayan odaları temizle)
setInterval(() => {
    const now = new Date();
    let cleaned = 0;
    
    for (const roomId in rooms) {
        // Son mesaj zamanını kontrol et
        let lastActivity = rooms[roomId].createdAt;
        
        if (rooms[roomId].messages.length > 0) {
            const lastMessage = rooms[roomId].messages[rooms[roomId].messages.length - 1];
            if (lastMessage.timestamp > lastActivity) {
                lastActivity = lastMessage.timestamp;
            }
        }
        
        // 24 saatten fazla süre geçmiş mi?
        const hoursDiff = Math.abs(now - lastActivity) / 36e5; // saat cinsinden fark
        
        if (hoursDiff > 24) {
            delete rooms[roomId];
            cleaned++;
            console.log(`Eski oda temizlendi: ${roomId} (${hoursDiff.toFixed(1)} saat)`);
        }
    }
    
    if (cleaned > 0) {
        console.log(`${cleaned} adet boş oda temizlendi.`);
        logRooms();
    }
}, 3600000); // Her saat kontrol et

// Hataları Dinleme
app.on('error', (error) => {
  log(`HTTP Server Hatası: ${error.message}`, 'error');
});

server.on('error', (error) => {
  log(`Server Hatası: ${error.message}`, 'error');
});

// Sunucuyu başlat (development için)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    log(`WatchTug sunucusu ${PORT} portunda çalışıyor`, 'success');
    log(`http://localhost:${PORT} adresinden erişebilirsiniz`, 'success');
  });
}

// Vercel için exports - serverless environments için
module.exports = app;

// Vercel için server ve io'yu da export et
module.exports.server = server;
module.exports.io = io;