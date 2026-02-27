/**
 * Bot Hata Log Sistemi
 * Bot'un tüm adımlarını ve hatalarını kaydeder
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');

// logs klasörünü oluştur
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Log dosyasının path'i
const logFile = path.join(logsDir, `bot-${new Date().toISOString().split('T')[0]}.log.json`);

// Log verilerini depolama
let logs = [];

// Mevcut log dosyası varsa yükle
if (fs.existsSync(logFile)) {
  try {
    const existing = fs.readFileSync(logFile, 'utf8');
    logs = JSON.parse(existing);
  } catch (e) {
    logs = [];
  }
}

// Log seviyesi ve renkler (konsol çıktısı için)
const colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
};

const levelColors = {
  'DEBUG': colors.CYAN,
  'INFO': colors.BLUE,
  'WARN': colors.YELLOW,
  'ERROR': colors.RED,
  'SUCCESS': colors.GREEN,
};

/**
 * Log kaydı oluştur ve dosyaya yaz
 */
function log(level, step, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    step,
    message,
    data,
  };

  logs.push(logEntry);

  // Konsola yazdır (renkli)
  const color = levelColors[level] || colors.RESET;
  const icon = {
    'DEBUG': '🔍',
    'INFO': 'ℹ️',
    'WARN': '⚠️',
    'ERROR': '❌',
    'SUCCESS': '✅',
  }[level] || '•';

  const timestamp_log = new Date().toLocaleTimeString('tr-TR');
  console.log(
    `${color}${icon} [${timestamp_log}] ${level.padEnd(7)} | ${step.padEnd(20)} | ${message}${colors.RESET}`
  );

  if (Object.keys(data).length > 0) {
    console.log(`${color}   Data: ${JSON.stringify(data, null, 2)}${colors.RESET}`);
  }

  // Dosyaya yaz
  saveLogsToFile();
}

/**
 * Log dosyasına kaydet
 */
function saveLogsToFile() {
  try {
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error('Log dosyasına yazılamadı:', e.message);
  }
}

/**
 * Özel log fonksiyonları
 */
const logger = {
  // Başarılı işlem
  success: (step, message, data = {}) => log('SUCCESS', step, message, data),

  // Bilgi mesajı
  info: (step, message, data = {}) => log('INFO', step, message, data),

  // Hata mesajı
  error: (step, message, error, data = {}) => {
    const errorData = {
      ...data,
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || '',
      errorName: error?.name || 'Unknown',
    };
    log('ERROR', step, message, errorData);
  },

  // Uyarı
  warn: (step, message, data = {}) => log('WARN', step, message, data),

  // Debug
  debug: (step, message, data = {}) => log('DEBUG', step, message, data),

  // Bot başlangıç kontrol
  botStart: () => {
    logger.info('BOT_INIT', 'Bot başlatılıyor...', {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    });
  },

  // Veritabanı kontrol
  dbCheck: (success, count = 0, error = null) => {
    if (success) {
      logger.success('DATABASE', `Veritabanı başarılı, ${count} ilan var`, { ilanCount: count });
    } else {
      logger.error('DATABASE', 'Veritabanı bağlantı hatası', error, { error: String(error) });
    }
  },

  // WhatsApp client kontrol
  whatsappClient: (success, error = null) => {
    if (success) {
      logger.success('WHATSAPP_CLIENT', 'WhatsApp client başlatıldı');
    } else {
      logger.error('WHATSAPP_CLIENT', 'WhatsApp client başlatılamadı', error);
    }
  },

  // QR kod
  qrCode: (qr) => {
    logger.info('QR_CODE', 'QR kod oluşturuldu, tarayın', { qrLength: qr.length });
  },

  // Giriş başarılı
  ready: (phoneNumber = '') => {
    logger.success('WHATSAPP_READY', `WhatsApp hazır${phoneNumber ? ' - ' + phoneNumber : ''}`, {
      phoneNumber,
    });
  },

  // Mesaj alındı
  messageReceived: (from, message, hasMedia = false) => {
    logger.info('MESSAGE_RECEIVED', `Mesaj alındı: ${from}`, {
      from,
      text: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
      length: message.length,
      hasMedia,
    });
  },

  // Mesaj işleme
  processMessage: (from, city1, city2, success, count = 0, error = null) => {
    if (success) {
      logger.success('MESSAGE_PROCESS', `Mesaj işlendi: ${city1} → ${city2}`, {
        from,
        city1,
        city2,
        resultCount: count,
      });
    } else {
      logger.error('MESSAGE_PROCESS', `Mesaj işlenirken hata: ${city1}`, error, {
        from,
        city1,
        city2,
      });
    }
  },

  // Sonuç gönder
  messageSent: (to, count, success, error = null) => {
    if (success) {
      logger.success('MESSAGE_SENT', `${count} ilanlı mesaj gönderildi`, { to, ilanCount: count });
    } else {
      logger.error('MESSAGE_SENT', 'Mesaj gönderilemedi', error, { to });
    }
  },

  // HTTP server
  serverStart: (port, success, error = null) => {
    if (success) {
      logger.success('HTTP_SERVER', `Server başlatıldı - localhost:${port}`, { port });
    } else {
      logger.error('HTTP_SERVER', `Server başlatılamadı - Port ${port}`, error, { port });
    }
  },

  // Veritabanı işlemleri
  dbOperation: (operation, success, count = 0, error = null) => {
    if (success) {
      logger.success('DB_OPERATION', `${operation} başarılı - ${count} kayıt`, {
        operation,
        recordCount: count,
      });
    } else {
      logger.error('DB_OPERATION', `${operation} başarısız`, error, { operation });
    }
  },

  // Şehir kontrolü
  cityCheck: (input, found, city = '', isDistrict = false) => {
    if (found) {
      logger.success(
        'CITY_VALIDATION',
        `Şehir bulundu: "${input}" → "${city}" ${isDistrict ? '(İlçe)' : '(İl)'}`,
        { input, city, isDistrict }
      );
    } else {
      logger.warn('CITY_VALIDATION', `Şehir bulunamadı: "${input}"`, { input });
    }
  },

  // İlan arama
  ilanSearch: (city1, city2, count, duration) => {
    logger.info('ILAN_SEARCH', `Arama sonucu: ${count} ilan (${duration}ms)`, {
      city1,
      city2,
      resultCount: count,
      duration,
    });
  },

  // Hata özeti
  getAllLogs: () => logs,

  // Hata raporu
  getErrorReport: () => {
    const errors = logs.filter((l) => l.level === 'ERROR');
    const warns = logs.filter((l) => l.level === 'WARN');

    return {
      toplamLog: logs.length,
      hataCount: errors.length,
      uyariCount: warns.length,
      hatalar: errors,
      uyarilar: warns,
      logFile: logFile,
    };
  },

  // Belki başarı özeti
  getSuccessReport: () => {
    const success = logs.filter((l) => l.level === 'SUCCESS');
    return {
      basariCount: success.length,
      basarilar: success,
    };
  },
};

module.exports = logger;
