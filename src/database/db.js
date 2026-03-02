/**
 * YükleGit — SQLite Veritabanı Modülü
 * better-sqlite3 kullanır (senkron, hızlı, injection-safe)
 * Tüm sorgular parametrik — SQL injection imkânsız
 */

const Database = require('better-sqlite3');
const path     = require('path');

// Logger (varsa kullan)
let logger = null;
try {
  logger = require('../utils/bot-logger');
} catch (e) {
  // bot-logger bulunamadı, sessizce devam et
}

const DB_PATH = path.join(__dirname, '../../yuklegit.db');
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

  CREATE TABLE IF NOT EXISTS bots (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    isim      TEXT    NOT NULL DEFAULT 'Bot',
    clientId  TEXT    NOT NULL UNIQUE,
    durum     TEXT    NOT NULL DEFAULT 'bekliyor',
    telefon   TEXT    NOT NULL DEFAULT '',
    createdAt TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS consents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    userId      INTEGER NOT NULL UNIQUE,
    version     TEXT    NOT NULL DEFAULT 'v1',
    ipAddress   TEXT    NOT NULL DEFAULT '',
    consentedAt INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    userId      INTEGER NOT NULL,
    endpoint    TEXT    NOT NULL UNIQUE,
    p256dh      TEXT    NOT NULL DEFAULT '',
    auth        TEXT    NOT NULL DEFAULT '',
    sehirler    TEXT    NOT NULL DEFAULT '[]',
    device_type TEXT    NOT NULL DEFAULT 'web',
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migration: mevcut DB'de device_type kolonu yoksa ekle
try {
  const cols = db.prepare('PRAGMA table_info(push_subscriptions)').all();
  if (!cols.find(c => c.name === 'device_type')) {
    db.exec("ALTER TABLE push_subscriptions ADD COLUMN device_type TEXT NOT NULL DEFAULT 'web'");
    console.log('🔄 push_subscriptions: device_type kolonu eklendi');
  }
} catch (e) { /* zaten var */ }

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
    const result = _stmtIlanEkle.run({
      hash:        String(hash),
      text:        String(text),
      cities:      JSON.stringify(Array.isArray(cities) ? cities : []),
      chatName:    String(chatName || ''),
      chatId:      String(chatId   || ''),
      senderPhone: String(senderPhone || ''),
      timestamp:   Number(timestamp) || Date.now(),
    });

    if (logger && result.changes > 0) {
      logger.success('ILAN_SAVE', 'İlan başarıyla kaydedildi', {
        hash: hash,
        cities: cities,
        chatName: chatName,
      });
    }
  } catch (e) {
    // UNIQUE constraint = mükerrer ilan, sessizce geç
    if (!e.message.includes('UNIQUE')) {
      if (logger) {
        logger.error('ILAN_SAVE', 'İlan kaydedilemedi', e, { hash });
      } else {
        console.warn('ilanEkle hata:', e.message);
      }
    }
  }
}

/**
 * İlan ara — parametrik sorgular, injection-safe
 * İlçe listesini düzgün şekilde arar, il/ilçe sıralamasını doğru kontrol eder
 */
function ilanAra(sehir1, sehir2, ilceler1, ilceler2) {
  const startTime = Date.now();
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;

    if (!sehir1) {
      const results = _stmtIlanlarHepsi.all(since);
      if (logger) {
        logger.ilanSearch('(tümü)', '(tümü)', results.length, Date.now() - startTime);
      }
      return results;
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

    // Normalize et
    const nList1 = list1.map(s => normStr(s)).filter(Boolean);
    const nList2 = list2.map(s => normStr(s)).filter(Boolean);

    // SQL: tüm ilanları al (timestamp filtresiyle), sonra JavaScript'te kontrol et
    const sql = `SELECT * FROM ilanlar WHERE timestamp > ? ORDER BY timestamp DESC`;
    let rows = db.prepare(sql).all(since);

    // 1. Adım: list1'den en az biri ilanın metninde geçiyor mu?
    rows = rows.filter(r => {
      const normText = normStr(r.text);
      return nList1.some(city => normText.includes(city));
    });

    // 2. Adım: Eğer varış belirtilmişse, list2 de ilanın metninde geçmeli
    if (sehir2 && list2.length > 0) {
      rows = rows.filter(r => {
        const normText = normStr(r.text);
        return nList2.some(city => normText.includes(city));
      });

      // 3. Adım: Aynı satırda list1'den biri SONRA list2'den biri geç mi?
      // Bu sıralama önemli: başlangıç → varış
      rows = rows.filter(r => {
        const satirlar = r.text.split(/[\n\r]+/).map(s => normStr(s));
        for (const satir of satirlar) {
          // list1'den ilk eşleşen pozisyonu bul
          let p1 = -1;
          let firstCity1 = null;
          for (const n of nList1) {
            const idx = satir.indexOf(n);
            if (idx !== -1 && (p1 === -1 || idx < p1)) {
              p1 = idx;
              firstCity1 = n;
            }
          }
          if (p1 === -1) continue;

          // list2'den ilk eşleşen pozisyonu bul
          let p2 = -1;
          let firstCity2 = null;
          for (const n of nList2) {
            const idx = satir.indexOf(n);
            if (idx !== -1 && (p2 === -1 || idx < p2)) {
              p2 = idx;
              firstCity2 = n;
            }
          }

          // list2'den biri p1'den sonra mı?
          if (p2 !== -1 && p2 > p1) return true;
        }
        return false;
      });
    }

    if (logger) {
      logger.ilanSearch(sehir1 || '?', sehir2 || '?', rows.length, Date.now() - startTime);
    }

    return rows;
  } catch (e) {
    if (logger) {
      logger.error('SEARCH_PROCESS', 'İlan arama başarısız', e, {
        sehir1,
        sehir2,
        duration: Date.now() - startTime
      });
    }
    return [];
  }
}

/**
 * Aynı içeriğin eski versiyonunu sil, yenisini ekle
 * contentHashStr: sayısal hash (zaman dilimi olmadan)
 * hash: tam hash (contentHashStr + '_' + timeBucket)
 */
function ilanGuncelleEkle({ contentHashStr, hash, text, cities, chatName, chatId, senderPhone, timestamp }) {
  // Aynı içeriğin önceki zaman dilimindeki kaydını sil
  db.prepare("DELETE FROM ilanlar WHERE hash GLOB ? AND hash != ?")
    .run(contentHashStr + '_*', hash);
  // Yeni ilanı ekle
  ilanEkle({ hash, text, cities, chatName, chatId, senderPhone, timestamp });
}

/**
 * Eski ilanları temizle (24 saatten eski)
 */
function ilanTemizle() {
  try {
    const since  = Date.now() - 24 * 60 * 60 * 1000;
    const result = db.prepare('DELETE FROM ilanlar WHERE timestamp < ?').run(since);
    if (result.changes > 0) {
      if (logger) {
        logger.info('DATABASE', `${result.changes} eski ilan silindi`, {
          deletedCount: result.changes
        });
      }
      console.log(`🗑️  ${result.changes} eski ilan silindi.`);
    }
  } catch (e) {
    if (logger) {
      logger.error('DATABASE', 'İlan temizleme başarısız', e);
    }
  }
}

/**
 * Toplam aktif ilan sayısı
 */
function ilanSayisi() {
  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const result = db.prepare('SELECT COUNT(*) as n FROM ilanlar WHERE timestamp > ?').get(since);
    return result.n;
  } catch (e) {
    if (logger) {
      logger.error('DATABASE', 'İlan sayısı hesaplama başarısız', e);
    }
    return 0;
  }
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
  db.prepare('DELETE FROM push_subscriptions WHERE userId = ?').run(id);
  db.prepare('DELETE FROM consents WHERE userId = ?').run(id);
  db.prepare('DELETE FROM logs WHERE userId = ?').run(id);
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

// ══════════════════════════════════════════════
// WEB PUSH ABONELİK FONKSİYONLARI
// ══════════════════════════════════════════════

function pushAboneEkle({ userId, endpoint, p256dh = '', auth = '', sehirler, device_type = 'web' }) {
  db.prepare(`
    INSERT INTO push_subscriptions (userId, endpoint, p256dh, auth, sehirler, device_type)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      userId      = excluded.userId,
      p256dh      = excluded.p256dh,
      auth        = excluded.auth,
      sehirler    = excluded.sehirler,
      device_type = excluded.device_type
  `).run(
    userId,
    endpoint,
    p256dh,
    auth,
    JSON.stringify(Array.isArray(sehirler) ? sehirler : []),
    device_type,
  );
}

function pushAboneSil(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
}

function tumPushAboneler() {
  return db.prepare('SELECT * FROM push_subscriptions').all();
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
// BOT FONKSİYONLARI
// ══════════════════════════════════════════════

function botEkle({ isim, clientId }) {
  try {
    const var_ = db.prepare('SELECT id FROM bots WHERE clientId = ?').get(clientId);
    if (var_) return var_.id;
    const r = db.prepare('INSERT INTO bots (isim, clientId, durum) VALUES (?, ?, ?)').run(isim, clientId, 'bekliyor');
    if (logger) {
      logger.success('BOT_CREATE', 'Bot veritabanına eklendi', { isim, clientId });
    }
    return r.lastInsertRowid;
  } catch (e) {
    if (logger) {
      logger.error('BOT_CREATE', 'Bot eklenirken hata', e, { isim, clientId });
    }
    return null;
  }
}

function botGuncelle(clientId, updates) {
  try {
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE bots SET ${fields} WHERE clientId = @clientId`).run({ ...updates, clientId });
    if (logger) {
      logger.info('DATABASE', 'Bot güncellendi', { clientId, updates });
    }
  } catch (e) {
    if (logger) {
      logger.error('DATABASE', 'Bot güncelleme başarısız', e, { clientId });
    }
  }
}

function botSil(clientId) {
  db.prepare('DELETE FROM bots WHERE clientId = ?').run(clientId);
}

function tumBotlar() {
  return db.prepare('SELECT * FROM bots ORDER BY createdAt ASC').all();
}

function botBul(clientId) {
  return db.prepare('SELECT * FROM bots WHERE clientId = ?').get(clientId);
}

// ══════════════════════════════════════════════
// RIZA / CONSENT FONKSİYONLARI
// ══════════════════════════════════════════════

function rizaKaydet({ userId, version, ipAddress }) {
  db.prepare(`
    INSERT OR REPLACE INTO consents (userId, version, ipAddress, consentedAt)
    VALUES (?, ?, ?, ?)
  `).run(Number(userId), String(version || 'v1'), String(ipAddress || ''), Date.now());
}

function rizaVarMi(userId) {
  const row = db.prepare('SELECT id FROM consents WHERE userId = ?').get(Number(userId));
  return !!row;
}

// ══════════════════════════════════════════════

module.exports = {
  db,
  // İlan
  ilanEkle, ilanGuncelleEkle, ilanAra, ilanTemizle, ilanSayisi,
  // Kullanıcı
  kullaniciBul, kullaniciBulUsername, kullaniciBulEmail,
  kullaniciBulGoogleId, kullaniciEkle, kullaniciGuncelle,
  tumKullanicilar, kullaniciSil,
  // Log
  logEkle, loglariGetir,
  // Bot
  botEkle, botGuncelle, botSil, tumBotlar, botBul,
  // Rıza
  rizaKaydet, rizaVarMi,
  // Push Abonelik
  pushAboneEkle, pushAboneSil, tumPushAboneler,
};
