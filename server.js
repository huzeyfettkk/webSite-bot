/**
 * YükleGit - Web Sunucusu (SQLite entegreli)
 */

const express        = require('express');
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

app.use(express.json());
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

// ── İlan Rotaları ───────────────────────────────
let _store = null, _config = null;
function setStore(store, config) { _store = store; _config = config; }

app.get('/api/ilanlar', authMiddleware, (req, res) => {
  const { sehir1, sehir2 } = req.query;
  let matchedTerms = [];

  if (sehir1) {
    const norm = s => s
      .replace(/İ/g,'i').replace(/I/g,'i').replace(/ı/g,'i')
      .replace(/Ğ/g,'g').replace(/ğ/g,'g')
      .replace(/Ü/g,'u').replace(/ü/g,'u')
      .replace(/Ş/g,'s').replace(/ş/g,'s')
      .replace(/Ö/g,'o').replace(/ö/g,'o')
      .replace(/Ç/g,'c').replace(/ç/g,'c')
      .toLowerCase();
    const gecerliMi = s => {
      if (!s) return false;
      if (getIlBilgisi(s).il !== null) return true;
      return _config?.CITIES?.some(c => norm(c) === norm(s)) || false;
    };
    if (!gecerliMi(sehir1)) return res.json({ ilanlar: [], matchedTerms: [], hata: 'Geçerli bir şehir veya ilçe adı girin' });
    if (sehir2 && !gecerliMi(sehir2)) return res.json({ ilanlar: [], matchedTerms: [], hata: 'Geçerli bir şehir veya ilçe adı girin' });

    logEkle({ userId: req.user.id, action: 'search', detail: sehir2 ? `${sehir1} → ${sehir2}` : sehir1, ipAddress: getIP(req) });
    matchedTerms = [...getIlVeIlceleri(sehir1), ...(sehir2 ? getIlVeIlceleri(sehir2) : [])];
  }

  const rows = ilanAra(sehir1 || null, sehir2 || null);
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
