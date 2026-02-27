#!/usr/bin/env node

/**
 * Bot Test Makinesi
 *
 * Kullanım:
 * node bot-test.js          = Tüm testleri çalıştır
 * node bot-test.js quick    = Hızlı testler (veritabanı, logger)
 * node bot-test.js db       = Sadece veritabanı testleri
 * node bot-test.js logger   = Sadece logger testleri
 */

const fs = require('fs');
const path = require('path');

const colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  CYAN: '\x1b[36m',
  GRAY: '\x1b[90m',
};

let passCount = 0;
let failCount = 0;

/**
 * Test başarılı
 */
function pass(message) {
  console.log(`${colors.GREEN}✅ PASS${colors.RESET} - ${message}`);
  passCount++;
}

/**
 * Test başarısız
 */
function fail(message, error) {
  console.log(`${colors.RED}❌ FAIL${colors.RESET} - ${message}`);
  if (error) console.log(`   ${colors.GRAY}${error}${colors.RESET}`);
  failCount++;
}

/**
 * Başlık
 */
function section(title) {
  console.log(`\n${colors.CYAN}${'═'.repeat(60)}${colors.RESET}`);
  console.log(`${colors.CYAN}🧪 ${title}${colors.RESET}`);
  console.log(`${colors.CYAN}${'═'.repeat(60)}${colors.RESET}\n`);
}

/**
 * Özet
 */
function summary() {
  console.log(`\n${colors.CYAN}${'═'.repeat(60)}${colors.RESET}`);
  console.log(`${colors.CYAN}📊 TEST ÖZETI${colors.RESET}`);
  console.log(`${colors.CYAN}${'═'.repeat(60)}${colors.RESET}\n`);

  const total = passCount + failCount;
  const percentage = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const statusColor = failCount === 0 ? colors.GREEN : colors.YELLOW;

  console.log(`${colors.GREEN}✅ Başarılı${colors.RESET}: ${passCount}`);
  console.log(`${colors.RED}❌ Başarısız${colors.RESET}: ${failCount}`);
  console.log(`📊 Toplam   : ${total}`);
  console.log(`📈 Başarı Oranı: ${statusColor}${percentage}%${colors.RESET}\n`);

  if (failCount === 0) {
    console.log(`${colors.GREEN}🎉 TÜM TESTLER BAŞARILI!${colors.RESET}\n`);
  } else {
    console.log(`${colors.YELLOW}⚠️  ${failCount} TEST HATA VERDİ - DIKKATİ KONTROL EDİN${colors.RESET}\n`);
  }
}

/**
 * Logger Testleri
 */
function testLogger() {
  section('LOGGER MODÜLÜ TESTLERİ');

  try {
    const logger = require('./bot-logger');
    pass('Logger modülü yüklendi');

    // Logger metotlarını kontrol et
    const methods = [
      'success', 'info', 'warn', 'error', 'debug',
      'botStart', 'dbCheck', 'whatsappClient', 'messageReceived',
      'ilanSearch', 'getErrorReport', 'getSuccessReport'
    ];

    methods.forEach(method => {
      if (typeof logger[method] === 'function') {
        pass(`Logger.${method}() metodu var`);
      } else {
        fail(`Logger.${method}() metodu yok`);
      }
    });

    // Test log yazma
    logger.info('TEST', 'Test log girişi yazılıyor', { test: true });
    pass('Test log girişi yazıldı');

  } catch (e) {
    fail('Logger yükleme başarısız', e.message);
  }
}

/**
 * Veritabanı Testleri
 */
function testDatabase() {
  section('VERİTABANI MODÜLÜ TESTLERİ');

  try {
    const db = require('../database/db');
    pass('Veritabanı modülü yüklendi');

    // Export edilen fonksiyonları kontrol et
    const functions = [
      'ilanEkle', 'ilanAra', 'ilanTemizle', 'ilanSayisi',
      'kullaniciBul', 'kullaniciEkle',
      'botEkle', 'botGuncelle', 'botBul', 'tumBotlar'
    ];

    functions.forEach(fn => {
      if (typeof db[fn] === 'function') {
        pass(`db.${fn}() fonksiyonu var`);
      } else {
        fail(`db.${fn}() fonksiyonu yok`);
      }
    });

    // Test: İlan ekle
    try {
      db.ilanEkle({
        hash: 'test-' + Date.now(),
        text: 'TEST: Istanbul - Ankara',
        cities: ['Istanbul', 'Ankara'],
        chatName: 'Test Chat',
        chatId: 'test-chat-id',
        senderPhone: '+90555555555',
        timestamp: Date.now()
      });
      pass('Test ilanı eklendi');
    } catch (e) {
      fail('Test ilanı eklenemedi', e.message);
    }

    // Test: İlan ara
    try {
      const results = db.ilanAra('Istanbul', 'Ankara');
      pass(`İlan araması yapıldı (${results.length} sonuç)`);
    } catch (e) {
      fail('İlan araması başarısız', e.message);
    }

    // Test: İlan sayısı
    try {
      const count = db.ilanSayisi();
      pass(`İlan sayısı alındı (${count} aktif ilan)`);
    } catch (e) {
      fail('İlan sayısı hesaplama başarısız', e.message);
    }

    // Test: Bot ekle
    try {
      db.botEkle({ isim: 'Test Bot', clientId: 'test-client-' + Date.now() });
      pass('Test bot eklendi');
    } catch (e) {
      fail('Test bot eklenemedi', e.message);
    }

  } catch (e) {
    fail('Veritabanı modülü yükleme başarısız', e.message);
  }
}

/**
 * Dosya Yapısı Testleri
 */
function testFileStructure() {
  section('DOSYA YAPISI TESTLERİ');

  const files = [
    '../../src/bot/index.js',
    '../../src/database/db.js',
    '../../src/utils/bot-logger.js',
    '../../src/utils/bot-diagnostics.js',
    '../../BOT_LOGGING_GUIDE.md',
    '../../package.json',
    '../../src/web/server.js'
  ];

  files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const size = fs.statSync(filePath).size;
      pass(`${file} var (${(size / 1024).toFixed(1)} KB)`);
    } else {
      fail(`${file} yok`);
    }
  });

  // Log dizini kontrol et
  const logsDir = path.join(__dirname, '../../logs');
  if (fs.existsSync(logsDir)) {
    const logFiles = fs.readdirSync(logsDir);
    pass(`logs/ dizini var (${logFiles.length} dosya)`);
  } else {
    console.log(`${colors.YELLOW}⚠️  logs/ dizini bulunamadı (bot çalışmadan oluşturulacak)${colors.RESET}`);
  }
}

/**
 * İndeks Dosyası Kontrol
 */
function testIndexFile() {
  section('İNDEKS DOSYASI KONTROL');

  try {
    const indexPath = path.join(__dirname, '../../src/bot/index.js');
    const content = fs.readFileSync(indexPath, 'utf8');

    // Logger import kontrolü
    if (content.includes("require('../utils/bot-logger')")) {
      pass('Logger import\'u var');
    } else {
      fail('Logger import\'u yok');
    }

    // Logger.botStart() kontrolü
    if (content.includes('logger.botStart')) {
      pass('logger.botStart() çağrısı var');
    } else {
      fail('logger.botStart() çağrısı yok');
    }

    // MESSAGE_RECEIVED logging kontrolü
    if (content.includes('logger.messageReceived')) {
      pass('Mesaj alımı logging\'i var');
    } else {
      fail('Mesaj alımı logging\'i yok');
    }

    // ILAN_SAVE logging kontrolü
    if (content.includes('logger.success') && content.includes('ILAN_SAVE')) {
      pass('İlan kaydetme logging\'i var');
    } else {
      fail('İlan kaydetme logging\'i yok');
    }

    // Error handler logging kontrolü
    if (content.includes('logger.error') || content.includes('process.on')) {
      pass('Error handler logging\'i var');
    } else {
      fail('Error handler logging\'i yok');
    }

  } catch (e) {
    fail('İndeks dosyası okunamadı', e.message);
  }
}

/**
 * Konfigürasyon Kontrolü
 */
function testConfiguration() {
  section('YAPILANDIRMA KONTROL');

  try {
    const packagePath = path.join(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

    // Gerekli dependencies kontrol
    const requiredDeps = [
      'whatsapp-web.js',
      'better-sqlite3',
      'express',
      'dotenv'
    ];

    requiredDeps.forEach(dep => {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        pass(`Dependency: ${dep} (${pkg.dependencies[dep]})`);
      } else {
        fail(`Dependency eksik: ${dep}`);
      }
    });

    // .env dosyası kontrol
    const envPath = path.join(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      pass('.env dosyası var');
    } else {
      console.log(`${colors.YELLOW}ℹ️  .env dosyası bulunamadı (gerekli olabilir)${colors.RESET}`);
    }

  } catch (e) {
    fail('Konfigürasyon okunamadı', e.message);
  }
}

/**
 * Ana fonksiyon
 */
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  console.log(`\n${colors.CYAN}╔═════════════════════════════════════════╗${colors.RESET}`);
  console.log(`${colors.CYAN}║${colors.RESET}      BOT TEST MAKINESI - BAŞLADI      ${colors.CYAN}║${colors.RESET}`);
  console.log(`${colors.CYAN}╚═════════════════════════════════════════╝${colors.RESET}`);

  switch (testType.toLowerCase()) {
    case 'logger':
      testLogger();
      break;

    case 'db':
    case 'database':
      testDatabase();
      break;

    case 'quick':
      testLogger();
      testDatabase();
      testFileStructure();
      break;

    case 'all':
    default:
      testFileStructure();
      testConfiguration();
      testIndexFile();
      testLogger();
      testDatabase();
      break;
  }

  summary();

  // Exit kodu
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(console.error);
