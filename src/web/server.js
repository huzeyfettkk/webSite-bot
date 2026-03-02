require('dotenv').config();
/**
 * YükleGit - Web Sunucusu (SQLite entegreli)
 */

const express        = require('express');
const https          = require('https');
const fs             = require('fs');
const { getIlVeIlceleri, getIlBilgisi, IL_ILCE } = require('../config/il_ilce');
const jwt            = require('jsonwebtoken');
const bcrypt         = require('bcryptjs');
const path           = require('path');
const crypto         = require('crypto');
const session        = require('express-session');
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer     = require('nodemailer');
const xss            = require('xss');
const { secLog }     = require('../utils/security-logger');
const Joi            = require('joi');
const {
  ilanEkle, ilanAra, ilanSayisi,
  kullaniciBul, kullaniciBulUsername, kullaniciBulEmail,
  kullaniciBulGoogleId, kullaniciEkle, kullaniciGuncelle,
  tumKullanicilar, kullaniciSil,
  logEkle, loglariGetir,
  botEkle, botGuncelle, botSil, tumBotlar, botBul,
  rizaKaydet, rizaVarMi,
  pushAboneEkle, pushAboneSil, tumPushAboneler,
} = require('../database/db');

// ── Web Push (VAPID) — Firebase gerekmez ────────────────
let webpush = null;
let VAPID_PUBLIC  = '';
let VAPID_PRIVATE = '';
const VAPID_EMAIL = 'mailto:admin@yuklegit.tr';
const VAPID_FILE  = path.join(__dirname, '../../.vapid');
try {
  webpush = require('web-push');
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
    VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  } else {
    try {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
      VAPID_PUBLIC  = saved.publicKey;
      VAPID_PRIVATE = saved.privateKey;
    } catch {
      const keys    = webpush.generateVAPIDKeys();
      VAPID_PUBLIC  = keys.publicKey;
      VAPID_PRIVATE = keys.privateKey;
      fs.writeFileSync(VAPID_FILE, JSON.stringify(keys));
      console.log('🔑 VAPID anahtarları oluşturuldu (.vapid dosyasına kaydedildi)');
    }
  }
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('✅ Web Push (VAPID) hazır');
} catch (e) {
  console.warn('⚠️  web-push paketi yok — "npm install web-push" çalıştırın:', e.message);
}

// ── Firebase Admin (FCM — Android Native) ───────────────
let firebaseAdmin = null;
try {
  firebaseAdmin = require('firebase-admin');
  // Önce env değişkeni (JSON string), sonra dosya yolu, sonra Application Default Credentials
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = firebaseAdmin.credential.cert(sa);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = firebaseAdmin.credential.cert(require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT)));
  } else {
    credential = firebaseAdmin.credential.applicationDefault();
  }
  if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({ credential });
  }
  console.log('✅ Firebase Admin (FCM) hazır');
} catch (e) {
  console.warn('⚠️  firebase-admin yok veya yapılandırılmamış — Android push devre dışı:', e.message);
  firebaseAdmin = null;
}

// Normalize (push eşleştirme için)
const _normPush = s => String(s || '')
  .replace(/İ/g,'i').replace(/I/g,'i').replace(/ı/g,'i')
  .replace(/Ğ/g,'g').replace(/ğ/g,'g').replace(/Ü/g,'u').replace(/ü/g,'u')
  .replace(/Ş/g,'s').replace(/ş/g,'s').replace(/Ö/g,'o').replace(/ö/g,'o')
  .replace(/Ç/g,'c').replace(/ç/g,'c').toLowerCase();

// Kelime sınırı eşleştirme — "van" artık "avantaj" içinde eşleşmez
function _kelimeEslesti(metin, sehir) {
  if (!sehir) return false;
  try {
    const esc = sehir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('\\b' + esc + '\\b').test(metin);
  } catch { return false; }
}

async function gonderPushBildirim({ text, hash, cities = [] }) {
  let aboneler;
  try { aboneler = tumPushAboneler(); } catch { return; }
  if (!aboneler.length) return;

  const normMetin = _normPush(text);

  for (const abone of aboneler) {
    let sehirler = [], nereden = [], nereye = [];
    try { sehirler = JSON.parse(abone.sehirler); } catch {}
    try { nereden  = JSON.parse(abone.nereden);  } catch {}
    try { nereye   = JSON.parse(abone.nereye);   } catch {}

    // 1. Bildirim şehirleri eşleşmesi (kelime sınırı ile — substring yok)
    const sehirEslesti = sehirler.find(s => _kelimeEslesti(normMetin, _normPush(s)));

    // 2. Son filtre eşleşmesi (nereden zorunlu, nereye opsiyonel)
    let filterEtiket = null;
    if (!sehirEslesti && nereden.length > 0) {
      const neredenNorm = nereden.map(_normPush);
      const neredenMatch = neredenNorm.find(s => _kelimeEslesti(normMetin, s));
      if (neredenMatch) {
        if (nereye.length === 0) {
          filterEtiket = nereden[neredenNorm.indexOf(neredenMatch)];
        } else {
          const nereyeNorm = nereye.map(_normPush);
          const nereyeMatch = nereyeNorm.find(s => _kelimeEslesti(normMetin, s));
          if (nereyeMatch) {
            filterEtiket = nereden[neredenNorm.indexOf(neredenMatch)]
              + ' → ' + nereye[nereyeNorm.indexOf(nereyeMatch)];
          }
        }
      }
    }

    const eslesen = sehirEslesti || filterEtiket;
    if (!eslesen) continue;

    const ozet  = (text || '').slice(0, 120);
    const baslik = '🚛 YükleGit — Yeni İlan';
    const govde  = String(eslesen).charAt(0).toUpperCase() + String(eslesen).slice(1) + ': ' + ozet;
    const tag    = 'ilan_' + (hash || Date.now());

    const deviceType = abone.device_type || 'web';

    // ── Android Native → Firebase Cloud Messaging ──
    if (deviceType === 'android_native') {
      if (!firebaseAdmin) continue;
      try {
        await firebaseAdmin.messaging().send({
          token: abone.endpoint,
          notification: { title: baslik, body: govde },
          data: { tag, url: '/', hash: String(hash || '') },
          android: {
            priority: 'high',
            notification: {
              channelId: 'yuklegit_ilanlar', // Kotlin'de bu channel oluşturulmalı
              icon: 'ic_notification',       // res/drawable içinde olmalı
              sound: 'default',
            },
          },
        });
      } catch (e) {
        // Token geçersiz / kayıtlı değil
        if (e.code === 'messaging/registration-token-not-registered' ||
            e.code === 'messaging/invalid-registration-token') {
          try { pushAboneSil(abone.endpoint); } catch {}
        }
      }
      continue;
    }

    // ── iOS / Desktop → Web Push (VAPID) ──
    if (!webpush || !VAPID_PUBLIC) continue;
    try {
      await webpush.sendNotification(
        { endpoint: abone.endpoint, keys: { p256dh: abone.p256dh, auth: abone.auth } },
        JSON.stringify({ title: baslik, body: govde, tag, url: '/' }),
        { TTL: 3600 }
      );
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        try { pushAboneSil(abone.endpoint); } catch {}
      }
    }
  }
}

const app    = express();
const helmet = require('helmet');
app.use(helmet({ contentSecurityPolicy: false }));

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

// ── Admin Güvenlik Yapılandırması ────────────────
const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET || SECRET + '_adm';
const ADMIN_WLIST  = (process.env.ADMIN_IP_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
const ADM_COOKIE   = 'adm_tok';
const ADM_TTL      = 4 * 60 * 60; // 4 saat (saniye)

let _admSid = null; // Tek admin oturum ID'si

// Brute force koruması: ip → { fails, lockedUntil, mult }
const _bfMap = new Map();
const BF_MAX  = 5;
const BF_BASE = 15 * 60 * 1000; // 15 dakika (ms)

function bfWait(ip) {
  const e = _bfMap.get(ip);
  if (!e || Date.now() >= e.lockedUntil) return 0;
  return Math.ceil((e.lockedUntil - Date.now()) / 1000);
}
function bfFail(ip) {
  let e = _bfMap.get(ip) || { fails: 0, lockedUntil: 0, mult: 1 };
  e.fails++;
  if (e.fails >= BF_MAX) {
    e.lockedUntil = Date.now() + BF_BASE * e.mult;
    e.mult = Math.min(e.mult * 2, 64); // her kilitlenmede süre 2 katına çıkar
    e.fails = 0;
  }
  _bfMap.set(ip, e);
}
function bfReset(ip) { _bfMap.delete(ip); }

// Rate limiter: ip → { count, resetAt }
const _rlMap = new Map();
function rlOver(ip, max, winMs) {
  const now = Date.now();
  let e = _rlMap.get(ip);
  if (!e || now > e.resetAt) { e = { count: 0, resetAt: now + winMs }; _rlMap.set(ip, e); }
  return ++e.count > max;
}

// Cookie parse (cookie-parser bağımlılığı olmadan)
function parseCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').find(c => c.trim().startsWith(name + '='));
  return m ? decodeURIComponent(m.split('=').slice(1).join('=').trim()) : null;
}

// IP whitelist — ADMIN_WLIST boşsa herkese açık
function ipWhitelist(req, res, next) {
  if (!ADMIN_WLIST.length) return next();
  if (!ADMIN_WLIST.includes(getIP(req))) return res.status(404).end();
  next();
}

// ── Joi Input Validation Şemaları ───────────────
const _J = { tlds: { allow: false } }; // e-posta TLD doğrulamasını kapat (Türkçe domain uyumu)
const S = {
  login:       Joi.object({ username: Joi.string().max(100).required(), password: Joi.string().max(200).required() }),
  register:    Joi.object({ username: Joi.string().pattern(/^[a-zA-Z0-9_\-]+$/).min(3).max(50).required(), email: Joi.string().email(_J).max(200).required(), password: Joi.string().min(6).max(200).required(), phone: Joi.string().max(25).required() }),
  adminLogin:  Joi.object({ u: Joi.string().max(100).required(), p: Joi.string().max(200).required() }),
  ilanOlustur: Joi.object({ metin: Joi.string().min(1).max(1000).required() }),
  profile:     Joi.object({ email: Joi.string().email(_J).max(200).optional(), phone: Joi.string().max(25).optional().allow(''), currentPassword: Joi.string().max(200).optional(), newPassword: Joi.string().min(6).max(200).optional() }),
  blacklist:   Joi.object({ kelime: Joi.string().max(100).required() }),
  userAdd:     Joi.object({ username: Joi.string().pattern(/^[a-zA-Z0-9_\-]+$/).min(3).max(50).required(), email: Joi.string().email(_J).max(200).optional().allow(''), password: Joi.string().min(6).max(200).required(), role: Joi.string().valid('user','admin').default('user') }),
  forgotPw:    Joi.object({ email: Joi.string().email(_J).max(200).required() }),
  resetPw:     Joi.object({ token: Joi.string().max(200).required(), password: Joi.string().min(6).max(200).required() }),
  botEkle:     Joi.object({ isim: Joi.string().max(100).required() }),
  aiAra:       Joi.object({ soru: Joi.string().min(1).max(500).required() }),
};
// validate(S.xxx) → Express middleware olarak kullan
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: true, allowUnknown: false, stripUnknown: true });
    if (error) return res.status(400).json({ error: error.details[0].message });
    req.body = value; // doğrulanmış + temizlenmiş değerler
    next();
  };
}

// ── CSRF — Double Submit Cookie (admin paneli) ──
// NOT: Ana API'ler JWT Bearer kullandığından CSRF'e karşı zaten korumalı.
// Sadece /yonetim-lgn form girişine uygulanır.
function setCsrfCookie(res) {
  const tok = crypto.randomBytes(24).toString('hex');
  res.setHeader('Set-Cookie', `csrf_tok=${tok}; SameSite=Strict; Path=/yonetim-lgn; Max-Age=3600`);
  return tok;
}
function verifyCsrf(req) {
  const cookie = parseCookie(req, 'csrf_tok');
  const header = req.headers['x-csrf-token'] || '';
  return !!(cookie && header && cookie === header);
}

// ── JWT Blacklist (logout & session invalidation) ──
const _jwtBlacklist = new Map(); // jti → expiresAtMs
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _jwtBlacklist) if (now > v) _jwtBlacklist.delete(k);
}, 3_600_000); // saatte bir temizle

function blacklistToken(token) {
  try {
    const p = jwt.decode(token);
    if (p?.jti && p?.exp) _jwtBlacklist.set(p.jti, p.exp * 1000);
  } catch {}
}
function isBlacklisted(jti) {
  if (!jti) return false;
  const exp = _jwtBlacklist.get(jti);
  if (!exp) return false;
  if (Date.now() > exp) { _jwtBlacklist.delete(jti); return false; }
  return true;
}

// jti (JWT ID) ile token üret — blacklist için gerekli
function signJWT(payload, opts = {}) {
  return jwt.sign({ ...payload, jti: crypto.randomBytes(8).toString('hex') }, SECRET, opts);
}

// ── XSS Sanitizasyon ────────────────────────────
const _xssOpts = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script','style'] };
function sanitizeDeep(v) {
  if (typeof v === 'string') return xss(v, _xssOpts);
  if (Array.isArray(v))      return v.map(sanitizeDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = sanitizeDeep(v[k]);
    return o;
  }
  return v;
}

// ── SQL Injection Tespiti ────────────────────────
// better-sqlite3 prepared statement kullandığı için injection imkânsız;
// bu katman WAF görevi görerek şüpheli istekleri loglar ve reddeder.
const _SQLI_RE = /--|\/\*|\*\/|\bUNION\b[\s\S]{0,30}\bSELECT\b|\bOR\b\s+\d+\s*=\s*\d+|\bxp_|\bDROP\b\s+\bTABLE\b/gi;
function hasSQLi(v) {
  if (typeof v === 'string') { _SQLI_RE.lastIndex = 0; return _SQLI_RE.test(v); }
  if (Array.isArray(v))      return v.some(hasSQLi);
  if (v && typeof v === 'object') return Object.values(v).some(hasSQLi);
  return false;
}

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
app.use(express.static(path.join(__dirname, '../../public')));

// Rate limiting — statik dosyalar bu noktaya ulaşmaz
app.use((req, res, next) => {
  if (!rlOver(getIP(req), 200, 60_000)) return next();
  const isApi = req.path.startsWith('/api/') || req.path.startsWith('/yonetim-lgn/');
  if (isApi) {
    secLog('rate_limit', { ip: getIP(req), path: req.path, ua: req.get('User-Agent') });
    return res.status(429).json({ error: 'Çok fazla istek. Lütfen bekleyin.' });
  }
  return res.status(429).send('<h2>429 — Çok fazla istek. Lütfen bekleyin.</h2>');
});

// XSS sanitizasyon + SQL injection tespiti — POST/PUT/PATCH body'leri
app.use((req, res, next) => {
  if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (hasSQLi(req.body)) {
      secLog('sqli_attempt', { ip: getIP(req), path: req.path, ua: req.get('User-Agent') });
      return res.status(400).json({ error: 'Geçersiz istek.' });
    }
    req.body = sanitizeDeep(req.body);
  }
  next();
});

// Ek HTTP güvenlik başlıkları (helmet'a ek)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',          'geolocation=(), microphone=(), camera=()');
  res.setHeader('Referrer-Policy',             'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy',  'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  next();
});

// Production: HTTP → HTTPS zorla
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https')
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    next();
  });
}

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
  // Header'dan veya query param'dan token al (SSE için query param gerekli)
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;
  if (!token) return res.status(401).json({ error: 'Token gerekli' });
  try {
    const payload = jwt.verify(token, SECRET);
    if (isBlacklisted(payload.jti)) return res.status(401).json({ error: 'Oturum sonlandırıldı. Tekrar giriş yapın.' });
    req.user = payload;
    next();
  } catch { res.status(401).json({ error: 'Geçersiz token' }); }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkisiz' });
  next();
}

// ── Auth Rotaları ───────────────────────────────

// Token geçerliliği kontrolü — frontend logout kararı için
app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

app.post('/api/login', validate(S.login), (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Bilgiler eksik' });
  const user = kullaniciBulUsername(username) || kullaniciBulEmail(username);
  if (!user || !user.password || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Kullanıcı adı/e-posta veya şifre hatalı' });
  if (!user.verified && user.role !== 'admin')
    return res.status(403).json({ error: 'E-posta adresiniz henüz doğrulanmadı.', needsVerification: true });

  logEkle({ userId: user.id, action: 'login', detail: user.username, ipAddress: getIP(req) });
  const token = signJWT({ id: user.id, username: user.username, email: user.email, role: user.role }, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: user.role, phone: user.phone } });
});

app.post('/api/register', validate(S.register), async (req, res) => {
  const { username, email, password, phone } = req.body;
  if (!username || !email || !password || !phone) return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin' });
  if (!/^[0-9]{10,15}$/.test(phone.replace(/[\s\-().+]/g,''))) return res.status(400).json({ error: 'Geçerli bir telefon numarası girin' });
  if (kullaniciBulUsername(username)) return res.status(400).json({ error: 'Bu kullanıcı adı zaten alınmış' });
  if (kullaniciBulEmail(email))       return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });

  // verified: true — e-posta doğrulama adımı kaldırıldı (sürtünme azaltma)
  const newId = kullaniciEkle({ username, email, phone, password: bcrypt.hashSync(password, 12), role: 'user', verified: true });
  logEkle({ userId: newId, action: 'register', detail: username, ipAddress: getIP(req) });
  const token = signJWT({ id: newId, username, email, role: 'user' }, { expiresIn: '30d' });
  res.json({ token, user: { id: newId, username, email, role: 'user', phone } });
});

app.get('/verify', (req, res) => {
  const data = _verifyTokens.get(req.query.token);
  if (!data || data.expires < Date.now()) return res.send('<h2>❌ Geçersiz veya süresi dolmuş link.</h2>');
  kullaniciGuncelle(data.userId, { verified: 1 });
  _verifyTokens.delete(req.query.token);
  res.redirect('/?verified=1');
});

app.post('/api/forgot-password', validate(S.forgotPw), async (req, res) => {
  const user = kullaniciBulEmail(req.body.email);
  if (user) {
    const rToken = genToken();
    _resetTokens.set(rToken, { userId: user.id, expires: Date.now() + 60*60*1000 });
    try { await sendResetMail(user.email, user.username, rToken); } catch(e) { console.warn('Mail gönderilemedi:', e.message); }
  }
  res.json({ ok: true });
});

app.post('/api/reset-password', validate(S.resetPw), (req, res) => {
  const { token, password } = req.body;
  const data = _resetTokens.get(token);
  if (!data || data.expires < Date.now()) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
  if (!password || password.length < 6)  return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  kullaniciGuncelle(data.userId, { password: bcrypt.hashSync(password, 12) });
  _resetTokens.delete(token);
  res.json({ ok: true });
});

app.put('/api/profile', authMiddleware, validate(S.profile), (req, res) => {
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
    updates.password = bcrypt.hashSync(newPassword, 12);
  }
  kullaniciGuncelle(user.id, updates);
  const u = kullaniciBul(user.id);
  res.json({ ok: true, user: { id: u.id, username: u.username, email: u.email, role: u.role, phone: u.phone } });
});

// ── Kullanıcı Yönetimi (Admin) ──────────────────
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => res.json(tumKullanicilar()));
app.get('/api/users/count', authMiddleware, adminMiddleware, (req, res) => res.json({ count: tumKullanicilar().length }));

app.post('/api/users', authMiddleware, adminMiddleware, validate(S.userAdd), (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
  if (kullaniciBulUsername(username)) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  const newId = kullaniciEkle({ username, email: email||'', password: bcrypt.hashSync(password, 12), role: role||'user', verified: true });
  res.json(kullaniciBul(newId));
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = Number(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: 'Geçersiz ID.' });
  if (req.user.id === targetId) return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
  kullaniciSil(targetId);
  logEkle({ userId: req.user.id, action: 'user_sil', detail: String(targetId), ipAddress: getIP(req) });
  res.json({ ok: true });
});

// ── Kendi Hesabını Silme (Normal Kullanıcı) ─────
app.delete('/api/account', authMiddleware, (req, res) => {
  const userId = req.user.id;
  if (req.user.role === 'admin') return res.status(400).json({ error: 'Admin hesabı silinemez.' });
  const tkn = req.headers.authorization?.split(' ')[1];
  if (tkn) blacklistToken(tkn);
  kullaniciSil(userId);
  res.json({ ok: true });
});

// ── Kullanıcı Hareketleri (Admin) ───────────────
app.get('/api/logs', authMiddleware, adminMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
  res.json(loglariGetir(limit));
});

// ── Logout Log ──────────────────────────────────
app.post('/api/logout', authMiddleware, (req, res) => {
  // Token'ı blacklist'e ekle — artık geçersiz
  const token = req.headers.authorization?.split(' ')[1];
  if (token) blacklistToken(token);
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


app.post('/api/ai-ara', authMiddleware, validate(S.aiAra), async (req, res) => {
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

// ── Gizlilik Politikası ─────────────────────────
app.get('/gizlilik', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/gizlilik.html'));
});

// ── KVKK Rıza API ───────────────────────────────
app.get('/api/consent/check', authMiddleware, (req, res) => {
  res.json({ hasConsent: rizaVarMi(req.user.id) });
});

app.post('/api/consent/save', authMiddleware, (req, res) => {
  rizaKaydet({ userId: req.user.id, version: 'v1', ipAddress: getIP(req) });
  logEkle({ userId: req.user.id, action: 'kvkk_consent', detail: 'v1', ipAddress: getIP(req) });
  res.json({ ok: true });
});

// ── İlan Rotaları ───────────────────────────────
let _store = null, _config = null, _botManager = null, _botOlustur = null, _botDurdur = null, _qrWaiters = null;
function setStore(store, config, botManager, botOlustur, botDurdur, qrWaiters) {
  _store = store; _config = config;
  _botManager = botManager; _botOlustur = botOlustur;
  _botDurdur = botDurdur; _qrWaiters = qrWaiters;
}

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
  // Önce CITIES config'de tam eşleşme
  const tam = _config?.CITIES?.find(c => normS(c) === ni);
  if (tam) return tam;
  // İl mi? → ilin adını döndür (tüm ilçeler dahil edilecek)
  for (const [il] of Object.entries(IL_ILCE)) {
    if (normS(il) === ni) return il;
  }
  // İlçe mi? → ilçenin kendi adını döndür (sadece o ilçe aranacak)
  for (const [, ilceler] of Object.entries(IL_ILCE)) {
    const bulunan = ilceler.find(i => normS(i) === ni);
    if (bulunan) return bulunan;
  }
  return null;
}

app.get('/api/ilanlar', authMiddleware, (req, res) => {
  const { sehir1, sehir2 } = req.query;
  let matchedTerms = [];
  let ilceler1 = [], ilceler2 = [];

  if (sehir1) {
    // Şehri bul ve normalize et
    const bulunan1 = sehirBul(sehir1);
    const bulunan2 = sehir2 ? sehirBul(sehir2) : null;

    if (!bulunan1) return res.json({ ilanlar: [], matchedTerms: [], hata: `"${sehir1}" geçerli bir şehir veya ilçe değil` });
    if (sehir2 && !bulunan2) return res.json({ ilanlar: [], matchedTerms: [], hata: `"${sehir2}" geçerli bir şehir veya ilçe değil` });

    logEkle({ userId: req.user.id, action: 'search', detail: bulunan2 ? `${bulunan1} → ${bulunan2}` : bulunan1, ipAddress: getIP(req) });

    // matchedTerms: il + tüm ilçeleri highlight için
    ilceler1 = getIlVeIlceleri(bulunan1);
    ilceler2 = bulunan2 ? getIlVeIlceleri(bulunan2) : [];
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

    // ── İlan metninde il/ilçe sıralamasını tespit et ──
    const ilanlarWithSeq = [...hashMap.values()].map(ilan => {
      const normStr = s => normS(s);
      const normText = normStr(ilan.text);

      const nList1 = ilceler1.map(s => normStr(s)).filter(Boolean);
      const nList2 = ilceler2.map(s => normStr(s)).filter(Boolean);

      // İlk geçen il/ilçe (list1'den)
      let ilanNereden = null;
      let ilanNedenidenIdx = Infinity;
      for (const n of nList1) {
        const idx = normText.indexOf(n);
        if (idx !== -1 && idx < ilanNedenidenIdx) {
          ilanNedenidenIdx = idx;
          ilanNereden = n;
        }
      }

      // İkinci geçen il/ilçe (list2'den)
      let ilanNereye = null;
      let ilanNereyeIdx = Infinity;
      if (nList2.length > 0) {
        for (const n of nList2) {
          const idx = normText.indexOf(n);
          if (idx !== -1 && idx > ilanNedenidenIdx && idx < ilanNereyeIdx) {
            ilanNereyeIdx = idx;
            ilanNereye = n;
          }
        }
      }

      // Eğer list2 yoksa veya bulunamadıysa, nList1'den ikinci geçeni ara
      if (!ilanNereye && nList1.length > 0) {
        let secondIdx = Infinity;
        for (const n of nList1) {
          // İlki zaten bulunmuş, ona sonra geçeni ara
          const idx = normText.indexOf(n, ilanNedenidenIdx + 1);
          if (idx !== -1 && idx < secondIdx) {
            secondIdx = idx;
            ilanNereye = n;
          }
        }
      }

      return {
        ...ilan,
        ilanNereden: ilanNereden || (ilceler1.length > 0 ? ilceler1[0] : null),
        ilanNereye: ilanNereye || (ilceler2.length > 0 ? ilceler2[0] : (ilceler1.length > 1 ? ilceler1[1] : null))
      };
    });

    // En yeni → en eski sırasına göre sor
    const ilanlar = ilanlarWithSeq.sort((a, b) => b.timestamp - a.timestamp);

    return res.json({ ilanlar, matchedTerms, ilceler1, ilceler2 });
  }

  // Arama yoksa tüm ilanlar (en yeniler önce)
  const rows = ilanAra(null, null);
  const ilanlar = rows.map(r => ({
    ...r,
    cities: (() => { try { return JSON.parse(r.cities); } catch { return []; } })(),
    ilanNereden: null,
    ilanNereye: null
  }));
  res.json({ ilanlar, matchedTerms });
});

// ── Web Push Abonelik Endpoint'leri ─────────────
app.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC || '' });
});

app.post('/api/push/abone', authMiddleware, (req, res) => {
  const { subscription, sehirler, nereden, nereye } = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth)
    return res.status(400).json({ error: 'Geçersiz abonelik verisi' });
  try {
    pushAboneEkle({
      userId:   req.user.id,
      endpoint: subscription.endpoint,
      p256dh:   subscription.keys.p256dh,
      auth:     subscription.keys.auth,
      sehirler: Array.isArray(sehirler) ? sehirler : [],
      nereden:  Array.isArray(nereden)  ? nereden  : [],
      nereye:   Array.isArray(nereye)   ? nereye   : [],
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Abonelik kaydedilemedi' }); }
});

app.delete('/api/push/abone', authMiddleware, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) try { pushAboneSil(endpoint); } catch {}
  res.json({ ok: true });
});

// ── Android Native: FCM Token Kayıt/Güncelle ────────────
// Kotlin uygulaması her başlangıçta bu endpoint'e FCM token gönderir
app.post('/api/push/fcm-token', authMiddleware, (req, res) => {
  const { fcmToken, sehirler } = req.body;
  if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.length < 10)
    return res.status(400).json({ error: 'Geçersiz FCM token' });
  try {
    pushAboneEkle({
      userId:      req.user.id,
      endpoint:    fcmToken,          // FCM token = unique ID olarak saklanır
      p256dh:      '',
      auth:        '',
      sehirler:    Array.isArray(sehirler) ? sehirler : [],
      device_type: 'android_native',
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'FCM token kaydedilemedi' }); }
});

// ── Bildirim: Yeni İlanlar (since + şehir listesi) ──
app.get('/api/ilanlar/yeni', authMiddleware, (req, res) => {
  const since   = parseInt(req.query.since) || 0;
  const sehirler = String(req.query.sehirler || '')
    .split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);

  if (!sehirler.length) return res.json({ ilanlar: [], serverTime: Date.now() });

  const seen  = new Set();
  const sonuc = [];

  for (const sehir of sehirler) {
    const bulunan = sehirBul(sehir);
    if (!bulunan) continue;
    const ilceler = getIlVeIlceleri(bulunan);
    const eslesme = ilanAra(bulunan, null, ilceler, []);
    for (const r of eslesme) {
      if (r.timestamp > since && !seen.has(r.hash)) {
        seen.add(r.hash);
        sonuc.push({
          hash:      r.hash,
          text:      r.text,
          timestamp: r.timestamp,
          cities:    (() => { try { return JSON.parse(r.cities); } catch { return []; } })(),
          eslesenSehir: bulunan,
        });
      }
    }
  }

  sonuc.sort((a, b) => b.timestamp - a.timestamp);
  res.json({ ilanlar: sonuc, serverTime: Date.now() });
});

app.get('/api/stats', authMiddleware, (req, res) => {
  res.json({ total: ilanSayisi(), botDurumu: _store ? 'Çalışıyor' : 'Başlatılıyor', ttlDakika: _config ? _config.TTL_MS / 60000 : 60 });
});

app.get('/api/blacklist', authMiddleware, adminMiddleware, (req, res) => res.json(_config?.BLACKLIST || []));

app.post('/api/blacklist', authMiddleware, adminMiddleware, validate(S.blacklist), (req, res) => {
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

app.post('/api/ilan-olustur', authMiddleware, validate(S.ilanOlustur), (req, res) => {
  const { metin } = req.body;
  if (!metin?.trim())      return res.status(400).json({ error: 'İlan metni boş olamaz' });
  if (metin.length > 1000) return res.status(400).json({ error: 'İlan metni en fazla 1000 karakter olabilir' });
  const user = kullaniciBul(req.user.id);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  if (!user.phone || !user.phone.trim()) {
    return res.status(403).json({ error: 'İlan verebilmek için profilinizden telefon numaranızı eklemeniz gerekiyor.' });
  }

  const tamMetin = metin.trim() + (user.phone ? '\n📞 ' + user.phone : '');
  const hash = crypto.createHash('md5').update(tamMetin + Date.now()).digest('hex');
  ilanEkle({ hash, text: tamMetin, cities: [], chatName: '🌐 ' + user.username, chatId: 'web', senderPhone: user.phone || '', timestamp: Date.now() });
  if (_store) _store.add('web_' + Date.now(), { text: tamMetin, cities: [], chatName: '🌐 ' + user.username, chatId: 'web', senderName: user.username, timestamp: Date.now() });
  res.json({ ok: true, message: 'İlan yayınlandı!' });
});

// ── Google OAuth ────────────────────────────────
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Mobil uygulama için — sistem tarayıcısından gelir, deep link'e yönlendirir
app.get('/auth/google/mobile', (req, res, next) => {
  req.session.oauthIsMobile = true;
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?error=google' }),
  (req, res) => {
    const user = req.user;
    logEkle({ userId: user.id, action: 'login', detail: 'google:' + user.username, ipAddress: getIP(req) });
    const token = signJWT({ id: user.id, username: user.username, email: user.email, role: user.role }, { expiresIn: '30d' });
    const userObj = { id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar };
    const userEnc = encodeURIComponent(JSON.stringify(userObj));

    if (req.session.oauthIsMobile) {
      req.session.oauthIsMobile = false;
      // Mobil: deep link ile uygulamaya dön
      return res.redirect(`yuklegit://auth?google_token=${token}&user=${userEnc}`);
    }
    res.redirect(`/?google_token=${token}&user=${userEnc}`);
  }
);

// ── Bot Yönetimi API ────────────────────────────

// Tüm botları listele
app.get('/api/bots', authMiddleware, adminMiddleware, (req, res) => {
  const dbBotlar = tumBotlar();
  // Canlı durum ile birleştir
  const bots = dbBotlar.map(b => {
    const live = _botManager?.get(b.clientId);
    return {
      ...b,
      durum:   live?.durum   || b.durum,
      telefon: live?.telefon || b.telefon || '',
      aktif:   !!live,
    };
  });
  res.json(bots);
});

// Yeni bot ekle
app.post('/api/bots', authMiddleware, adminMiddleware, validate(S.botEkle), (req, res) => {
  const { isim } = req.body;
  if (!isim?.trim()) return res.status(400).json({ error: 'Bot ismi gerekli' });
  const clientId = 'bot-' + Date.now();
  botEkle({ isim: isim.trim(), clientId });
  // Başlat
  _botOlustur?.(clientId, isim.trim());
  logEkle({ userId: req.user.id, action: 'bot_ekle', detail: isim, ipAddress: '' });
  res.json({ ok: true, clientId, isim: isim.trim() });
});

// Bot sil
app.delete('/api/bots/:clientId', authMiddleware, adminMiddleware, async (req, res) => {
  const { clientId } = req.params;
  await _botDurdur?.(clientId);
  botSil(clientId);
  // Session klasörünü de sil
  const path = require('path');
  const fs   = require('fs');
  const dir  = path.join(__dirname, '../../.wwebjs_auth', 'session-' + clientId);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  logEkle({ userId: req.user.id, action: 'bot_sil', detail: clientId, ipAddress: '' });
  res.json({ ok: true });
});

// Bot yeniden başlat
app.post('/api/bots/:clientId/restart', authMiddleware, adminMiddleware, async (req, res) => {
  const { clientId } = req.params;
  const bot = botBul(clientId);
  if (!bot) return res.status(404).json({ error: 'Bot bulunamadı' });
  await _botDurdur?.(clientId);
  setTimeout(() => _botOlustur?.(clientId, bot.isim), 2000);
  res.json({ ok: true });
});

// QR PNG endpoint — qrcode paketi ile PNG üret
app.get('/api/bots/:clientId/qr-image', authMiddleware, adminMiddleware, async (req, res) => {
  const { clientId } = req.params;
  const live = _botManager?.get(clientId);
  if (!live?.qrData) {
    console.log(`[qr-image] ${clientId} — qrData yok, durum: ${live?.durum}`);
    return res.status(404).json({ error: 'QR henüz hazır değil', durum: live?.durum || 'bilinmiyor' });
  }
  try {
    const QRCode = require('qrcode');
    const png = await QRCode.toBuffer(live.qrData, {
      width: 280, margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(png);
    console.log(`[qr-image] ${clientId} — PNG gönderildi (${png.length} byte)`);
  } catch (e) {
    console.error(`[qr-image] ${clientId} — Hata:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// QR SSE stream — bot bağlanana kadar QR verisi gönderir
app.get('/api/bots/:clientId/qr', authMiddleware, adminMiddleware, (req, res) => {
  const { clientId } = req.params;

  // SSE header'ları
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Bu bağlantıyı waiter listesine ekle
  if (!_qrWaiters.has(clientId)) _qrWaiters.set(clientId, []);
  const waiters = _qrWaiters.get(clientId);
  waiters.push(res);

  // Zaten QR varsa hemen gönder
  const live = _botManager?.get(clientId);
  if (live?.qrData) {
    res.write(`data: ${JSON.stringify({ tip: 'qr_hazir' })}\n\n`);
  } else if (live?.durum === 'hazir') {
    res.write(`data: ${JSON.stringify({ tip: 'hazir' })}\n\n`);
  }

  // Heartbeat — bağlantı canlı kalsın
  const hb = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch { clearInterval(hb); } }, 20000);

  req.on('close', () => {
    clearInterval(hb);
    const idx = waiters.indexOf(res);
    if (idx !== -1) waiters.splice(idx, 1);
  });
});

// ── Honeypot rotaları (bot tuzakları) ───────────
for (const p of ['admin','panel','dashboard','login','wp-admin','wp-login.php','phpmyadmin','manager']) {
  app.all('/' + p,        (_r, rs) => rs.status(200).set('Content-Type', 'text/html').send(''));
  app.all('/' + p + '/*', (_r, rs) => rs.status(200).set('Content-Type', 'text/html').send(''));
}

// ── Yönetim Paneli ──────────────────────────────
app.get('/yonetim-lgn', ipWhitelist, (req, res) => {
  setCsrfCookie(res); // CSRF token cookie'si ayarla
  res.sendFile(path.join(__dirname, '../../public/y-panel.html'));
});

app.post('/yonetim-lgn/giris', ipWhitelist, validate(S.adminLogin), (req, res) => {
  // CSRF doğrulama (Double Submit Cookie)
  if (!verifyCsrf(req)) {
    secLog('csrf_fail', { ip: getIP(req), ua: req.get('User-Agent') });
    return res.status(403).json({ error: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyin.' });
  }
  const ip   = getIP(req);
  const wait = bfWait(ip);
  if (wait > 0) return res.status(429).json({ error: `IP kilitli. ${wait} saniye bekleyin.`, wait });

  const { u, p } = req.body;
  if (!u || !p) return res.status(400).json({ error: 'Bilgiler eksik.' });

  const user  = kullaniciBulUsername(u) || kullaniciBulEmail(u);
  const valid = user && user.role === 'admin' && user.password && bcrypt.compareSync(p, user.password);

  if (!valid) {
    bfFail(ip);
    const w2 = bfWait(ip);
    secLog('admin_login_fail', { ip, user: u, ua: req.get('User-Agent'), locked: w2 > 0 });
    if (w2 > 0) return res.status(429).json({ error: `Çok fazla hatalı deneme. ${w2} saniye kilitli.`, wait: w2 });
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  bfReset(ip);
  secLog('admin_login_ok', { ip, user: u, ua: req.get('User-Agent') });
  // Tek oturum: yeni session ID eski oturumu geçersiz kılar
  _admSid = crypto.randomBytes(16).toString('hex');

  // HTTP-only admin cookie (4 saat, SameSite=Strict)
  const admTok = jwt.sign({ sid: _admSid, id: user.id }, ADMIN_SECRET, { expiresIn: ADM_TTL });
  res.setHeader('Set-Cookie',
    `${ADM_COOKIE}=${admTok}; HttpOnly; SameSite=Strict; Max-Age=${ADM_TTL}; Path=/`
  );

  // Ana uygulama için JWT (mevcut auth sistemi — 4 saatlik)
  const appTok  = signJWT({ id: user.id, username: user.username, email: user.email, role: user.role }, { expiresIn: '4h' });
  const userEnc = encodeURIComponent(JSON.stringify({
    id: user.id, username: user.username, email: user.email, role: user.role, phone: user.phone,
  }));

  logEkle({ userId: user.id, action: 'admin_login', detail: u, ipAddress: ip });
  res.json({ ok: true, redirect: `/?google_token=${appTok}&user=${userEnc}` });
});

app.get('/yonetim-lgn/cikis', (req, res) => {
  _admSid = null;
  res.setHeader('Set-Cookie', `${ADM_COOKIE}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/`);
  res.redirect('/yonetim-lgn');
});

// ── Security.txt ─────────────────────────────────
app.get('/.well-known/security.txt', (req, res) => {
  res.type('text/plain').send(
    'Contact: mailto:yuklegit.iletisim@gmail.com\n' +
    'Expires: 2026-12-31T00:00:00.000Z\n' +
    'Preferred-Languages: tr, en\n'
  );
});

// ── Global Hata Yakalayıcı ───────────────────────
// Stack trace ve dahili bilgileri gizler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[HATA]', err);
  secLog('server_error', { ip: getIP(req), path: req.path, message: err.message });
  res.status(500).json({ error: 'Bir hata oluştu. Lütfen tekrar deneyin.' });
});

function startServer(store, config, botManager, botOlustur, botDurdur, qrWaiters) {
  setStore(store, config, botManager, botOlustur, botDurdur, qrWaiters);

  // IP Whitelist uyarısı: private/NAT IP'ler production'da değişebilir
  if (ADMIN_WLIST.length > 0) {
    const _privRe = [/^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^127\./];
    const privIPs = ADMIN_WLIST.filter(ip => _privRe.some(r => r.test(ip)));
    if (privIPs.length) {
      console.warn(`⚠️  [GÜVENLİK] ADMIN_IP_WHITELIST'te private IP var: ${privIPs.join(', ')}`);
      console.warn('   Production\'da bu IP değişirse admin paneline erişim kesilir!');
      console.warn('   Çözüm: Sabit public IP veya VPN kullanın, ya da ADMIN_IP_WHITELIST boş bırakın.');
    }
  }

  app.listen(PORT, () => console.log(`🌐 YükleGit paneli: http://localhost:${PORT}`));
}

module.exports = { startServer, gonderPushBildirim };
