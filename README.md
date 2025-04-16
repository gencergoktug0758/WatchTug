# WatchTug V2 - Modern Ekran Paylaşım Uygulaması

<div align="center">
  <img src="public/img/logo.svg" alt="WatchTug Logo" width="120">
</div>

Modern, mobil uyumlu ve düşük gecikmeli gerçek zamanlı ekran paylaşım uygulaması. WebRTC teknolojisi ile düşük gecikmeli ekran paylaşımı sağlar.

## Özellikler

- ⚡ **Düşük Gecikme**: WebRTC teknolojisi ile gerçek zamanlı iletişim
- 🎨 **Modern Arayüz**: Tailwind CSS ile tasarlanmış mobil uyumlu arayüz
- 🔒 **Güvenli P2P Bağlantı**: Veriler sunucu üzerinden geçmeden doğrudan kullanıcılar arasında aktarılır
- 💬 **Anlık Mesajlaşma**: Ekran paylaşımı sırasında gerçek zamanlı sohbet imkanı
- 📱 **Mobil Uyumlu**: Tüm cihazlardan erişim imkanı
- 🌐 **Tarayıcı Tabanlı**: Kurulum gerektirmez, modern tarayıcılarda çalışır

## Teknolojiler

- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **Gerçek Zamanlı İletişim**: Socket.io, WebRTC
- **Media**: MediaDevices API, Screen Capture API

## Kurulum

### Gereksinimler

- Node.js (v16.0.0 veya üzeri)
- npm (v8.0.0 veya üzeri)

### Kurulum Adımları

1. Projeyi klonlayın veya indirin:
   ```bash
   git clone https://github.com/kullaniciadi/watchtug-v2.git
   cd watchtug-v2
   ```

2. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```

3. Uygulamayı başlatın:
   ```bash
   npm start
   ```

4. Tarayıcınızda aşağıdaki adresi açın:
   ```
   http://localhost:3000
   ```
(EĞER NGROK İLE KULLANMAK İSTİYORSANIZ "simple-launcher.bat" DOSYASINI AÇIN.)
## İnternet Üzerinden Erişim

Uygulamayı internet üzerinden erişilebilir yapmak için Ngrok kullanabilirsiniz:

1. `ngrok_auth.txt` dosyasına Ngrok authtoken'ınızı ekleyin
2. `simple-launcher.bat` dosyasını çalıştırın
3. Verilen Ngrok URL'i ile uygulamaya erişebilirsiniz

## Tarayıcı Desteği

- Google Chrome (son sürüm)
- Mozilla Firefox (son sürüm)
- Microsoft Edge (Chromium tabanlı)
- Safari 14 ve üzeri
- Mobil tarayıcılar (Chrome for Android, Safari for iOS)

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasını inceleyebilirsiniz.

## Teşekkürler

- [WebRTC](https://webrtc.org/) - P2P iletişim için teknoloji
- [Socket.io](https://socket.io/) - Gerçek zamanlı iletişim için kütüphane
- [Tailwind CSS](https://tailwindcss.com/) - Stil için kullanılan CSS framework'ü
- [Font Awesome](https://fontawesome.com/) - Kullanılan ikonlar için

---

<div align="center">
  <p>WatchTug V2 - 2025</p>
</div> 
