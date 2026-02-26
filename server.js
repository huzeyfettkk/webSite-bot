require('dotenv').config();
/**
 * YükleGit - Web Sunucusu (SQLite entegreli)
 */

const express        = require('express');
const https          = require('https');
const { getIlVeIlceleri, getIlBilgisi, IL_ILCE } = require('./il_ilce');
const jwt            = require('jsonwebtoken');
const bcrypt         = require('bcryptjs');
const path           = require('path');
const crypto         = require('crypto');
const session        = require('express-session');
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer     = require('nodemailer');
const {
  ilanEkle, ilanAra, ilanSayisi,
  kullaniciBul, kullaniciBulUsername, kullaniciBulEmail,
  kullaniciBulGoogleId, kullaniciEkle, kullaniciGuncelle,
  tumKullanicilar, kullaniciSil,
  logEkle, loglariGetir,
} = require('./db');

const app    = express();
const PORT   = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'yuklegit-secret-2024';

const GOOGLE_CLIENT_ID     = '1056139041545-uarcf45oehmrglst9cp2vr8mc2uq7bbm.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const BASE_URL             = process.env.BASE_URL || 'https://yuklegit.tr';
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY || '';

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: 'yuklegit.iletisim@gmail.com', pass: 'wfpn tjqs baud bxxt' },
});

const _verifyTokens = new Map();
const _resetTokens  = new Map();
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function getIP(req) { return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }

async function sendVerifyMail(email, username, token) {
  const link = `${BASE_URL}/verify?token=${token}`;
  await mailer.sendMail({
    from: '"YükleGit" <yuklegit.iletisim@gmail.com>', to: email,
    subject: 'YükleGit — E-posta Doğrulama',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px"><h2 style="color:#1a5fdb">🚛 YükleGit</h2><p>Merhaba <strong>${username}</strong>,</p><p>Hesabınızı doğrulamak için aşağıdaki butona tıklayın:</p><a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#1a5fdb;color:white;border-radius:8px;text-decoration:none;font-weight:bold">E-postamı Doğrula</a><p style="color:#888;font-size:13px">Bu link 24 saat geçerlidir.</p></div>`,
  });
}

async function sendResetMail(email, username, token) {
  const link = `${BASE_URL}/reset-password?token=${token}`;
  await mailer.sendMail({
    from: '"YükleGit" <yuklegit.iletisim@gmail.com>', to: email,
    subject: 'YükleGit — Şifre Sıfırlama',
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px"><h2 style="color:#1a5fdb">🚛 YükleGit</h2><p>Merhaba <strong>${username}</strong>,</p><p>Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p><a href="${link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:#1a5fdb;color:white;border-radius:8px;text-decoration:none;font-weight:bold">Şifremi Sıfırla</a><p style="color:#888;font-size:13px">Bu link 1 saat geçerlidir.</p></div>`,
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: SECRET, resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET,
  callbackURL: BASE_URL + '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  let user = kullaniciBulGoogleId(profile.id);
  if (!user) {
    const email = profile.emails?.[0]?.value || '';
    const existing = email ? kullaniciBulEmail(email) : null;
    if (existing) {
      kullaniciGuncelle(existing.id, { googleId: profile.id, avatar: profile.photos?.[0]?.value || existing.avatar });
      user = kullaniciBul(existing.id);
    } else {
      const newId = kullaniciEkle({
        username: profile.displayName.replace(/\s+/g,'_').toLowerCase() + '_' + Date.now().toString().slice(-4),
        email, phone: '', password: null,
        googleId: profile.id, avatar: profile.photos?.[0]?.value || '',
        role: 'user', verified: true,
      });
      user = kullaniciBul(newId);
    }
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, kullaniciBul(id) || null));

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token gerekli' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Geçersiz token' }); }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkisiz' });
  next();
}

// ── Auth Rotaları ───────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Bilgiler eksik' });
  const user = kullaniciBulUsername(username) || kullaniciBulEmail(username);
  if (!user || !user.password || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Kullanıcı adı/e-posta veya şifre hatalı' });
  if (!user.verified && user.role !== 'admin')
    return res.status(403).json({ error: 'E-posta adresiniz henüz doğrulanmadı.', needsVerification: true });

  logEkle({ userId: user.id, action: 'login', detail: user.username, ipAddress: getIP(req) });
  const token = jwt.sign({ id: user.id, username: user.username, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

app.post('/api/register', async (req, res) => {
  const { username, email, password, phone } = req.body;
  if (!username || !email || !password || !phone) return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin' });
  if (!/^[0-9]{10,15}$/.test(phone.replace(/[\s\-().+]/g,''))) return res.status(400).json({ error: 'Geçerli bir telefon numarası girin' });
  if (kullaniciBulUsername(username)) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
  if (kullaniciBulEmail(email))       return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });

  const newId  = kullaniciEkle({ username, email, phone, password: bcrypt.hashSync(password, 10), role: 'user', verified: false });
  const vToken = genToken();
  _verifyTokens.set(vToken, { userId: newId, expires: Date.now() + 24*60*60*1000 });
  try { await sendVerifyMail(email, username, vToken); } catch(e) { console.warn('Mail gönderilemedi:', e.message); }
  res.json({ needsVerification: true, message: 'Kayıt başarılı! E-postanıza doğrulama linki gönderildi.' });
});

app.get('/verify', (req, res) => {
  const data = _verifyTokens.get(req.query.token);
  if (!data || data.expires < Date.now()) return res.send('<h2>❌ Geçersiz veya süresi dolmuş link.</h2>');
  kullaniciGuncelle(data.userId, { verified: 1 });
  _verifyTokens.delete(req.query.token);
  res.redirect('/?verified=1');
});

app.post('/api/forgot-password', async (req, res) => {
  const user = kullaniciBulEmail(req.body.email);
  if (user) {
    const rToken = genToken();
    _resetTokens.set(rToken, { userId: user.id, expires: Date.now() + 60*60*1000 });
    try { await sendResetMail(user.email, user.username, rToken); } catch(e) { console.warn('Mail gönderilemedi:', e.message); }
  }
  res.json({ ok: true });
});

app.post('/api/reset-password', (req, res) => {
  const { token, password } = req.body;
  const data = _resetTokens.get(token);
  if (!data || data.expires < Date.now()) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
  if (!password || password.length < 6)  return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  kullaniciGuncelle(data.userId, { password: bcrypt.hashSync(password, 10) });
  _resetTokens.delete(token);
  res.json({ ok: true });
});

app.put('/api/profile', authMiddleware, (req, res) => {
  const { email, phone, currentPassword, newPassword } = req.body;
  const user = kullaniciBul(req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const updates = {};
  if (email && email !== user.email) {
    if (kullaniciBulEmail(email)) return res.status(400).json({ error: 'Bu e-posta zaten kullanılıyor' });
    updates.email = email;
  }
  if (phone !== undefined) updates.phone = phone;
  if (newPassword) {
    if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password))
      return res.status(400).json({ error: 'Mevcut şifre hatalı' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı' });
    updates.password = bcrypt.hashSync(newPassword, 10);
  }
  kullaniciGuncelle(user.id, updates);
  const u = kullaniciBul(user.id);
  res.json({ ok: true, user: { id: u.id, username: u.username, email: u.email, role: u.role } });
});

// ── Kullanıcı Yönetimi (Admin) ──────────────────
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => res.json(tumKullanicilar()));

app.post('/api/users', authMiddleware, adminMiddleware, (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  if (kullaniciBulUsername(username)) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  const newId = kullaniciEkle({ username, email: email||'', password: bcrypt.hashSync(password, 10), role: role||'user', verified: true });
  res.json(kullaniciBul(newId));
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  kullaniciSil(Number(req.params.id));
  res.json({ ok: true });
});

// ── Kullanıcı Hareketleri (Admin) ───────────────
app.get('/api/logs', authMiddleware, adminMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
  res.json(loglariGetir(limit));
});

// ── Logout Log ──────────────────────────────────
app.post('/api/logout', authMiddleware, (req, res) => {
  logEkle({ userId: req.user.id, action: 'logout', detail: req.user.username, ipAddress: getIP(req) });
  res.json({ ok: true });
});


// ── Debug: Sakarya→Bolu testi ──────────────────
app.get('/api/debug-sakarya', authMiddleware, (req, res) => {
  const ilceler1 = getIlVeIlceleri('sakarya');
  const ilceler2 = getIlVeIlceleri('bolu');
  const rows = ilanAra('sakarya', 'bolu', ilceler1, ilceler2);
  const tumSakarya = ilanAra('sakarya', null, ilceler1, []);
  res.json({
    ilanAraVersiyon: 'v2-ilce-destekli',
    ilceler1_say: ilceler1.length,
    ilceler1_ornek: ilceler1.slice(0,4),
    ilceler2_say: ilceler2.length,
    sakarya_bolu_sonuc: rows.length,
    sadece_sakarya_sonuc: tumSakarya.length,
    sadece_sakarya_cities: tumSakarya.slice(0,3).map(r => r.cities),
  });
});


app.post('/api/ai-ara', authMiddleware, async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI özelliği yapılandırılmamış.' });
  }

  const { soru } = req.body;
  if (!soru) return res.status(400).json({ error: 'Soru gerekli.' });

  // Tüm aktif ilanları çek (24 saat)
  const dbRows = ilanAra(null, null);
  const tumIlanlar = dbRows.map(r => ({
    ...r,
    cities: (() => { try { return JSON.parse(r.cities); } catch { return []; } })()
  }));

  if (!tumIlanlar.length) {
    return res.json({ ok: true, sonuc: { ozet: 'Sistemde aktif ilan bulunmuyor.', ilanlar: [], toplamBulunan: 0 } });
  }

  // İlanları yapılandırılmış formatta hazırla
  const ilanListesi = tumIlanlar.map((ilan, i) => {
    const dakika = Math.floor((Date.now() - ilan.timestamp) / 60000);
    const sure = dakika < 60 ? `${dakika} dk` : `${Math.floor(dakika/60)} sa ${dakika%60} dk`;
    const sehirler = (ilan.cities || []).join(' → ');
    const metin = ilan.text.trim().replace(/\n+/g, ' ').slice(0, 300);
    return `ID:${i} | SÜRE:${sure} | GÜZERGAH:${sehirler || 'belirsiz'} | ${metin}`;
  }).join('\n');

  const prompt = `Sen bir Türkiye lojistik sektörü uzmanısın. Nakliye ve yük ilanlarını analiz edip en uygun sonuçları buluyorsun.

KULLANICI SORGUSU: "${soru}"

GÖREV:
1. Sorguyu analiz et: hangi şehir/güzergah isteniyor, araç tipi var mı (TIR, kamyon, açık, kapalı, lowbed vb.), yük türü var mı?
2. Aşağıdaki ilanlar arasından sorguyla EN ALAKALI olanları seç
3. Seçilen ilanları SADECE timestamp sırasına göre listele (en yeni önce - SÜRE değeri en küçük olan en üstte)
4. Alakasız ilanları kesinlikle dahil etme
5. Eğer hiç uygun ilan yoksa boş liste döndür

ÖNEMLİ KURALLAR:
- Güzergah aramasında: "istanbul ankara" → istanbuldan ankaraya giden ilanlar (sıra önemli)
- Araç tipi varsa: sadece o araç tipini içeren ilanları seç
- Yük türü varsa: o yükü içeren ilanları seç
- Emin olmadığın ilanları dahil etme, kalite > miktar
- Sıralama SADECE zaman bazlı olmalı (en yeni önce)

MEVCUT İLANLAR (${tumIlanlar.length} adet):
${ilanListesi}

YANIT (sadece geçerli JSON, başka hiçbir şey yazma):
{
  "ozet": "Sorgu analizi: ne arandı, kaç uygun ilan bulundu",
  "ilanlar": [
    {
      "id": 0,
      "nereden": "şehir adı veya boş",
      "nereye": "şehir adı veya boş",
      "aracTipi": "TIR/Kamyon/Açık/Kapalı/Lowbed/diğer veya boş",
      "telefon": "telefon numarası veya boş",
      "orijinalMetin": "ilanın tam metni"
    }
  ],
  "toplamBulunan": 0
}`;

  try {
    const sonuc = await geminiIste(prompt);

    // Gemini'nin döndürdüğü id'lere göre orijinal timestamp'i ekle ve sırala
    if (sonuc.ilanlar && sonuc.ilanlar.length) {
      sonuc.ilanlar = sonuc.ilanlar
        .map(aiIlan => {
          const orig = tumIlanlar[aiIlan.id] || {};
          return {
            ...aiIlan,
            timestamp: orig.timestamp || 0,
            orijinalMetin: orig.text || aiIlan.orijinalMetin || '',
            cities: orig.cities || []
          };
        })
        // EN YENİDEN EN ESKİYE sırala
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    logEkle({ userId: req.user.id, action: 'ai_search', detail: soru.slice(0, 100), ipAddress: getIP(req) });
    res.json({ ok: true, sonuc });
  } catch (err) {
    console.error('Gemini hatası:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Gemini API çağrısı
function geminiIste(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,      // Düşük — tutarlı yanıtlar
        maxOutputTokens: 2048,
        responseMimeType: 'application/json'
      }
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) return reject(new Error('Boş yanıt'));
          // JSON parse
          const temiz = text.replace(/```json\n?|```/g, '').trim();
          resolve(JSON.parse(temiz));
        } catch (e) {
          reject(new Error('JSON parse hatası: ' + e.message));
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(15000, () => { request.destroy(); reject(new Error('Zaman aşımı')); });
    request.write(body);
    request.end();
  });
}

// ── İlan Rotaları ───────────────────────────────
let _store = null, _config = null;
function setStore(store, config) { _store = store; _config = config; }

// Normalize — server tarafında tek merkezi fonksiyon
const normS = s => String(s||'')
  .replace(/İ/g,'i').replace(/I/g,'i').replace(/ı/g,'i')
  .replace(/Ğ/g,'g').replace(/ğ/g,'g')
  .replace(/Ü/g,'u').replace(/ü/g,'u')
  .replace(/Ş/g,'s').replace(/ş/g,'s')
  .replace(/Ö/g,'o').replace(/ö/g,'o')
  .replace(/Ç/g,'c').replace(/ç/g,'c')
  .toLowerCase().trim();

// Şehri normalize edilmiş olarak CITIES listesinde bul
function sehirBul(input) {
  if (!input) return null;
  const ni = normS(input);
  // Önce tam eşleşme
  const tam = _config?.CITIES?.find(c => normS(c) === ni);
  if (tam) return tam;
  // il_ilce'de de ara
  const ilBilgi = getIlBilgisi(input);
  if (ilBilgi.il !== null) return ilBilgi.il;
  // İlçe olarak bul
  for (const [il, ilceler] of Object.entries(IL_ILCE)) {
    const bulunan = ilceler.find(i => normS(i) === ni);
    if (bulunan) return bulunan;
  }
  return null;
}

app.get('/api/ilanlar', authMiddleware, (req, res) => {
  const { sehir1, sehir2 } = req.query;
  let matchedTerms = [];

  if (sehir1) {
    // Şehri bul ve normalize et
    const bulunan1 = sehirBul(sehir1);
    const bulunan2 = sehir2 ? sehirBul(sehir2) : null;

    if (!bulunan1) return res.json({ ilanlar: [], matchedTerms: [], hata: `"${sehir1}" geçerli bir şehir veya ilçe değil` });
    if (sehir2 && !bulunan2) return res.json({ ilanlar: [], matchedTerms: [], hata: `"${sehir2}" geçerli bir şehir veya ilçe değil` });

    logEkle({ userId: req.user.id, action: 'search', detail: bulunan2 ? `${bulunan1} → ${bulunan2}` : bulunan1, ipAddress: getIP(req) });

    // matchedTerms: il + tüm ilçeleri highlight için
    const ilceler1 = getIlVeIlceleri(bulunan1);
    const ilceler2 = bulunan2 ? getIlVeIlceleri(bulunan2) : [];
    matchedTerms = [...ilceler1, ...ilceler2];
    // SQLite'tan sonuçları al — il + ilçe listesiyle genişletilmiş arama
    const dbRows = ilanAra(bulunan1, bulunan2 || null, ilceler1, ilceler2);
    const dbIlanlar = dbRows.map(r => ({
      ...r,
      cities: (() => { try { return JSON.parse(r.cities); } catch { return []; } })(),
      _kaynak: 'db'
    }));

    // RAM store'dan sonuçları al — ilçe listesi de gönder
    const ramIlanlar = _store ? _store.searchRaw(bulunan1, bulunan2 || null, ilceler1, ilceler2).map(i => ({
      ...i,
      _kaynak: 'ram'
    })) : [];

    // İkisini birleştir — hash bazlı duplicate temizle, en yenisi kazanır
    const hashMap = new Map();
    // Önce DB ekle
    for (const ilan of dbIlanlar) {
      const key = ilan.hash || String(ilan.id);
      hashMap.set(key, ilan);
    }
    // RAM'dakiler daha yeni olabilir, üzerine yaz (aynı hash varsa)
    for (const ilan of ramIlanlar) {
      const key = String(ilan._hash || ilan.hash);
      if (!hashMap.has(key)) hashMap.set(key, ilan);
    }

    const ilanlar = [...hashMap.values()]
      .sort((a, b) => b.timestamp - a.timestamp);

    return res.json({ ilanlar, matchedTerms, ilceler1, ilceler2 });
  }

  // Arama yoksa tüm ilanlar
  const rows = ilanAra(null, null);
  const ilanlar = rows.map(r => ({ ...r, cities: (() => { try { return JSON.parse(r.cities); } catch { return []; } })() }));
  res.json({ ilanlar, matchedTerms });
});

app.get('/api/stats', authMiddleware, (req, res) => {
  res.json({ total: ilanSayisi(), botDurumu: _store ? 'Çalışıyor' : 'Başlatılıyor', ttlDakika: _config ? _config.TTL_MS / 60000 : 60 });
});

app.get('/api/blacklist', authMiddleware, adminMiddleware, (req, res) => res.json(_config?.BLACKLIST || []));

app.post('/api/blacklist', authMiddleware, adminMiddleware, (req, res) => {
  const { kelime } = req.body;
  if (!kelime) return res.status(400).json({ error: 'Kelime gerekli' });
  if (_config && !_config.BLACKLIST.includes(kelime)) _config.BLACKLIST.push(kelime);
  res.json(_config?.BLACKLIST || []);
});

app.delete('/api/blacklist/:kelime', authMiddleware, adminMiddleware, (req, res) => {
  if (_config) _config.BLACKLIST = _config.BLACKLIST.filter(k => k !== req.params.kelime);
  res.json(_config?.BLACKLIST || []);
});

app.get('/api/sehirler', authMiddleware, (req, res) => {
  const sehirler = [];
  for (const [il, ilceler] of Object.entries(IL_ILCE)) {
    sehirler.push(il);
    ilceler.forEach(i => { if (!sehirler.includes(i)) sehirler.push(i); });
  }
  res.json({ sehirler: sehirler.sort() });
});

app.post('/api/ilan-olustur', authMiddleware, (req, res) => {
  const { metin } = req.body;
  if (!metin?.trim())      return res.status(400).json({ error: 'İlan metni boş olamaz' });
  if (metin.length > 1000) return res.status(400).json({ error: 'İlan metni en fazla 1000 karakter olabilir' });
  const user = kullaniciBul(req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  const tamMetin = metin.trim() + (user.phone ? '\n📞 ' + user.phone : '');
  const hash = crypto.createHash('md5').update(tamMetin + Date.now()).digest('hex');
  ilanEkle({ hash, text: tamMetin, cities: [], chatName: '🌐 ' + user.username, chatId: 'web', senderPhone: user.phone || '', timestamp: Date.now() });
  if (_store) _store.add('web_' + Date.now(), { text: tamMetin, cities: [], chatName: '🌐 ' + user.username, chatId: 'web', senderName: user.username, timestamp: Date.now() });
  res.json({ ok: true, message: 'İlan yayınlandı!' });
});

// ── Google OAuth ────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=google' }),
  (req, res) => {
    const user = req.user;
    logEkle({ userId: user.id, action: 'login', detail: 'google:' + user.username, ipAddress: getIP(req) });
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
    res.redirect(`/?google_token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar }))}`);
  }
);

function startServer(store, config) {
  setStore(store, config);
  app.listen(PORT, () => console.log(`🌐 YükleGit paneli: http://localhost:${PORT}`));
}

module.exports = { startServer };
