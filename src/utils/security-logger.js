/**
 * YükleGit — Güvenlik Olay Loglayıcı
 * Güvenlik olaylarını /logs/security-YYYY-MM-DD.log dosyasına yazar.
 * Loglar 30 gün saklanır, günlük rotate edilir.
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

const fmt = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const fileTransport = new winston.transports.DailyRotateFile({
  filename:    path.join(LOG_DIR, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles:    '30d',
  maxSize:     '10m',
  format:      fmt,
});

const logger = winston.createLogger({
  level: 'info',
  transports: [fileTransport],
  // Üretimde console'a yazma; geliştirmede yaz
  ...(process.env.NODE_ENV !== 'production' && {
    transports: [
      fileTransport,
      new winston.transports.Console({ format: winston.format.simple() }),
    ],
  }),
});

/**
 * Güvenlik olayını logla.
 * @param {string} action  Olay türü (sqli_attempt, xss_attempt, brute_force, admin_login, vb.)
 * @param {object} data    { ip, userId, path, ua, detail, ... }
 */
function secLog(action, data = {}) {
  logger.info({ action, ...data });
}

module.exports = { secLog };
