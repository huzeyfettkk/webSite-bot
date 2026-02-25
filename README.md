# 🚛 WhatsApp Lojistik Takip ve Arama Botu

## Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Botu başlat
npm start
```

İlk çalıştırmada terminalde bir QR kodu belirecek.  
WhatsApp mobil uygulamasından **Bağlı Cihazlar → Cihaz Ekle** yoluyla taratın.  
Oturum `/.wwebjs_auth/` klasörüne kaydedilir; bir sonraki başlatmada QR çıkmaz.

---

## Kullanım

### İlan Algılama (otomatik)
Bot dahil olduğunuz tüm grup ve topluluklardaki mesajları izler.  
İçinde **telefon numarası + en az bir şehir adı** bulunan mesajlar otomatik olarak "ilan" sayılıp RAM'e kaydedilir.  
Her ilan **24 saat** sonra bellekten silinir.

### Arama (özel sohbet)
Botun numarasına özel mesaj olarak şöyle yazın:

```
Samsun İstanbul
```

Bot, son 24 saat içinde kaydedilen ve **her iki şehri birden** içeren ilanları  
en yeniden en eskiye sıralayarak gönderir:

```
🚛 İlan 1 — Lojistik Grubu
🚛 Kavak/Samsun - Başakşehir/İstanbul, palet, tel: +905071661831
⏱ 34 dakika önce

──────────────────────────────
...
```

---

## Şehir Listesini Genişletme

`index.js` içindeki `CONFIG.CITIES` dizisine istediğiniz şehir/ilçe isimlerini ekleyin.  
Türkçe karakterler otomatik normalize edilir (İ→i, Ş→s, Ü→u vb.).

---

## Gereksinimler

| Araç | Sürüm |
|------|-------|
| Node.js | ≥ 18 |
| whatsapp-web.js | ^1.26 |
| Chromium/Puppeteer | (otomatik indirilir) |

> **Not:** Sunucuda çalıştırıyorsanız `--no-sandbox` bayrağı zaten açıktır.  
> Docker kullanıyorsanız `apt install -y chromium-browser` ile tarayıcıyı manuel kurun  
> ve `executablePath` seçeneğini buna göre ayarlayın.
