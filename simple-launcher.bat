@echo off
title WatchTug V2 Başlatıcı

echo WatchTug V2 başlatılıyor...
echo.

:: Önce authtoken'ı al
set /p NGROK_AUTH_TOKEN=<ngrok_auth.txt

:: İlk CMD penceresini aç ve npm start komutunu çalıştır
echo Sunucu başlatılıyor...
start cmd /k "title WatchTug V2 Sunucu && npm start"

:: 3 saniye bekle
timeout /t 3 /nobreak >nul

:: İkinci CMD penceresini aç ve ngrok komutlarını çalıştır
echo Ngrok tüneli kuruluyor...
start cmd /k "title WatchTug V2 Ngrok Tüneli && ngrok config add-authtoken %NGROK_AUTH_TOKEN% && npx ngrok http 3000"

echo.
echo WatchTug V2 başlatıldı!
echo Tarayıcınız ile http://localhost:3000 adresine gidebilirsiniz
echo veya Ngrok penceresindeki URL'i kullanarak internet üzerinden erişebilirsiniz.
echo.
echo Kapatmak için bu pencereyi kapatın ve açılan komut pencerelerini de kapatın.

pause
exit 