/**
 * YükleGit — SQLite Veritabanı Modülü
 * better-sqlite3 kullanır (senkron, hızlı, injection-safe)
 * Tüm sorgular parametrik — SQL injection imkânsız
 */

const Database = require('better-sqlite3');
const path     = require('path');

const DB_PATH = path.join(__dirname, 'yuklegit.db');
const db      = new Database(DB_PATH);

// ── Performans ayarları ─────────────────────────
db.pragma('journal_mode = WAL');   // Eş zamanlı okuma/yazma
db.pragma('foreign_keys = ON');    // FK kısıtlamaları aktif
db.pragma('synchronous = NORMAL'); // Hız/güvenlik dengesi

// ── Tablo Oluşturma ─────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS ilanlar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hash        TEXT    NOT NULL UNIQUE,
    text        TEXT    NOT NULL,
    cities      TEXT    NOT NULL DEFAULT '[]',
    chatName    TEXT    NOT NULL DEFAULT '',
    chatId      TEXT    NOT NULL DEFAULT '',
    senderPhone TEXT    NOT NULL DEFAULT '',
    timestamp   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ilanlar_timestamp ON ilanlar(timestamp);
  CREATE INDEX IF NOT EXISTS idx_ilanlar_cities    ON ilanlar(cities);

  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    email      TEXT    NOT NULL UNIQUE,
    phone      TEXT    NOT NULL DEFAULT '',
    password   TEXT,
    googleId   TEXT    UNIQUE,
    avatar     TEXT    NOT NULL DEFAULT '',
    role       TEXT    NOT NULL DEFAULT 'user',
    verified   INTEGER NOT NULL DEFAULT 0,
    createdAt  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    INTEGER NOT NULL,
    action    TEXT    NOT NULL,
    detail    TEXT    NOT NULL DEFAULT '',
    ipAddress TEXT    NOT NULL DEFAULT '',
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_logs_userId    ON logs(userId);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
`);

// ── Admin yoksa oluştur ─────────────────────────
const bcrypt = require('bcryptjs');
const adminVar = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminVar) {
  db.prepare(`
    INSERT INTO users (username, email, password, role, verified)
    VALUES (?, ?, ?, 'admin', 1)
  `).run('admin', 'admin@yuklegit.com', bcrypt.hashSync('admin123', 10));
  console.log('👤 Admin oluşturuldu: admin / admin123');
}

// ══════════════════════════════════════════════
// İLAN FONKSİYONLARI
// ══════════════════════════════════════════════

const _stmtIlanEkle = db.prepare(`
  INSERT OR IGNORE INTO ilanlar (hash, text, cities, chatName, chatId, senderPhone, timestamp)
  VALUES (@hash, @text, @cities, @chatName, @chatId, @senderPhone, @timestamp)
`);

const _stmtIlanlarHepsi = db.prepare(`
  SELECT * FROM ilanlar
  WHERE timestamp > ?
  ORDER BY timestamp DESC
  LIMIT 500
`);

const _stmtIlanSehir1 = db.prepare(`
  SELECT * FROM ilanlar
  WHERE timestamp > ?
    AND cities LIKE ?
  ORDER BY timestamp DESC
  LIMIT 200
`);

/**
 * İlan ekle — hash UNIQUE olduğu için mükerrer ilan otomatik atlanır
 * SQL injection: tüm değerler parametre olarak bağlı, asla string concat yok
 */
function ilanEkle({ hash, text, cities, chatName, chatId, senderPhone, timestamp }) {
  try {
    _stmtIlanEkle.run({
      hash:        String(hash),
      text:        String(text),
      cities:      JSON.stringify(Array.isArray(cities) ? cities : []),
      chatName:    String(chatName || ''),
      chatId:      String(chatId   || ''),
      senderPhone: String(senderPhone || ''),
      timestamp:   Number(timestamp) || Date.now(),
    });
  } catch (e) {
    // UNIQUE constraint = mükerrer ilan, sessizce geç
    if (!e.message.includes('UNIQUE')) console.warn('ilanEkle hata:', e.message);
  }
}

/**
 * İlan ara — parametrik sorgular, injection-safe
 */
function ilanAra(sehir1, sehir2, ilceler1, ilceler2) {
  const since = Date.now() - 24 * 60 * 60 * 1000;

  if (!sehir1) {
    return _stmtIlanlarHepsi.all(since);
  }

  const normStr = s => String(s||'')
    .replace(/İ/g,'i').replace(/I/g,'i').replace(/ı/g,'i')
    .replace(/Ğ/g,'g').replace(/ğ/g,'g')
    .replace(/Ü/g,'u').replace(/ü/g,'u')
    .replace(/Ş/g,'s').replace(/ş/g,'s')
    .replace(/Ö/g,'o').replace(/ö/g,'o')
    .replace(/Ç/g,'c').replace(/ç/g,'c')
    .toLowerCase().trim()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // il + tüm ilçeler listesi (verilmemişse sadece şehir adı)
  const list1 = ilceler1 && ilceler1.length ? ilceler1 : [sehir1];
  const list2 = ilceler2 && ilceler2.length ? ilceler2 : (sehir2 ? [sehir2] : []);

  // SQL: cities JSON'ında list1'deki herhangi bir şehir geçiyor mu?
  const placeholders1 = list1.map(() => '?').join(' OR cities LIKE ');
  const sql = `SELECT * FROM ilanlar WHERE timestamp > ? AND (cities LIKE ${placeholders1})`;
  const params = [since, ...list1.map(s => `%"${s.toLowerCase()}"%`)];
  let rows = db.prepare(sql).all(...params);

  if (sehir2 && list2.length) {
    const nList1 = list1.map(s => normStr(s)).filter(Boolean);
    const nList2 = list2.map(s => normStr(s)).filter(Boolean);

    rows = rows.filter(r => {
      // Satır bazlı: aynı satırda list1'den biri solda, list2'den biri sağda mı?
      const satirlar = r.text.split(/[\n\r]+/).map(s => normStr(s));
      for (const satir of satirlar) {
        // list1'den ilk eşleşen pozisyonu bul (en küçük)
        let p1 = Infinity;
        for (const n of nList1) {
          const idx = satir.indexOf(n);
          if (idx !== -1 && idx < p1) p1 = idx;
        }
        if (p1 === Infinity) continue;

        // list2'den herhangi biri p1'den sonra mı?
        for (const n of nList2) {
          const p2 = satir.indexOf(n);
          if (p2 !== -1 && p2 > p1) return true;
        }
      }
      return false;
    });
  } else if (!sehir2) {
    // Tek şehir araması: sadece cities'de var mı yeterli (SQL zaten filtredi)
  }

  return rows;
}

/**
 * Eski ilanları temizle (24 saatten eski)
 */
function ilanTemizle() {
  const since  = Date.now() - 24 * 60 * 60 * 1000;
  const result = db.prepare('DELETE FROM ilanlar WHERE timestamp < ?').run(since);
  if (result.changes > 0) console.log(`🗑️  ${result.changes} eski ilan silindi.`);
}

/**
 * Toplam aktif ilan sayısı
 */
function ilanSayisi() {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return db.prepare('SELECT COUNT(*) as n FROM ilanlar WHERE timestamp > ?').get(since).n;
}

// Her saat temizle
setInterval(ilanTemizle, 60 * 60 * 1000);

// ══════════════════════════════════════════════
// KULLANICI FONKSİYONLARI
// ══════════════════════════════════════════════

function kullaniciBul(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function kullaniciBulUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function kullaniciBulEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function kullaniciBulGoogleId(googleId) {
  return db.prepare('SELECT * FROM users WHERE googleId = ?').get(googleId);
}

function kullaniciEkle({ username, email, phone, password, googleId, avatar, role, verified }) {
  const stmt = db.prepare(`
    INSERT INTO users (username, email, phone, password, googleId, avatar, role, verified)
    VALUES (@username, @email, @phone, @password, @googleId, @avatar, @role, @verified)
  `);
  const result = stmt.run({
    username:  String(username  || ''),
    email:     String(email     || ''),
    phone:     String(phone     || ''),
    password:  password || null,
    googleId:  googleId || null,
    avatar:    String(avatar || ''),
    role:      String(role || 'user'),
    verified:  verified ? 1 : 0,
  });
  return result.lastInsertRowid;
}

function kullaniciGuncelle(id, fields) {
  // Sadece izin verilen alanları güncelle
  const allowed  = ['email', 'phone', 'password', 'avatar', 'verified', 'googleId'];
  const updates  = [];
  const values   = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(fields[key]);
    }
  }
  if (updates.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function tumKullanicilar() {
  return db.prepare('SELECT id, username, email, phone, role, verified, createdAt, googleId, avatar FROM users ORDER BY id').all();
}

function kullaniciSil(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ══════════════════════════════════════════════
// LOG FONKSİYONLARI
// ══════════════════════════════════════════════

const _stmtLogEkle = db.prepare(`
  INSERT INTO logs (userId, action, detail, ipAddress, timestamp)
  VALUES (@userId, @action, @detail, @ipAddress, @timestamp)
`);

function logEkle({ userId, action, detail, ipAddress }) {
  _stmtLogEkle.run({
    userId:    Number(userId) || 0,
    action:    String(action  || ''),
    detail:    String(detail  || ''),
    ipAddress: String(ipAddress || ''),
    timestamp: Date.now(),
  });
}

function loglariGetir(limit = 200) {
  return db.prepare(`
    SELECT l.id, l.userId, l.action, l.detail, l.ipAddress, l.timestamp,
           u.username, u.email, u.phone
    FROM logs l
    LEFT JOIN users u ON u.id = l.userId
    ORDER BY l.timestamp DESC
    LIMIT ?
  `).all(limit);
}

// ══════════════════════════════════════════════

module.exports = {
  db,
  // İlan
  ilanEkle, ilanAra, ilanTemizle, ilanSayisi,
  // Kullanıcı
  kullaniciBul, kullaniciBulUsername, kullaniciBulEmail,
  kullaniciBulGoogleId, kullaniciEkle, kullaniciGuncelle,
  tumKullanicilar, kullaniciSil,
  // Log
  logEkle, loglariGetir,
};
