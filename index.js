require('dotenv').config();
/**
 * WhatsApp Lojistik Takip ve Arama Botu
 * whatsapp-web.js kullanarak yazılmıştır.
 */

const logger = require('./bot-logger');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { startServer } = require('./server');
const { ilanEkle }    = require('./db');
const qrcode          = require('qrcode-terminal');
const fs              = require('fs');
const path            = require('path');

// Bot başlatma logu
logger.botStart();

// ── Session klasörleri oluştur ─────────────────────────
// Her bot kendi session dosyasını depolar — çakışma yok
const SESSIONS_DIR = path.join(__dirname, '.wwebjs_sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o755 });
    logger.info('STARTUP', `Session klasörü oluşturuldu: ${SESSIONS_DIR}`, {});
  } catch (err) {
    logger.error('STARTUP', `Session klasörü oluşturulamadı`, err, { path: SESSIONS_DIR });
  }
}

const CONFIG = {
  TTL_MS: 1 * 60 * 60 * 1000, // 1 saat

  // Türkiye telefon: 05XXXXXXXXX (11 hane) veya +905XXXXXXXXX (13 hane)
  PHONE_REGEX: /(?<!\d)((?:\+90|0)5\d{9})(?!\d)/g,

  // Kara liste — normalize() sonrası karşılaştırılır
  // Büyük/küçük harf, Türkçe karakter, kesme işareti fark etmez
  BLACKLIST: ['kızıltepe', 'rojhat', 'bayik', '05446405625', '5446405625', '05466360583', '5466360583', 'haliloglu'],

  CITIES: [
    'adana','adıyaman','afyon','ağrı','amasya','ankara','antalya','artvin',
    'aydın','balıkesir','bilecik','bingöl','bitlis','bolu','burdur','bursa',
    'çanakkale','çankırı','çorum','denizli','diyarbakır','edirne','elazığ',
    'erzincan','erzurum','eskişehir','gaziantep','giresun','gümüşhane',
    'hakkari','hatay','ısparta','mersin','istanbul','izmir','kars','kastamonu',
    'kayseri','kırklareli','kırşehir','kocaeli','konya','kütahya','malatya',
    'manisa','kahramanmaraş','mardin','muğla','muş','nevşehir','niğde',
    'ordu','rize','sakarya','samsun','siirt','sinop','sivas','tekirdağ',
    'tokat','trabzon','tunceli','şanlıurfa','uşak','van','yozgat','zonguldak',
    'aksaray','bayburt','karaman','kırıkkale','batman','şırnak','bartın',
    'ardahan','iğdır','yalova','karabük','kilis','osmaniye','düzce',
    'başakşehir','kavak','horasan','muradiye','iskilip','kangal','pendik',
    'gebze','izmit','adapazarı','sapanca','hendek',
    'ataşehir','kadıköy','üsküdar','beşiktaş','şişli','beyoğlu','fatih',
    'bağcılar','esenler','sultangazi','eyüpsultan','gaziosmanpaşa','esenyurt',
    'bahçelievler','bakırköy','zeytinburnu','avcılar','beylikdüzü','büyükçekmece',
    'arnavutköy','silivri','çatalca','sancaktepe','maltepe','kartal','tuzla',
    'sultanbeyli','ümraniye','beykoz','şile','çekmeköy','sarıyer',
    'bornova','karşıyaka','konak','buca','gaziemir','torbalı','menemen',
    'mamak','çankaya','keçiören','yenimahalle','etimesgut','sincan','altındağ',
    'pursaklar','gölbaşı','polatlı',
    // ── Türkiye'nin tüm ilçeleri (870 ilçe) ──
    'abana','acıgöl','acıpayam','adaklı','adalar','adapazarı','adilcevaz','afşin','ahlat','akdağmadeni',
    'akdeniz','akhisar','akkuş','akkışla','akpınar','akseki','aksu','akyazı','akçaabat','akçadağ',
    'akçakale','akçakent','akçakoca','akören','akıncılar','akşehir','alaca','alacakaya','aladağ','alanya',
    'alaplı','alaçam','alaşehir','aliağa','almus','alpu','altunhisar','altıeylül','altındağ','altınekin',
    'altınordu','altınova','altıntaş','altınyayla','altınözü','alucra','amasra','anamur','andırın','antakya',
    'araban','araklı','aralık','arapgir','araç','ardanuç','ardeşen','arguvan','arhavi','arifiye',
    'armutlu','arnavutköy','arpaçay','arsin','arsuz','artova','artuklu','arıcak','asarcık','aslanapa',
    'atabey','atakum','ataşehir','atkaracalar','avanos','avcılar','ayancık','ayaş','aybastı','aydıncık',
    'aydıntepe','ayrancı','ayvacık','ayvalık','azdavay','aziziye','ağaçören','ağlasun','ağlı','ağın',
    'aşkale','babadağ','babaeski','bafra','bahçe','bahçelievler','bahçesaray','bakırköy','bala','balya',
    'balçova','banaz','bandırma','baskil','battalgazi','bayat','baykan','bayraklı','bayramiç','bayrampaşa',
    'bayramören','bayındır','bağcılar','bağlar','başakşehir','başiskele','başkale','başmakçı','başyayla','başçiftlik',
    'bekilli','belen','bergama','besni','beyağaç','beydağ','beykoz','beylikdüzü','beylikova','beyoğlu',
    'beypazarı','beytüşşebap','beyşehir','beşikdüzü','beşiktaş','beşiri','biga','bigadiç','birecik','bismil',
    'bodrum','bolvadin','bor','bornova','borçka','boyabat','bozcaada','bozdoğan','bozkurt','bozkır',
    'bozova','boztepe','bozyazı','bozüyük','boğazkale','boğazlıyan','buca','bucak','buharkent','bulancak',
    'bulanık','buldan','burhaniye','bünyan','büyükorhan','büyükçekmece','canik','ceyhan','ceylanpınar','cide',
    'cihanbeyli','cizre','cumayeri','daday','dalaman','darende','dargeçit','darıca','datça','dazkırı',
    'defne','delice','demirci','demirköy','demirözü','demre','derbent','derebucak','dereli','derepazarı',
    'derik','derince','derinkuyu','dernekpazarı','develi','devrek','devrekani','dicle','didim','digor',
    'dikili','dikmen','dilovası','dinar','divriği','diyadin','dodurga','domaniç','doğanhisar','doğankent',
    'doğanyol','doğanyurt','doğanşar','doğanşehir','doğubayazıt','dulkadiroğlu','dumlupınar','durağan','dursunbey','dörtdivan',
    'dörtyol','döşemealtı','düziçi','düzköy','eceabat','edremit','efeler','eflani','ekinözü','elbeyli',
    'elbistan','eldivan','eleşkirt','elmadağ','elmalı','emet','emirdağ','emirgazi','enez','erbaa',
    'erciş','erdek','erdemli','erenler','ereğli','erfelek','ergani','ergene','ermenek','eruh',
    'erzin','esenler','esenyurt','eskil','eskipazar','espiye','etimesgut','evciler','evren','eyyübiye',
    'eyüpsultan','ezine','eğil','eğirdir','eşme','fatih','fatsa','feke','felahiye','ferizli',
    'fethiye','finike','foça','fındıklı','gaziemir','gaziosmanpaşa','gazipaşa','gebze','gediz','gelendost',
    'gelibolu','gemerek','gemlik','genç','gercüş','gerede','gerger','germencik','gerze','geyve',
    'göksun','gökçeada','gökçebey','gölbaşı','gölcük','gölhisar','gölköy','gölmarmara','gölova','gölpazarı',
    'gölyaka','gömeç','gönen','gördes','görele','göynücek','göynük','güce','güdül','gülağaç',
    'gülnar','gülyalı','gülşehir','gümüşhacıköy','gümüşova','gündoğmuş','güney','güneysu','güneysınır','güngören',
    'günyüzü','gürgentepe','güroymak','gürpınar','gürsu','gürün','güzelbahçe','güzelyurt','güçlükonak','hacıbektaş',
    'hacılar','hadim','hafik','halfeti','haliliye','halkapınar','hamamözü','hamur','han','hani',
    'hanönü','harmancık','harran','hasanbeyli','hasankeyf','hasköy','hassa','havran','havsa','havza',
    'haymana','hayrabolu','hayrat','hazro','hekimhan','hemşin','hendek','hilvan','hisarcık','hizan',
    'hocalar','honaz','hopa','horasan','hozat','hüyük','hınıs','ibradı','idil','ihsangazi',
    'ihsaniye','ikitelli','ikizce','ikizdere','ilgaz','ilgın','ilkadım','ilıç','imamoğlu','imranlı',
    'incesu','incirliova','inebolu','inegöl','inhisar','inönü','ipekyolu','ipsala','iscehisar','iskenderun',
    'iskilip','islahiye','ivrindi','izmit','iznik','kabadüz','kabataş','kadirli','kadıköy','kadınhanı',
    'kadışehri','kahramankazan','kahta','kale','kalecik','kalkandere','kaman','kandıra','kangal','kapaklı',
    'karabağlar','karaburun','karacabey','karacasu','karahallı','karaisalı','karakeçili','karakoyunlu','karakoçan','karaköprü',
    'karamürsel','karapürçek','karapınar','karasu','karatay','karataş','karayazı','karesi','kargı','karkamış',
    'karlıova','kartal','kartepe','karşıyaka','kavak','kavaklıdere','kayapınar','kaynarca','kaynaşlı','kazımkarabekir',
    'kağıthane','kağızman','kaş','keban','keles','kelkit','kemah','kemaliye','kemalpaşa','kemer',
    'kepez','kepsut','keskin','kestel','keçiborlu','keçiören','keşan','keşap','kilimli','kiraz',
    'kiğı','kocaali','kocasinan','kofçaz','konak','konyaaltı','korgan','korkut','korkuteli','kovancılar',
    'koyulhisar','kozaklı','kozan','kozlu','kozluk','koçarlı','kula','kulp','kulu','kuluncak',
    'kumlu','kumluca','kumru','kurtalan','kurucaşile','kurşunlu','kuyucak','kuşadası','köprübaşı','köprüköy',
    'körfez','köse','köseköy','köyceğiz','köşk','küre','kürtün','küçükçekmece','kıbrıscık','kınık',
    'kırkağaç','kırıkhan','kızılcahamam','kızıltepe','kızılören','kızılırmak','ladik','lalapaşa','lapseki','laçin',
    'lice','lüleburgaz','maden','mahmudiye','malazgirt','malkara','maltepe','mamak','manavgat','manyas',
    'marmara','marmaraereğlisi','marmaris','mazgirt','mazıdağı','maçka','mecitözü','melikgazi','menderes','menemen',
    'mengen','menteşe','meram','meriç','merkez','merkezefendi','merzifon','mesudiye','mezitli','midyat',
    'mihalgazi','mihallıççık','milas','mucur','mudanya','mudurnu','muradiye','muratpaşa','murgul','musabeyli',
    'mustafakemalpaşa','mut','mutki','nallıhan','narlıdere','narman','nazilli','nazimiye','niksar','nilüfer',
    'nizip','nurdağı','nurhak','nusaybin','odunpazarı','of','oltu','olur','ondokuzmayıs','onikişubat',
    'orhaneli','orhangazi','orta','ortaca','ortahisar','ortaköy','osmancık','osmaneli','osmangazi','otlukbeli',
    'ovacık','oğuzeli','oğuzlar','palandöken','palu','pamukkale','pamukova','pasinler','patnos','payas',
    'pazar','pazarcık','pazarlar','pazaryeri','pazaryolu','pehlivanköy','pendik','pertek','pervari','perşembe',
    'piraziz','polateli','polatlı','pozantı','pursaklar','pülümür','pütürge','pınarbaşı','pınarhisar','refahiye',
    'reyhanlı','reşadiye','safranbolu','salihli','salıpazarı','samandağ','samsat','sancaktepe','sandıklı','sapanca',
    'saray','saraydüzü','saraykent','sarayköy','sarayönü','saruhanlı','sarıcakaya','sarıgöl','sarıkamış','sarıkaya',
    'sarıoğlan','sarıveliler','sarıyahşi','sarıyer','sarız','sarıçam','sason','savaştepe','savur','seben',
    'seferihisar','selendi','selim','selçuk','selçuklu','senirkent','serdivan','serik','serinhisar','seydikemer',
    'seydiler','seydişehir','seyhan','seyitgazi','silifke','silivri','silopi','silvan','simav','sinanpaşa',
    'sincan','sincik','sivaslı','siverek','sivrice','sivrihisar','solhan','soma','sorgun','sulakyurt',
    'sultanbeyli','sultandağı','sultangazi','sultanhisar','suluova','sulusaray','sumbas','sungurlu','sur','suruç',
    'susurluk','susuz','suşehri','söke','söğüt','söğütlü','süleymanpaşa','süloğlu','sürmene','sütçüler',
    'sındırgı','talas','taraklı','tarsus','tatvan','tavas','tavşanlı','taşkent','taşköprü','taşlıçay',
    'taşova','tefenni','tekkeköy','tekman','tepebaşı','tercan','termal','terme','tillo','tire',
    'tirebolu','tomarza','tonya','toprakkale','torbalı','toroslar','tortum','torul','tosya','tufanbeyli',
    'turgutlu','turhal','tut','tutak','tuzla','tuzluca','tuzlukçu','tuşba','türkeli','türkoğlu',
    'ula','ulaş','ulubey','uluborlu','uludere','ulukışla','ulus','urla','uzundere','uzunköprü',
    'uğurludağ','vakfıkebir','varto','vezirköprü','viranşehir','vize','yahyalı','yahşihan','yakakent','yakutiye',
    'yalvaç','yalıhüyük','yapraklı','yatağan','yavuzeli','yayladağı','yayladere','yazıhan','yağlıdere','yedisu',
    'yenice','yenifakılı','yenimahalle','yenipazar','yeniçağa','yenişehir','yerköy','yeşilhisar','yeşilli','yeşilova',
    'yeşilyurt','yomra','yumurtalık','yunak','yunusemre','yusufeli','yüksekova','yüreğir','yıldırım','yıldızeli',
    'yığılca','zara','zeytinburnu','zile','çal','çaldıran','çamardı','çamaş','çameli','çamlıdere',
    'çamlıhemşin','çamlıyayla','çamoluk','çan','çanakçı','çandır','çankaya','çardak','çarşamba','çarşıbaşı',
    'çat','çatak','çatalca','çatalpınar','çatalzeytin','çavdarhisar','çavdır','çay','çaybaşı','çaycuma',
    'çayeli','çaykara','çayıralan','çayırlı','çayırova','çağlayancerit','çekerek','çekmeköy','çelikhan','çeltik',
    'çeltikçi','çemişgezek','çerkezköy','çerkeş','çermik','çeşme','çifteler','çiftlik','çiftlikköy','çilimli',
    'çine','çiçekdağı','çiğli','çorlu','çubuk','çukurca','çukurova','çumra','çüngüş','çınar',
    'çınarcık','ödemiş','ömerli','özalp','özvatan','ümraniye','ünye','ürgüp','üsküdar','üzümlü',
    'şabanözü','şahinbey','şaphane','şarkikaraağaç','şarköy','şarkışla','şavşat','şebinkarahisar','şefaatli','şehitkamil',
    'şehzadeler','şemdinli','şenkaya','şenpazar','koçhisar','şile','şiran','şirvan','şişli','şuhut','temelli'
  ],
};

// ── Normalize ──────────────────────────────────
// "KIZILtepe'den" → "kiziltepe den"
// "İSTANBUL/ANADOLU" → "istanbul anadolu"
function normalize(str) {
  return str
    // ── Standart Türkçe karakterler ──
    .replace(/İ/g, 'i').replace(/I/g, 'i')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Â/g, 'a').replace(/â/g, 'a')
    .replace(/Î/g, 'i').replace(/î/g, 'i')
    .replace(/Û/g, 'u').replace(/û/g, 'u')
    // ── Unicode "küçük büyük harf" (small capital) karakterleri ──
    // Bunlar WhatsApp'ta dekoratif yazı için kullanılır: ᴋɪᴢɪʟᴛᴇᴘᴇ → kiziltepe
    .replace(/ᴀ|Ａ/g, 'a')
    .replace(/ʙ/g, 'b')
    .replace(/ᴄ/g, 'c')
    .replace(/ᴅ/g, 'd')
    .replace(/ᴇ/g, 'e')
    .replace(/ꜰ/g, 'f')
    .replace(/ɢ/g, 'g')
    .replace(/ʜ/g, 'h')
    .replace(/ɪ|Ɪ/g, 'i')
    .replace(/ᴊ/g, 'j')
    .replace(/ᴋ/g, 'k')
    .replace(/ʟ/g, 'l')
    .replace(/ᴍ/g, 'm')
    .replace(/ɴ/g, 'n')
    .replace(/ᴏ/g, 'o')
    .replace(/ᴘ/g, 'p')
    .replace(/ʀ/g, 'r')
    .replace(/ꜱ/g, 's')
    .replace(/ᴛ/g, 't')
    .replace(/ᴜ/g, 'u')
    .replace(/ᴠ/g, 'v')
    .replace(/ᴡ/g, 'w')
    .replace(/ʏ/g, 'y')
    .replace(/ᴢ/g, 'z')
    // ── Birleştirici işaretler (combining marks) — üsteki/altaki nokta/cedilla ──
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// İçerik bazlı hash — farklı gruptan gelen aynı metni tespit eder
function contentHash(str) {
  const clean = normalize(str).replace(/\s+/g, '');
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = Math.imul(31, h) + clean.charCodeAt(i) | 0;
  }
  return h;
}

function containsPhone(text) {
  // 1. Kesin format: 05321234567 veya +905321234567
  CONFIG.PHONE_REGEX.lastIndex = 0;
  if (CONFIG.PHONE_REGEX.test(text)) { CONFIG.PHONE_REGEX.lastIndex = 0; return true; }
  CONFIG.PHONE_REGEX.lastIndex = 0;
  // 2. Boşluklu/çizgili format: "0532 123 45 67", "+90 532 123 45 67", "0532-123-45-67"
  const compact = text.replace(/[\s\-()+.]/g, '');
  return /(?:90|0)5\d{9}/.test(compact);
}

// İlan filtreleme için lenient şehir kontrolü (substring eşleşme)
// "İstanbuldan", "Ankaraya" gibi Türkçe ek almış yazımları yakalar
function containsCity(text) {
  const normText = normalize(text);
  return CONFIG.CITIES.some(c => normText.includes(normalize(c)));
}

function extractCities(text) {
  const normText = normalize(text);
  const found = [];
  for (const c of CONFIG.CITIES) {
    const nc = normalize(c);
    const re = new RegExp('(?<![a-z0-9])' + nc.replace(/[-]/g,'\\-') + '(?![a-z0-9])');
    const m = normText.match(re);
    if (m) {
      const pos = normText.indexOf(nc);
      found.push({ city: c, pos });
    }
  }
  found.sort((a, b) => a.pos - b.pos);
  const seen = new Set();
  return found.filter(({ city }) => {
    const nc = normalize(city);
    if (seen.has(nc)) return false;
    seen.add(nc);
    return true;
  }).map(({ city }) => city);
}

// Her satırdaki güzergah çiftlerini çıkar — satır bazlı eşleştirme için
function extractLinePairs(text) {
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
  const pairs = [];
  for (const line of lines) {
    const normLine = normalize(line);
    const lineCities = [];
    for (const c of CONFIG.CITIES) {
      const nc = normalize(c);
      const re = new RegExp('(?<![a-z0-9])' + nc.replace(/[-]/g,'\\-') + '(?![a-z0-9])');
      const m = normLine.match(re);
      if (m) {
        const pos = normLine.indexOf(nc);
        lineCities.push({ city: c, pos });
      }
    }
    lineCities.sort((a, b) => a.pos - b.pos);
    const seen = new Set();
    const unique = lineCities.filter(({ city }) => {
      const nc = normalize(city);
      if (seen.has(nc)) return false;
      seen.add(nc);
      return true;
    }).map(({ city }) => city);
    if (unique.length >= 1) pairs.push(unique);
  }
  return pairs; // [[from, to], [from2, to2], ...]
}

// Kara liste: normalize sonrası substring kontrolü
// "KIZILTEPE", "Kızıltepe'den", "kizil-tepe" hepsi yakalanır
function isBlacklisted(text) {
  const norm = normalize(text);
  return CONFIG.BLACKLIST.some(w => norm.includes(normalize(w)));
}

function isIlan(text) {
  if (isBlacklisted(text)) return false;
  // containsCity: substring eşleşme — "İstanbuldan", "Ankaraya" gibi ek almış yazımları da yakalar
  return containsPhone(text) && containsCity(text);
}

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d} saniye önce`;
  if (d < 3600) return `${Math.floor(d / 60)} dakika önce`;
  const h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60);
  return m > 0 ? `${h} saat ${m} dakika önce` : `${h} saat önce`;
}

// Aranan şehirleri WhatsApp'ta *BÜYÜK KALDIN* gösterir
function highlightCities(text, searchCities) {
  const normCities = searchCities.map(c => normalize(c));

  // Mesajdaki tüm ➡️ ve ⬅️ emojilerini sil (boş bırak)
  let cleaned = text
    .replace(/➡️/g, '')
    .replace(/⬅️/g, '')
    .replace(/➡/g, '')
    .replace(/⬅/g, '');

  // Sadece harf dizilerini eşleştir
  return cleaned.replace(/([A-Za-zÀ-ÿğüşıöçĞÜŞİÖÇᴀ-ᴢꜱꜰɪɴʀʏʙʜʟᴋᴍᴏᴘᴛᴜᴠᴡᴢɢ]+)/g, (word) => {
    const normWord = normalize(word);
    if (normCities.includes(normWord)) {
      return '➡️ ' + word.toUpperCase() + ' ⬅️';
    }
    return word;
  });
}

function formatResults(ilanlar, searchCities) {
  if (ilanlar.length === 0) {
    return '❌ Aradığınız kriterlere uygun aktif ilan bulunamadı.\n_(Son 1 saat içindeki ilanlar gösterilir)_';
  }
  return ilanlar.map((ilan, i) => {
    const text = highlightCities(ilan.text.trim(), searchCities);
    return `🚛 *İlan ${i + 1}* — _${ilan.chatName}_\n${text}\n⏱ _${timeAgo(ilan.timestamp)}_`;
  }).join('\n\n' + '─'.repeat(30) + '\n\n');
}

// ── Samsun Bildirim Modülü ──────────────────────────────
const _samsunGonderildi = new Set();

const SAMSUN_ILCELERI = [
  'samsun','atakum','canik','ilkadım','tekkeköy','bafra','çarşamba','terme',
  'alaçam','asarcık','ayvacık','havza','kavak','ladik','ondokuzmayıs',
  'salıpazarı','vezirköprü','yakakent'
];

function isSamsunIlani(text) {
  const norm = ' ' + normalize(text) + ' ';
  return SAMSUN_ILCELERI.some(ilce => norm.includes(' ' + normalize(ilce) + ' '));
}

async function samsunBildirimiGonder(ilan) {
  try {
    const hash = contentHash(ilan.text);
    if (_samsunGonderildi.has(hash)) return;
    _samsunGonderildi.add(hash);
    setTimeout(() => _samsunGonderildi.delete(hash), 60 * 60 * 1000);
    const hedefNumara = '905015303028@c.us';
    const chat = await client.getChatById(hedefNumara);
    const mesaj = '🔔 *YENİ SAMSUN İLANI*\n──────────────────────\n📍 *Grup:* ' + ilan.chatName + '\n⏱ ' + timeAgo(ilan.timestamp) + '\n\n' + ilan.text.trim();
    await chat.sendMessage(mesaj);
    console.log('🔔 Samsun bildirimi gönderildi → +90 501 530 30 28');
  } catch (err) {
    console.warn('⚠️ Samsun bildirimi gönderilemedi:', err.message);
  }
}

// ── İlan Deposu ────────────────────────────────
class IlanStore {
  constructor() {
    this._store  = new Map();  // id → ilan
    this._hashes = new Set();  // içerik hash'leri
    setInterval(() => this._cleanup(), 60_000);
  }

  add(id, data) {
    const h = contentHash(data.text);
    if (this._hashes.has(h)) return; // aynı içerik, farklı grup → atla
    this._hashes.add(h);
    this._store.set(id, { ...data, timestamp: data.timestamp || Date.now(), _hash: h });
  }

  // Ham sonuç döndür (server.js'de DB ile birleştirmek için)
  searchRaw(city1, city2, ilceler1, ilceler2) {
    return this.search(city1, city2, ilceler1, ilceler2);
  }

  search(city1, city2, ilceler1, ilceler2) {
    const norm = s => String(s||'')
      .replace(/İ/g,'i').replace(/I/g,'i').replace(/ı/g,'i')
      .replace(/Ğ/g,'g').replace(/ğ/g,'g')
      .replace(/Ü/g,'u').replace(/ü/g,'u')
      .replace(/Ş/g,'s').replace(/ş/g,'s')
      .replace(/Ö/g,'o').replace(/ö/g,'o')
      .replace(/Ç/g,'c').replace(/ç/g,'c')
      .toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();

    // il + ilçe listesi (verilmemişse sadece şehir adı)
    const list1 = (ilceler1 && ilceler1.length) ? ilceler1.map(norm) : [norm(city1)];
    const list2 = (ilceler2 && ilceler2.length) ? ilceler2.map(norm) : (city2 ? [norm(city2)] : []);

    const results = [];

    for (const [, ilan] of this._store) {
      let matched = false;

      if (!city2) {
        // Tek şehir: cities listesinde veya metinde list1'den biri var mı?
        matched = (ilan.cities || []).some(c => list1.includes(norm(c)));
        if (!matched) {
          const t = ' ' + norm(ilan.text) + ' ';
          matched = list1.some(n => t.includes(' ' + n + ' '));
        }
      } else {
        // İki şehir: AYNI SATIRDA list1'den biri solda, list2'den biri sağda mı?
        // linePairs ile kontrol (en güvenilir, yeni ilanlar)
        if (ilan.linePairs && ilan.linePairs.length > 0) {
          for (const pair of ilan.linePairs) {
            const normPair = pair.map(norm);
            const p1 = normPair.findIndex(c => list1.includes(c));
            const p2 = normPair.findIndex(c => list2.includes(c));
            if (p1 !== -1 && p2 !== -1 && p1 < p2) { matched = true; break; }
          }
        }

        // linePairs yoksa metin bazlı satır kontrolü
        if (!matched) {
          const lines = ilan.text.split(/[\n\r]+/).map(l => norm(l));
          for (const line of lines) {
            // list1'den en erken pozisyon
            let earliest1 = Infinity;
            for (const n of list1) {
              const idx = line.indexOf(n);
              if (idx !== -1 && idx < earliest1) earliest1 = idx;
            }
            if (earliest1 === Infinity) continue;
            // list2'den herhangi biri daha sonra mı?
            for (const n of list2) {
              const idx = line.indexOf(n);
              if (idx !== -1 && idx > earliest1) { matched = true; break; }
            }
            if (matched) break;
          }
        }
      }

      if (matched) results.push(ilan);
    }
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  _cleanup() {
    const now = Date.now();
    for (const [id, ilan] of this._store) {
      if (now - ilan.timestamp > CONFIG.TTL_MS) {
        this._hashes.delete(ilan._hash);
        this._store.delete(id);
      }
    }
  }

  size() { return this._store.size; }
}

// ── Multi-Bot Manager ─────────────────────────
// (Client, LocalAuth zaten yukarıda require edildi)
const { botEkle, botGuncelle, botSil, tumBotlar } = require('./db');

const store = new IlanStore();

// Aktif client'lar: clientId → { client, durum, qrData, qrWaiters }
const botManager = new Map();

// QR bekliyenler: clientId → [res, res, ...]  (SSE response'ları)
const qrWaiters = new Map();

function puppeteerOpts() {
  return {
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-accelerated-2d-canvas', '--no-first-run', '--disable-gpu',
      '--disable-dev-shm-usage', '--no-zygote', '--single-process',
      '--disable-extensions', '--disable-background-networking',
      '--disable-default-apps', '--disable-sync', '--disable-translate',
      '--hide-scrollbars', '--mute-audio', '--safebrowsing-disable-auto-update',
      '--js-flags=--max-old-space-size=256',
    ],
    protocolTimeout: 180000,
    timeout: 60000,
  };
}

function temizleLock(clientId) {
  const dir = path.join(__dirname, '.wwebjs_auth', 'session-' + clientId);
  ['SingletonLock','SingletonCookie','SingletonSocket'].forEach(f => {
    try { const p = path.join(dir, f); if (fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  });
}

// QR event'i dinleyenlere gönder (frontend /qr-image çeker)
function qrGonder(clientId) {
  const waiters = qrWaiters.get(clientId) || [];
  waiters.forEach(res => {
    try { res.write(`data: ${JSON.stringify({ tip: 'qr_hazir' })}\n\n`); } catch {}
  });
}

// Durum event'i dinleyenlere gönder
function durumGonder(clientId, tip, extra = {}) {
  const waiters = qrWaiters.get(clientId) || [];
  waiters.forEach(res => {
    try { res.write(`data: ${JSON.stringify({ tip, ...extra })}\n\n`); } catch {}
  });
}

function botOlustur(clientId, isim) {
  if (botManager.has(clientId)) {
    logger.warn('BOT_CREATE', `Bot zaten çalışıyor`, { clientId, isim });
    return botManager.get(clientId);
  }

  logger.info('BOT_CREATE', `Bot oluşturuluyor: "${isim}"`, { clientId });
  temizleLock(clientId);

  // ── Her bot için ayrı session klasörü ─────────────────────────
  const botSessionDir = path.join(SESSIONS_DIR, `bot_${clientId}`);
  
  // Klasörü oluştur (varsa sessioni kurtarır)
  try {
    if (!fs.existsSync(botSessionDir)) {
      fs.mkdirSync(botSessionDir, { recursive: true, mode: 0o755 });
      logger.info('BOT_SESSION', `Session klasörü oluşturuldu`, { clientId, path: botSessionDir });
    } else {
      // Var olan session'ı kullan (Reconnect — yeni QR gerekmez)
      logger.success('BOT_SESSION', `Var olan session bulundu, yeniden bağlanılıyor`, { clientId, path: botSessionDir });
    }
  } catch (err) {
    logger.error('BOT_SESSION', `Session klasörü oluşturulamadı (İZİN HATASI)`, err, { clientId, path: botSessionDir });
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: botSessionDir  // ← KRITIK: Her bot ayrı klasörde oturum saklıyor
    }),
    qrMaxRetries: 0,  // Sonsuz bekle — QR taranana kadar yenile
    puppeteer: puppeteerOpts(),
  });

  const bot = { 
    client, clientId, isim, 
    durum: 'baslatiliyor', 
    qrData: null, 
    _watchdog: null,
    _authHandled: false,  // ← Duplicate authenticated olayını prevent et
    _qrAttempts: 0,       // ← QR deneme sayısı (session corruption detect etmek için)
    _sessionDir: botSessionDir
  };
  botManager.set(clientId, bot);

  client.on('qr', qr => {
    bot.durum  = 'qr_bekleniyor';
    bot.qrData = qr;
    bot._authHandled = false;  // ← QR gene gösteriliyorsa, authenticated reset et
    bot._qrAttempts++;  // ← QR deneme sayısını artır
    
    botGuncelle(clientId, { durum: 'qr_bekleniyor' });
    logger.info('WHATSAPP_QR', `QR kod oluşturuldu, taranması bekleniyor`, { clientId, qrLength: qr.length, attemptNumber: bot._qrAttempts });
    console.log(`📱 [${clientId}] QR hazır (Deneme: ${bot._qrAttempts})`);
    
    // ─── Eğer reconnect sonrası 2+'nci QR geliyorsa = session corrupt ─────
    // Session file'ı sil ve clean restart yap
    if (bot._qrAttempts >= 2 && bot._sessionDir) {
      console.warn(`⚠️  [${clientId}] Session'ın 2. kez QR istiyor: Corrupted? Temizliyor...`);
      logger.warn('SESSION_CORRUPTION_DETECTED', 'Session dosyası corrupted, temizleniyor', {
        clientId,
        attemptCount: bot._qrAttempts,
        sessionDir: bot._sessionDir
      });
      
      // Session'ı sil
      try {
        if (fs.existsSync(bot._sessionDir)) {
          fs.rmSync(bot._sessionDir, { recursive: true, force: true });
          console.log(`🗑️  [${clientId}] Corrupted session silindi: ${bot._sessionDir}`);
        }
      } catch (err) {
        logger.error('SESSION_CLEANUP', 'Session silme hatası', err, { clientId });
      }
    }
    
    // SSE'ye qr_ready eventi gönder (frontend /qr-image endpoint'inden çeker)
    qrGonder(clientId, 'yeni');
  });

  client.on('authenticated', () => {
    // ─── Duplicate authenticated event'ini prevent et ─────────────────────
    if (bot._authHandled === true) {
      logger.debug('WHATSAPP_AUTH', 'Duplicate authenticated event ignored', { clientId });
      return;  // ← Sadece BİR sefer işlem yap
    }
    bot._authHandled = true;
    
    bot.durum  = 'dogrulandi';
    bot.qrData = null;
    botGuncelle(clientId, { durum: 'dogrulandi' });
    durumGonder(clientId, 'dogrulandi');
    logger.success('WHATSAPP_AUTH', `WhatsApp başarıyla doğrulandı`, { clientId });
    console.log(`✅ [${clientId}] Doğrulandı`);
  });

  client.on('ready', async () => {
    bot.durum = 'hazir';
    try {
      const info = client.info;
      const tel  = info?.wid?.user || '';
      botGuncelle(clientId, { durum: 'hazir', telefon: tel });
      bot.telefon = tel;
      durumGonder(clientId, 'hazir', { telefon: tel });
      logger.success('WHATSAPP_READY', `Bot hazır ve deneyime girdi`, { clientId, telefon: tel });
    } catch (err) {
      logger.error('WHATSAPP_READY', `Bot hazır fakat bilgi alınamadı`, err, { clientId });
      botGuncelle(clientId, { durum: 'hazir' });
    }
    console.log(`🤖 [${clientId}] Hazır!`);

    // ── Puppeteer tarayıcı çöküşü yakalama ──────────────────────────
    // Puppeteer kendi çökerse 'disconnected' eventi tetiklenmez — bunu ayrıca yakala
    try {
      client.pupBrowser.once('disconnected', () => {
        if (!botManager.has(clientId) || bot.durum !== 'hazir') return;
        console.warn(`💥 [${clientId}] Puppeteer çöktü — 20s sonra yeniden başlatılıyor...`);
        logger.warn('WHATSAPP_PUPPETEER_CRASH', 'Puppeteer browser çöktü, reconnect başlıyor', { clientId });
        bot.durum = 'baglanti_kesildi';
        botGuncelle(clientId, { durum: 'baglanti_kesildi' });
        durumGonder(clientId, 'baglanti_kesildi');
        if (bot._watchdog) { clearInterval(bot._watchdog); bot._watchdog = null; }
        setTimeout(async () => {
          if (!botManager.has(clientId)) return;
          
          // Clean browser shutdown
          try {
            if (bot.client && bot.client.pupBrowser) {
              await bot.client.pupBrowser.close().catch(() => {});
            }
          } catch (ex) {}
          
          try { await bot.client.destroy(); } catch {}
          botManager.delete(clientId);
          
          // Ek bekleme sonra restart
          setTimeout(async () => {
            const dbBot = require('./db').botBul(clientId);
            if (dbBot) botOlustur(clientId, dbBot.isim);
          }, 3_000);
        }, 20_000);
      });
    } catch {}

    // ── Heartbeat: Her 30 saniyede WhatsApp bağlantısını kontrol et ──
    // Silent disconnect (sessiz kopma) durumunu yakalar
    // Multi-session kickout'ları hızlıca yakalar
    if (bot._watchdog) clearInterval(bot._watchdog);
    bot._watchdog = setInterval(async () => {
      if (!botManager.has(clientId)) { clearInterval(bot._watchdog); return; }
      if (bot.durum !== 'hazir') return;
      try {
        const state = await client.getState();
        if (state !== 'CONNECTED') throw new Error(`durum=${state}`);
      } catch (e) {
        logger.error('HEARTBEAT', `Kalp atışı başarısız, bağlantı yeniden kurulacak`, e, { clientId });
        console.warn(`💓 [${clientId}] Heartbeat başarısız (${e.message}) — 5s sonra yeniden bağlanılıyor...`);
        clearInterval(bot._watchdog); bot._watchdog = null;
        bot.durum = 'baglanti_kesildi';
        botGuncelle(clientId, { durum: 'baglanti_kesildi' });
        durumGonder(clientId, 'baglanti_kesildi');
        
        // ── Hızlı reconnect (telefondan sync sırasında disconnect) ───────
        setTimeout(async () => {
          if (!botManager.has(clientId)) return;
          
          try { 
            if (bot.client && bot.client.pupBrowser) {
              await bot.client.pupBrowser.close().catch(() => {});
            }
          } catch (ex) {}
          
          try { await bot.client.destroy(); } catch {}
          botManager.delete(clientId);
          
          // 2 saniye sonra reconnect (token hala valid olur)
          setTimeout(async () => {
            const dbBot = require('./db').botBul(clientId);
            if (dbBot) {
              logger.info('HEARTBEAT_RECONNECT', 'Heartbeat fail sonrası quick reconnect', {
                clientId,
                isim: dbBot.isim,
                originalError: String(e.message).substring(0, 100)
              });
              botOlustur(clientId, dbBot.isim);
            }
          }, 2_000);
        }, 5_000);  // ← 5 saniye sonra reconnect (super hızlı!)
      }
    }, 30_000);  // ← 30 saniyede bir kontrol (2 dakikadan 4x daha sık)
  });

  client.on('message_create', async (msg) => {
    try {
      const body = msg.body || '';
      if (!body.trim()) return;
      if (msg.fromMe) return;
      // Durum (status) ve broadcast mesajlarını yoksay
      if (msg.isStatus) return;
      if (msg.from === 'status@broadcast') return;
      if (msg.id?.remote === 'status@broadcast') return;

      const chat = await msg.getChat();

      // ── WhatsApp Kanalı (Newsletter) ──────────────
      let isKanal = false;
      try {
        isKanal = chat.isChannel ||
                  msg.from?.endsWith('@newsletter') ||
                  msg.id?.remote?.endsWith('@newsletter');
      } catch { isKanal = false; }

      if (isKanal) {
        try {
          logger.info('CHANNEL_MESSAGE', `Kanal mesajı alındı`, { channel: chat.name || msg.from, text: body.slice(0, 50) });
          console.log(`📡 [${clientId}] KANAL MESAJI: ${chat.name || msg.from}`);
          
          if (isIlan(body)) {
            try {
              const cities    = extractCities(body);
              const linePairs = extractLinePairs(body);
              const timestamp = msg.timestamp * 1000;
              const hash      = contentHash(body);
              const kanalAdi  = chat.name || msg.from || 'Kanal';
              store.add(msg.from + '_' + msg.id.id, { text: body, cities, linePairs, chatName: kanalAdi, chatId: msg.from, senderName: kanalAdi, timestamp });
              
              try {
                ilanEkle({ hash: String(hash), text: body, cities, chatName: kanalAdi, chatId: msg.from, senderPhone: '', timestamp });
                logger.success('ILAN_SAVE', `İlan başarıyla kaydedildi`, { channel: kanalAdi, cities: cities.join(', '), textLength: body.length });
              } catch (dbErr) {
                logger.error('ILAN_SAVE', `İlan veritabanına kaydedilemedi`, dbErr, { channel: kanalAdi });
              }
              
              console.log(`💾 [${clientId}] 📡 Kanal: ${kanalAdi} | ${cities.join(', ')}`);
            } catch (parseErr) {
              logger.error('ILAN_PARSE', `İlan parse/işlem hatası`, parseErr, { channel: chat.name });
            }
          } else {
            logger.debug('CHANNEL_MESSAGE', `Mesaj ilan değil (kara liste veya telefon/şehir yok)`, { channel: chat.name || msg.from });
          }
        } catch (e) {
          logger.error('CHANNEL_PROCESS', `Kanal mesajı işlenirken genel hata`, e, { channel: chat.name });
          console.warn(`⚠️ [${clientId}] Kanal mesajı işlenemedi (önemsiz):`, e.message);
        }
        return;
      }

      // Özel mesaj: şehir araması
      if (!chat.isGroup) {
        const msgText = body.trim().substring(0, 100);
        logger.messageReceived(msg.from, msgText, msg.hasMedia);
        
        const sehirler = sehirCikarBot(body.trim());

        // Şehir araması değilse → karşılama mesajı gönder
        if (!sehirler.length) {
          logger.warn('CITY_EXTRACTION', `Mesajda şehir bulunamadı`, { from: msg.from, text: msgText });
          
          const karsilama =
            '👋 *Merhaba! YükleGit Destek Hattına hoş geldiniz.*\n\n' +
            '🚛 *Ne yapabilirim?*\n' +
            '• Şehir adı yazarak ilan arayabilirsiniz\n' +
            '  _Örnek: İstanbul, Ankara → İstanbul_\n\n' +
            '📦 *İlan aramak için:*\n' +
            'Sadece şehir adını veya "şehir1 şehir2" şeklinde yazın.\n\n' +
            '🌐 *Web paneli:* https://yuklegit.tr\n\n' +
            '_Teknik destek için mesajınızı bırakın, en kısa sürede dönüş yapılacaktır._';
          
          try {
            await msg.reply(karsilama);
            logger.messageSent(msg.from, 1, true);
          } catch (err) {
            logger.error('MESSAGE_SEND', 'Karşılama mesajı gönderilemedi', err, { from: msg.from });
          }
          return;
        }
        
        const [city1, city2] = sehirler;
        logger.cityCheck(city1, true, city1);
        if (city2) logger.cityCheck(city2, true, city2);
        
        try {
          const startTime = Date.now();
          const results = store.search(city1, city2 || null);
          const duration = Date.now() - startTime;
          logger.ilanSearch(city1, city2 || '-', results.length, duration);
          
          const baslik = city2 ? `🔍 *${city1.toUpperCase()} → ${city2.toUpperCase()}*`
                                : `🔍 *${city1.toUpperCase()}*`;
          if (!results.length) {
            logger.warn('SEARCH_RESULT', `Sonuç yok`, { city1, city2, resultCount: 0 });
            await msg.reply(baslik + '\n❌ Uygun ilan bulunamadı.\n_(Son 1 saat içindeki ilanlar gösterilir)_');
          } else {
            logger.success('SEARCH_RESULT', `Aramalar başarılı`, { city1, city2, resultCount: results.length });
            await msg.reply(baslik + '\n📦 ' + results.length + ' ilan\n' + '─'.repeat(28) + '\n\n' + formatResults(results, sehirler));
            logger.messageSent(msg.from, results.length, true);
          }
        } catch (err) {
          logger.error('SEARCH_PROCESS', `Arama işleminde hata`, err, { from: msg.from, city1, city2 });
          await msg.reply('❌ Arama sırasında hata oluştu. Lütfen tekrar deneyiniz.');
        }
        return;
      }

      // Grup: ilan kaydet
      // ── ÖNCE gönderenin numarasını al ──────────
      let senderPhone = '';
      try {
        const raw = (msg.author || msg.from || '').split('@')[0].replace(/\D/g, '');
        // 905XXXXXXXXX → +905XXXXXXXXX (13 hane)
        if (/^905\d{9}$/.test(raw)) {
          senderPhone = '+' + raw;
        }
      } catch {}

      // Metinde Türkiye telefon numarası var mı? (boşluklu format dahil)
      const metindeTel = containsPhone(body);

      // Metinde numara yoksa gönderenin numarasını ekle (isIlan kontrolünden ÖNCE)
      let finalText = body;
      if (!metindeTel && senderPhone) {
        finalText = body.trimEnd() + '\n📞 ' + senderPhone;
        console.log(`📞 [${clientId}] Numara eklendi: ${senderPhone}`);
      }

      // isIlan kontrolünü finalText üzerinde yap (gönderenin numarası dahil)
      const _hasTel  = containsPhone(finalText);
      const _hasCity = containsCity(finalText);
      const _blacklisted = isBlacklisted(finalText);

      if (!_blacklisted && _hasTel && _hasCity) {
        const cities    = extractCities(finalText);
        const linePairs = extractLinePairs(finalText);
        const timestamp = msg.timestamp * 1000;
        const hash      = contentHash(body); // dedup için orijinal body hash'i

        store.add(msg.from + '_' + msg.id.id, {
          text: finalText, cities, linePairs,
          chatName: chat.name || 'Grup',
          chatId: chat.id._serialized,
          senderName: msg.author || msg.from,
          timestamp,
        });
        ilanEkle({
          hash: String(hash), text: finalText, cities,
          chatName: chat.name || 'Grup',
          chatId: chat.id._serialized,
          senderPhone,
          timestamp,
        });
        console.log(`💾 [${clientId}] ${chat.name} | ${cities.join(', ')}`);
        if (isSamsunIlani(body)) samsunBildirimiGonder(client, { text: finalText, chatName: chat.name || 'Grup', timestamp });
      } else if (chat.isGroup) {
        // Debug: neden ilan değil? (her grup mesajı loglanır, tanı için)
        const sebep = _blacklisted ? 'kara-liste' : (!_hasTel ? 'telefon-yok' : 'sehir-yok');
        console.log(`⏭️  [${clientId}] ${chat.name} [${sebep}]: ${body.slice(0, 60).replace(/\n/g,' ')}`);
      }
    } catch (e) { console.error(`❌ [${clientId}]`, e.message); }
  });

  client.on('disconnected', async reason => {
    bot.durum  = 'baglanti_kesildi';
    bot.qrData = null;
    botGuncelle(clientId, { durum: 'baglanti_kesildi' });
    durumGonder(clientId, 'baglanti_kesildi');
    console.warn(`⚠️  [${clientId}] Bağlantı kesildi: ${reason}`);
    temizleLock(clientId);
    if (bot._watchdog) { clearInterval(bot._watchdog); bot._watchdog = null; }

    // ── Session'u kurtarma kontrolü ──────────────────────────────────────
    const botSessionDir = path.join(SESSIONS_DIR, `bot_${clientId}`);
    const sessionExists = fs.existsSync(botSessionDir);
    const authTokenFile = path.join(botSessionDir, 'session-data.json');
    const authValid = fs.existsSync(authTokenFile);

    // ── Multi-session kickout detection (telefondan işlem yapıldığında) ───
    // Eğer session valid ama disconnect oluyorsa = WhatsApp multi-session conflict
    const isMultiSessionKickout = authValid && sessionExists && !String(reason).toUpperCase().includes('LOGOUT');

    // Hangi durumda yeniden bağlan?
    // - LOGOUT: Telefon WhatsApp Web'den "bağlı cihazlardan çıkış" → QR lazım
    // - Multi-session kickout: Telefondan sync → Token hala var → SUPER HIZLI reconnect
    // - CONNECTION_ERROR: İnternet kesildi → Normal reconnect
    const isLogout = String(reason).toUpperCase() === 'LOGOUT';
    let bekleme;
    
    if (isMultiSessionKickout) {
      bekleme = 3_000;  // ← 3 saniye (telefondan işlem yapılırken en hızlı reconnect)
      console.log(`📲 [${clientId}] Multi-session kickout detected! Hızlı reconnect: 3 saniye`);
    } else if (isLogout) {
      bekleme = 5_000;  // ← 5 saniye (admin QR tarayacak)
    } else {
      bekleme = 10_000; // ← 10 saniye (connection error, daha stabil reconnect)
    }

    logger.warn('WHATSAPP_DISCONNECT', `Bot bağlantısı kesildi`, {
      clientId,
      reason: String(reason),
      sessionExists,
      hasAuthToken: authValid,
      isMultiSessionKickout,
      reconnectDelay: `${bekleme / 1000}s`,
      action: isLogout ? 'QR gerekecek' : isMultiSessionKickout ? 'Token ile reconnect' : 'Normal reconnect'
    });

    console.log(`🔄 [${clientId}] ${bekleme / 1000}s sonra yeniden bağlanılıyor...`);
    console.log(`   Sebep: ${reason} | Session: ${sessionExists ? 'var ✅' : 'yok ❌'} | Token: ${authValid ? 'geçerli ✅' : 'geçersiz ❌'}`);
    if (isMultiSessionKickout) console.log(`   📲 Multi-session çakışması algılandı - hızlı reconnect!`);

    setTimeout(async () => {
      if (!botManager.has(clientId)) return;
      
      // ─── Browser cleanup (Puppeteer crash'lerini önlemek için) ───
      try {
        if (bot.client && bot.client.pupBrowser) {
          await bot.client.pupBrowser.close().catch(() => {});
        }
      } catch (e) {}
      
      try { 
        await bot.client.destroy(); 
      } catch (e) {}
      
      botManager.delete(clientId);
      
      // ─── Biraz daha bekle ki Puppeteer process kapanışı tamamlansın ───
      setTimeout(async () => {
        const dbBot = require('./db').botBul(clientId);
        if (dbBot) {
          logger.info('BOT_RECONNECT', `Bot yeniden başlatılıyor`, {
            clientId,
            isim: dbBot.isim,
            sessionWasAvailable: sessionExists,
            reconnectType: reason
          });
          botOlustur(clientId, dbBot.isim);
        } else {
          logger.error('BOT_RECONNECT', `Bot veritabanında bulunamadı, reconnect başarısız`, new Error('Bot not found'), { clientId });
        }
      }, 2_000);  // ← Ek 2 saniye bekleme
    }, bekleme);
  });

  client.initialize().catch(e => {
    logger.error('BOT_INIT', 'Client initialize basarisiz', e, { clientId });
    bot.durum = 'hata';
    botGuncelle(clientId, { durum: 'hata' });
  });

  return bot;
}

async function botDurdur(clientId) {
  const bot = botManager.get(clientId);
  if (!bot) return;
  if (bot._watchdog) { clearInterval(bot._watchdog); bot._watchdog = null; }
  
  // Browser'ı force close et (Puppeteer crash'leri önlemek için)
  try {
    if (bot.client && bot.client.pupBrowser) {
      await bot.client.pupBrowser.close().catch(() => {});
    }
  } catch (e) {
    logger.debug('BOT_SHUTDOWN', 'Browser kapatma hatası', { clientId, error: String(e) });
  }
  
  // Client'ı destroy et
  try { 
    await bot.client.destroy(); 
  } catch (e) {
    logger.debug('BOT_SHUTDOWN', 'Client destroy hatası', { clientId, error: String(e) });
  }
  
  temizleLock(clientId);
  botManager.delete(clientId);
}

// Şehir çıkarıcı (bot özel mesajlar için)
function sehirCikarBot(metin) {
  const temiz = normalize(metin)
    .replace(/\bdan\b/g,' ').replace(/\bden\b/g,' ')
    .replace(/\bdan$/g,' ').replace(/\bden$/g,' ')
    .replace(/\ba\b/g,' ').replace(/\be\b/g,' ')
    .replace(/[-_>→|/\\,;]/g,' ').replace(/\s+/g,' ').trim();
  const kelimeler = temiz.split(' ').filter(Boolean);
  if (kelimeler.length > 5) return [];
  const bulunanlar = [];
  const kullanildi = new Set();
  for (let i = 0; i < kelimeler.length - 1; i++) {
    if (kullanildi.has(i) || kullanildi.has(i+1)) continue;
    const eslesen = CONFIG.CITIES.find(c => normalize(c) === kelimeler[i]+' '+kelimeler[i+1]);
    if (eslesen) { bulunanlar.push({ sehir: eslesen, pos: i }); kullanildi.add(i); kullanildi.add(i+1); }
  }
  for (let i = 0; i < kelimeler.length; i++) {
    if (kullanildi.has(i)) continue;
    const eslesen = CONFIG.CITIES.find(c => normalize(c) === kelimeler[i]);
    if (eslesen) { bulunanlar.push({ sehir: eslesen, pos: i }); kullanildi.add(i); }
  }
  const sehirDisi = kelimeler.filter((_, i) => !kullanildi.has(i)).filter(k => k.length > 2);
  if (sehirDisi.length > 1) return [];
  bulunanlar.sort((a,b) => a.pos - b.pos);
  return bulunanlar.map(b => b.sehir);
}

// Samsun bildirimi — hangi client gönderecek bilgisi eklendi
async function samsunBildirimiGonder(senderClient, ilan) {
  try {
    const hash = contentHash(ilan.text);
    if (_samsunGonderildi.has(hash)) return;
    _samsunGonderildi.add(hash);
    setTimeout(() => _samsunGonderildi.delete(hash), 60*60*1000);
    const hedefNumara = '905015303028@c.us';
    const chat = await senderClient.getChatById(hedefNumara);
    await chat.sendMessage('🔔 *YENİ SAMSUN İLANI*\n──────────────────────\n📍 *Grup:* ' + ilan.chatName + '\n⏱ ' + timeAgo(ilan.timestamp) + '\n\n' + ilan.text.trim());
  } catch (err) { console.warn('⚠️ Samsun bildirimi gönderilemedi:', err.message); }
}

// ── Başlangıç: DB'deki tüm botları başlat ──────
function mevcutBotlariBaslat() {
  logger.info('STARTUP', 'Kayıtlı botlar yükleniyor...', {});
  
  const dbBotlar = tumBotlar();
  if (dbBotlar.length === 0) {
    logger.warn('STARTUP', 'Kayıtlı bot bulunamadı', { count: 0 });
    
    // Geriye dönük uyumluluk: eski tek bot varsa otomatik ekle
    const eskiSessionVar = fs.existsSync(path.join(__dirname, '.wwebjs_auth', 'session-lojistik-bot'));
    if (eskiSessionVar) {
      logger.info('STARTUP', 'Eski oturum bulundu, otomatik ekleniyor', { clientId: 'lojistik-bot' });
      botEkle({ isim: 'Ana Bot', clientId: 'lojistik-bot' });
      botOlustur('lojistik-bot', 'Ana Bot');
      console.log('🤖 Eski oturum bulundu, Ana Bot başlatıldı.');
    } else {
      logger.info('STARTUP', 'Yeni kurulum - bot eklemek için admin panelini kullanın', {});
      console.log('ℹ️  Kayıtlı bot yok. Admin panelinden bot ekleyin.');
    }
    return;
  }
  
  logger.success('STARTUP', `${dbBotlar.length} bot bulundu, başlatılıyor`, { botCount: dbBotlar.length, bots: dbBotlar.map(b => b.isim) });
  
  dbBotlar.forEach(bot => {
    logger.info('STARTUP', `Bot başlatılacak: "${bot.isim}"`, { clientId: bot.clientId });
    console.log(`🤖 [${bot.clientId}] "${bot.isim}" başlatılıyor...`);
    botOlustur(bot.clientId, bot.isim);
  });
}

process.on('unhandledRejection', r => {
  logger.error('UNHANDLED_REJECTION', 'İşlenmemiş promise reddi', r, { error: String(r?.message || r) });
  console.warn('⚠️  Hata (devam):', r?.message || r);
});

process.on('uncaughtException', e => {
  logger.error('UNCAUGHT_EXCEPTION', 'Yakalanmamış exception', e, { error: e.message });
  console.warn('⚠️  Exception (devam):', e.message);
});

// Düzgün kapanma
let _kapaniyor = false;
async function gracefulShutdown(signal) {
  if (_kapaniyor) return;
  _kapaniyor = true;
  logger.info('SHUTDOWN', `Shutdown sinyali alındı: ${signal}`, { signal });
  console.log(`\n🛑 ${signal} alındı, kapatılıyor...`);
  for (const [clientId] of botManager) { 
    logger.info('SHUTDOWN', `Bot kapatılıyor`, { clientId });
    await botDurdur(clientId); 
  }
  logger.success('SHUTDOWN', 'Sistem başarıyla kapatıldı', {});
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Web panelini başlat
logger.info('SERVER', 'HTTP Server başlatılıyor...', {});
try {
  startServer(store, CONFIG, botManager, botOlustur, botDurdur, qrWaiters);
  logger.success('SERVER', 'HTTP Server başarıyla başlatıldı', {});
} catch (err) {
  logger.error('SERVER', 'HTTP Server başlatılamadı', err, {});
}

logger.info('STARTUP', 'WhatsApp Botlarının başlatılması başlıyor...', {});
mevcutBotlariBaslat();

// Log raporu yazdır
setTimeout(() => {
  const report = logger.getErrorReport();
  if (report.hataCount > 0 || report.uyariCount > 0) {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 BAŞLATMA ÖZETİ');
    console.log('═'.repeat(50));
    console.log(`✅ Başarılı işlemler: ${logger.getSuccessReport().basariCount}`);
    console.log(`⚠️  Uyarılar: ${report.uyariCount}`);
    console.log(`❌ Hatalar: ${report.hataCount}`);
    console.log(`📄 Log dosyası: ${report.logFile}`);
    console.log('═'.repeat(50) + '\n');
  }
}, 5000);

