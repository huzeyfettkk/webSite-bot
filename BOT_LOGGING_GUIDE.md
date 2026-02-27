# Bot Error Logging Sistemi - Kullanım Rehberi

## 📋 Genel Bakış

Bot artık detaylı hata kayıtlaması yapıyor. Her bot işlemi (mesaj alma, arama yapma, veri tabanı işlemleri, vb.) JSON log dosyasına kaydediliyor.

## 🚀 Bot'u Çalıştırmak

```bash
node index.js
```

Bot başladığında:
1. Konsol çıktısı renk-kodlu olarak gösterilir
2. Arkaplanda `logs/bot-YYYY-MM-DD.log.json` dosyasına loglar yazılır
3. 5 saniye sonra startup özeti gösterilir

## 📊 Logları Kontrol Etmek

### 1. **Özet Rapor** (En Basit)
```bash
node bot-diagnostics.js summary
```
Kısaca gösterir:
- Başarılı işlemlerin sayısı
- Uyarıların sayısı
- Hataların sayısı
- Son 5 hata/uyarı

### 2. **Sağlık Kontrolü** (Health Check)
```bash
node bot-diagnostics.js health
```
Bot'un tüm kritik adımlarının durumunu tabloyla gösterir:
```
✅ OK       BOT_INIT                 | S:1 W:0 E:0
✅ OK       WHATSAPP_CLIENT          | S:3 W:0 E:0
⚠️  UYARI   ILAN_SAVE                | S:5 W:1 E:0
❌ HATA    MESSAGE_SEND             | S:10 W:0 E:3
```

### 3. **Hataları Göster** (Sadece Hatalar)
```bash
node bot-diagnostics.js error
```

### 4. **Uyarıları Göster** (Sadece Uyarılar)
```bash
node bot-diagnostics.js warn
```

### 5. **Tüm Detaylı Logları** (Varsayılan)
```bash
node bot-diagnostics.js
```
Tüm logları kronolojik sırada gösterir.

## 📁 Log Dosya Konumu

```
logs/
├── bot-2025-02-27.log.json    ← Bugünün logları
├── bot-2025-02-26.log.json
└── bot-2025-02-25.log.json
```

JSON formatı:
```json
{
  "timestamp": "2025-02-27T14:30:45.123Z",
  "level": "ERROR",
  "step": "MESSAGE_SEND",
  "message": "Mesaj gönderilemedi",
  "data": {
    "recipientId": "xxx@s.whatsapp.net",
    "errorMessage": "Failed to send message: Connection closed",
    "errorStack": "Error: Connection closed..."
  }
}
```

## 🔍 Kritik Adımlar (Kontrol Noktaları)

Bot bu adımları izler:

| Adım | Açıklama | Başarısızlık Tasarısı |
|------|----------|----------------------|
| `BOT_INIT` | Bot başlatılıyor | Bot hiç başlamıyor |
| `WHATSAPP_CLIENT` | WhatsApp bağlantısı kurulu | Hiç QR kodu görülmüyor |
| `WHATSAPP_QR` | QR kod oluşturuluyor | Oturum açılamıyor |
| `WHATSAPP_AUTH` | İstemci doğrulanıyor | OTP gerekiyor ama gitti |
| `WHATSAPP_READY` | Bot hazır duruma geçti | Bot bağlantı kesiliyor |
| `MESSAGE_RECEIVED` | Mesaj alındı | Mesajlar görülmüyor |
| `CITY_CHECK` | Şehir hesaplandı | Hatalı şehir algılaması |
| `SEARCH_PROCESS` | İlan arama yapıldı | Hiç sonuç yok veya hata |
| `ILAN_SAVE` | İlan kaydedildi | Veritabanı hatası |
| `MESSAGE_SEND` | Mesaj gönderildi | Cevap gönderimi başarısız |
| `CHANNEL_MESSAGE` | Kanal mesajı alındı | Duyurular kaydedilmiyor |
| `DATABASE` | Veritabanı işlemi | SQL hatası |

## ❌ Yaygın Hatalar ve Çözümleri

### 1. "Bot hiç başlamıyor"
```bash
node bot-diagnostics.js error
```
`BOT_INIT` ve `WHATSAPP_CLIENT` hatalarına bak. Genellikle:
- Yapılandırma dosyası eksik
- Node.js versiyonu uyumsuz
- Port zaten kullanımda

### 2. "QR kodu görülmüyor"
`WHATSAPP_QR` adımında hata var. Check:
- Terminal çıktısında QR gösteriliyor mu?
- WhatsApp Web'e erişim engellendi mi?

### 3. "Mesajlar alınıyor ama cevap verilmiyor"
Kontrol et:
- `MESSAGE_RECEIVED` başarılı mı?
- `CITY_CHECK` hatası var mı? (Şehir alınamıyor)
- `SEARCH_PROCESS` hata verdi mi?
- `MESSAGE_SEND` hata verdi mi?

### 4. "Arama sonucu yok"
`SEARCH_PROCESS` adımına bak:
```json
{
  "timestamp": "2025-02-27T14:30:45.123Z",
  "level": "WARN",
  "step": "SEARCH_PROCESS",
  "message": "Arama sonucu yok",
  "data": {
    "city1": "istanbul",
    "city2": "ankara",
    "resultCount": 0,
    "duration": 234
  }
}
```

## 🛠️ Manual Kontrol

Log dosyasını doğrudan açmak için:

```bash
# Windows
type logs\bot-2025-02-27.log.json | more

# Linux/Mac
cat logs/bot-2025-02-27.log.json | less

# JSON formatter ile (daha güzel)
node -e "console.log(JSON.stringify(require('./logs/bot-2025-02-27.log.json'), null, 2))" | less
```

## 📈 Real-time İzleme

Bot çalışırken başka bir terminalde:

```bash
# Her 2 saniyede logları yenile
watch -n 2 "node bot-diagnostics.js summary"

# Sadece hataları izle
watch -n 2 "node bot-diagnostics.js error"
```

## 🧪 Test Süreci

1. **Bot'u başlat:**
   ```bash
   node index.js
   ```

2. **QR kodu taraması (ilk kez):**
   - Konsol rengine bak - QR kodu gösterildi mi?
   - `WHATSAPP_QR` log'unda başarı var mı?

3. **Test mesajı gönder:**
   - Bir arkadaşıyla sohbet aç
   - "istanbul" yazıp gönder
   - Cevap bekle (max 30 saniye)

4. **Logları kontrol et:**
   ```bash
   node bot-diagnostics.js summary
   ```
   - Hata sayısı kaç?
   - Hangi adımda başarısız oldu?

5. **Detaylara in:**
   ```bash
   node bot-diagnostics.js error
   ```
   - Error mesajı ne?
   - Error stack trace'i nereye işaret ediyor?

## 📱 Hangi İşlem Neyi Kaydeder?

| İşlem | Log Degeri | Kaydedilen Bilgiler |
|-------|-----------|-------------------| 
| Mesaj alma | MESSAGE_RECEIVED | Gönderici, mesaj metni, zaman |
| Şehir alma | CITY_CHECK | Şehir1, Şehir2, bulundu mu? |
| İlan arama | SEARCH_PROCESS | Sorgu, sonuç sayısı, süre |
| Mesaj gönderme | MESSAGE_SEND | Alıcı, mesaj, başarı/hata |
| Veri tabanı | ILAN_SAVE | Ekilen harita sayısı, hata |
| Bağlantı sorunu | HEARTBEAT | Bağlantı durumu, son hata |

## 💾 Eski Logları Silme

```bash
# Sadece bugünkü logu sil
rm logs/bot-2025-02-27.log.json

# Tüm logları sil
rm logs/bot-*.log.json

# 7 günden eski logları sil
find logs/ -name "bot-*.log.json" -mtime +7 -delete
```

## 🔬 Gelişmiş: Log Analizi

Hataları SQL-benzeri filtrelemek için:

```bash
node -e "
const logs = require('./logs/bot-2025-02-27.log.json');
const errors = logs.filter(l => l.level === 'ERROR' && l.step === 'MESSAGE_SEND');
console.log('Mesaj gönderimi hataları:');
errors.forEach(e => console.log('  - ' + e.message + ': ' + e.data.errorMessage));
"
```

## ✅ Başarılı Sistem Belirtileri

Aşağıdakileri gördüğünde bot sağlam:
- `WHATSAPP_READY` başarılı ✅
- `MESSAGE_RECEIVED` sayısı > 0 ✅
- `MESSAGE_SEND` son 5 adet başarılı ✅
- `SEARCH_PROCESS` error sayısı 0 ✅
- Toplam error sayısı < 5 ✅

---

**Sorularınız mı var? Logları inceledikten sonra hataları gözle şu re hemen çözelim!**
