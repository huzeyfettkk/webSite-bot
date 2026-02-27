#!/usr/bin/env node

/**
 * Bot Diagnostics - Hata Log Kontrol Aracı
 * 
 * Kullanım:
 * node bot-diagnostics.js         // Bugünün loglarını göster
 * node bot-diagnostics.js ERROR   // Sadece hataları göster
 * node bot-diagnostics.js summary // Özet rapor göster
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const logsDir = path.join(__dirname, 'logs');
const colors = {
  RESET: '\x1b[0m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  GRAY: '\x1b[90m',
  WHITE: '\x1b[37m',
};

const levelEmoji = {
  SUCCESS: '✅',
  INFO: 'ℹ️',
  WARN: '⚠️',
  ERROR: '❌',
  DEBUG: '🔍',
};

const levelColor = {
  SUCCESS: colors.GREEN,
  INFO: colors.BLUE,
  WARN: colors.YELLOW,
  ERROR: colors.RED,
  DEBUG: colors.GRAY,
};

/**
 * Bugünün log dosyasını al
 */
function getTodayLogFile() {
  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logsDir, `bot-${today}.log.json`);
  return logFile;
}

/**
 * Log dosyasını oku
 */
function readLogs(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`${colors.YELLOW}📄 Log dosyası bulunamadı: ${filePath}${colors.RESET}`);
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error(`${colors.RED}❌ Log dosyası okunamadı: ${e.message}${colors.RESET}`);
    return [];
  }
}

/**
 * Hata raporu oluştur
 */
function generateReport(logs) {
  const errors = logs.filter((l) => l.level === 'ERROR');
  const warns = logs.filter((l) => l.level === 'WARN');
  const success = logs.filter((l) => l.level === 'SUCCESS');
  const info = logs.filter((l) => l.level === 'INFO');
  const debug = logs.filter((l) => l.level === 'DEBUG');

  return {
    total: logs.length,
    errors: errors,
    errorCount: errors.length,
    warnings: warns,
    warningCount: warns.length,
    success: success,
    successCount: success.length,
    info: info,
    infoCount: info.length,
    debug: debug,
    debugCount: debug.length,
    firstLog: logs[0]?.timestamp,
    lastLog: logs[logs.length - 1]?.timestamp,
  };
}

/**
 * Kritik kontrol noktaları (Adımlar)
 */
const CRITICAL_STEPS = [
  'BOT_INIT',
  'STARTUP',
  'BOT_CREATE',
  'WHATSAPP_CLIENT',
  'WHATSAPP_QR',
  'WHATSAPP_AUTH',
  'WHATSAPP_READY',
  'DATABASE',
  'SERVER',
  'CHANNEL_MESSAGE',
  'ILAN_SAVE',
  'MESSAGE_RECEIVED',
  'SEARCH_PROCESS',
  'MESSAGE_SEND',
];

/**
 * Health check - Tüm adımlar başarılı mı?
 */
function healthCheck(logs) {
  console.log('\n' + colors.CYAN + '═'.repeat(60) + colors.RESET);
  console.log(colors.CYAN + '🏥 BOT SAĞLIK KONTROL' + colors.RESET);
  console.log(colors.CYAN + '═'.repeat(60) + colors.RESET + '\n');

  const completedSteps = new Set();
  const failedSteps = new Set();
  const stepDetails = {};

  logs.forEach((log) => {
    if (CRITICAL_STEPS.includes(log.step)) {
      if (!stepDetails[log.step]) {
        stepDetails[log.step] = { success: 0, error: 0, warn: 0, lastTime: null };
      }
      stepDetails[log.step].lastTime = log.timestamp;

      if (log.level === 'SUCCESS' || log.level === 'INFO') {
        completedSteps.add(log.step);
        stepDetails[log.step].success++;
      } else if (log.level === 'ERROR') {
        failedSteps.add(log.step);
        stepDetails[log.step].error++;
      } else if (log.level === 'WARN') {
        stepDetails[log.step].warn++;
      }
    }
  });

  let allHealthy = true;

  CRITICAL_STEPS.forEach((step) => {
    if (!stepDetails[step]) {
      console.log(`${colors.YELLOW}⚠️  ${step.padEnd(25)} - GERÇEKLEŞMEDİ${colors.RESET}`);
      allHealthy = false;
      return;
    }

    const details = stepDetails[step];
    const status = details.error > 0 ? '❌ HATA' : details.warn > 0 ? '⚠️  UYARI' : '✅ OK';

    const color = details.error > 0 ? colors.RED : details.warn > 0 ? colors.YELLOW : colors.GREEN;

    console.log(`${color}${status}${colors.RESET} ${step.padEnd(25)} | S:${details.success} W:${details.warn} E:${details.error}`);

    if (details.error > 0) {
      allHealthy = false;
    }
  });

  console.log('\n' + colors.CYAN + '─'.repeat(60) + colors.RESET);

  if (allHealthy && completedSteps.size === CRITICAL_STEPS.length) {
    console.log(`${colors.GREEN}✅ TÜM SİSTEMLER ÇALIŞIYOR - BOT SAĞLAM${colors.RESET}\n`);
  } else if (failedSteps.size === 0 && completedSteps.size > CRITICAL_STEPS.length * 0.7) {
    console.log(`${colors.YELLOW}⚠️  UYARI - BAZILARI UYARI VERİYOR AMA ÇALIŞIYOR${colors.RESET}\n`);
  } else {
    console.log(`${colors.RED}❌ HİZMET SORUNLARI BULUNUYOR - KONTROL GEREKLİ${colors.RESET}\n`);
  }
}

/**
 * Özet rapor
 */
function printSummary(report) {
  console.log('\n' + colors.CYAN + '═'.repeat(60) + colors.RESET);
  console.log(colors.CYAN + '📊 LOG ÖZETİ' + colors.RESET);
  console.log(colors.CYAN + '═'.repeat(60) + colors.RESET + '\n');

  console.log(`${colors.GREEN}✅ Başarılı  : ${report.successCount}${colors.RESET}`);
  console.log(`${colors.BLUE}ℹ️  Bilgi     : ${report.infoCount}${colors.RESET}`);
  console.log(`${colors.YELLOW}⚠️  Uyarı     : ${report.warningCount}${colors.RESET}`);
  console.log(`${colors.RED}❌ Hata      : ${report.errorCount}${colors.RESET}`);
  console.log(`${colors.GRAY}🔍 Debug     : ${report.debugCount}${colors.RESET}`);
  console.log(`\n📄 Toplam    : ${report.total} log girişi`);

  if (report.firstLog) {
    console.log(`⏰ Başlangıç : ${new Date(report.firstLog).toLocaleString('tr-TR')}`);
  }
  if (report.lastLog) {
    console.log(`⏰ Son       : ${new Date(report.lastLog).toLocaleString('tr-TR')}`);
  }

  if (report.errorCount > 0) {
    console.log('\n' + colors.RED + '❌ HATALAR:' + colors.RESET);
    report.errors.slice(-5).forEach((err) => {
      console.log(
        `   [${new Date(err.timestamp).toLocaleTimeString('tr-TR')}] ${err.step} - ${err.message}`
      );
      if (err.data?.errorMessage) {
        console.log(`      → ${err.data.errorMessage}`);
      }
    });
    if (report.errorCount > 5) {
      console.log(`   ... ve ${report.errorCount - 5} daha hata`);
    }
  }

  if (report.warningCount > 0) {
    console.log('\n' + colors.YELLOW + '⚠️  UYARILAR:' + colors.RESET);
    report.warnings.slice(-5).forEach((warn) => {
      console.log(
        `   [${new Date(warn.timestamp).toLocaleTimeString('tr-TR')}] ${warn.step} - ${warn.message}`
      );
    });
    if (report.warningCount > 5) {
      console.log(`   ... ve ${report.warningCount - 5} daha uyarı`);
    }
  }

  console.log('\n' + colors.CYAN + '═'.repeat(60) + colors.RESET + '\n');
}

/**
 * Detaylı log göster
 */
function printLogs(logs, filterLevel = null) {
  console.log('\n' + colors.CYAN + '═'.repeat(80) + colors.RESET);
  console.log(colors.CYAN + '📋 DETAYLI LOGLAR' + colors.RESET);
  console.log(colors.CYAN + '═'.repeat(80) + colors.RESET + '\n');

  let filtered = logs;
  if (filterLevel) {
    filtered = logs.filter((l) => l.level === filterLevel);
  }

  filtered.forEach((log) => {
    const emoji = levelEmoji[log.level] || '•';
    const color = levelColor[log.level] || colors.RESET;
    const timestamp = new Date(log.timestamp).toLocaleTimeString('tr-TR');

    console.log(
      `${color}${emoji} [${timestamp}] ${log.level.padEnd(7)}${colors.RESET} | ${log.step.padEnd(20)} | ${log.message}`
    );

    if (log.data && Object.keys(log.data).length > 0) {
      const dataStr = JSON.stringify(log.data, null, 2)
        .split('\n')
        .map((line) => `     ${line}`)
        .join('\n');
      console.log(`${colors.GRAY}${dataStr}${colors.RESET}`);
    }
  });

  console.log('\n' + colors.CYAN + '═'.repeat(80) + colors.RESET + '\n');
}

/**
 * Ana akış
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'show';

  const logFile = getTodayLogFile();
  const logs = readLogs(logFile);

  if (logs.length === 0) {
    console.log(`\n${colors.YELLOW}📭 Henüz log kaydı yok.${colors.RESET}`);
    console.log(`Log dosyası şu konumda bekleniyor: ${logFile}\n`);
    return;
  }

  const report = generateReport(logs);

  switch (command.toUpperCase()) {
    case 'ERROR':
      if (report.errorCount === 0) {
        console.log(`\n${colors.GREEN}✅ Hata yok!${colors.RESET}\n`);
      } else {
        printLogs(logs, 'ERROR');
      }
      break;

    case 'WARN':
      if (report.warningCount === 0) {
        console.log(`\n${colors.GREEN}✅ Uyarı yok!${colors.RESET}\n`);
      } else {
        printLogs(logs, 'WARN');
      }
      break;

    case 'SUMMARY':
      printSummary(report);
      healthCheck(logs);
      break;

    case 'HEALTH':
      healthCheck(logs);
      break;

    case 'SHOW':
    default:
      printLogs(logs);
      printSummary(report);
      healthCheck(logs);
  }
}

main().catch(console.error);
