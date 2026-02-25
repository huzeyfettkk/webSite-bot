/**
 * WhatsApp Lojistik Takip ve Arama Botu
 * whatsapp-web.js kullanarak yazılmıştır.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const { startServer } = require('./server');
const { ilanEkle }    = require('./db');
const qrcode          = require('qrcode-terminal');

const CONFIG = {
  TTL_MS: 1 * 60 * 60 * 1000, // 1 saat

  PHONE_REGEX: /(\+?\d[\d\s\-().]{7,}\d)/g,

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
  CONFIG.PHONE_REGEX.lastIndex = 0;
  return CONFIG.PHONE_REGEX.test(text);
}

function extractCities(text) {
  const norm = ' ' + normalize(text) + ' ';
  return CONFIG.CITIES.filter(c => norm.includes(' ' + normalize(c) + ' '));
}

// Kara liste: normalize sonrası substring kontrolü
// "KIZILTEPE", "Kızıltepe'den", "kizil-tepe" hepsi yakalanır
function isBlacklisted(text) {
  const norm = normalize(text);
  return CONFIG.BLACKLIST.some(w => norm.includes(normalize(w)));
}

function isIlan(text) {
  if (isBlacklisted(text)) return false;
  return containsPhone(text) && extractCities(text).length >= 1;
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

  search(city1, city2) {
    const c1 = normalize(city1);
    const c2 = city2 ? normalize(city2) : null;
    const results = [];

    for (const [, ilan] of this._store) {
      let matched = false;

      if (!c2) {
        // Tek şehir: cities listesinde var mı veya metinde geçiyor mu?
        if (ilan.cities && ilan.cities.some(c => normalize(c) === c1)) {
          matched = true;
        } else {
          const t = ' ' + normalize(ilan.text) + ' ';
          matched = t.includes(' ' + c1 + ' ');
        }
      } else {
        // İki şehir: cities listesinde sıra doğru mu?
        if (ilan.cities && ilan.cities.length >= 2) {
          const i1 = ilan.cities.findIndex(c => normalize(c) === c1);
          const i2 = ilan.cities.findIndex(c => normalize(c) === c2);
          if (i1 !== -1 && i2 !== -1 && i1 < i2) {
            matched = true;
          }
        }

        // cities'de bulunamadıysa metin bazlı pozisyon kontrolü
        if (!matched) {
          const text = normalize(ilan.text);
          const pos1 = text.indexOf(c1);
          const pos2 = text.indexOf(c2);
          matched = pos1 !== -1 && pos2 !== -1 && pos1 < pos2;
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

// ── Ana Bot ────────────────────────────────────
const store  = new IlanStore();
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'lojistik-bot' }),
  qrMaxRetries: 0, // QR süresiz beklesin, otomatik yenilenmesin
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      ...(process.platform === 'linux' ? ['--disable-dev-shm-usage', '--no-zygote', '--single-process'] : []),
    ],
    protocolTimeout: 120000,
    timeout: 120000,
  },
});

client.on('qr', qr => {
  console.log('\n📱 QR kodu telefonunuzla taratın:\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => console.log('✅ Kimlik doğrulandı.'));

client.on('ready', () => {
  console.log('🤖 Bot hazır! Yeni ilanlar otomatik yakalanacak.');
});


client.on('message_create', async (msg) => {
  try {
    const body = msg.body || '';
    if (!body.trim()) return;
    const chat = await msg.getChat();

    // ── Özel sohbet: arama ──
    if (!chat.isGroup) {
      // Sadece bize gelen mesajlara cevap ver, kendi gönderdiğimize değil
      if (msg.fromMe) return;

      const parts = body.trim().split(/\s+/);
      const known = parts.filter(p => CONFIG.CITIES.some(c => normalize(c) === normalize(p)));
      if (known.length === 0 || parts.length > 2) return;

      const [city1, city2] = parts;
      const searchCities   = parts.filter(p => known.map(normalize).includes(normalize(p)));
      const results        = store.search(city1, city2 || null);
      await msg.reply(formatResults(results, searchCities));
      console.log(`🔍 "${parts.join(' → ')}" | ${results.length} sonuç`);
      return;
    }

    // ── Grup: ilan kaydet ──
    if (isIlan(body)) {
      const cities    = extractCities(body);
      const timestamp = msg.timestamp * 1000;
      const hash      = contentHash(body);

      // RAM store (anlık arama için)
      store.add(`${msg.from}_${msg.id.id}`, {
        text: body, cities,
        chatName:   chat.name || 'Grup',
        chatId:     chat.id._serialized,
        senderName: msg.author || msg.from,
        timestamp,
      });

      // SQLite (kalıcı, 24 saatlik geçmiş)
      ilanEkle({
        hash:        String(hash),
        text:        body,
        cities,
        chatName:    chat.name || 'Grup',
        chatId:      chat.id._serialized,
        senderPhone: '',
        timestamp,
      });

      console.log(`💾 ${chat.name} | ${cities.join(', ')} | toplam: ${store.size()}`);
      if (isSamsunIlani(body)) {
        samsunBildirimiGonder({ text: body, chatName: chat.name || 'Grup', timestamp });
      }
    }
  } catch (e) {
    console.error('❌', e.message);
  }
});

client.on('disconnected', async reason => {
  console.warn('⚠️  Bağlantı kesildi:', reason);
  console.log('🔄 15 saniye sonra yeniden bağlanılıyor...');
  temizleLockDosyalari();
  setTimeout(async () => {
    try { await client.initialize(); }
    catch (e) { console.error('❌ Yeniden bağlanma başarısız:', e.message); process.exit(1); }
  }, 15_000);
});

process.on('unhandledRejection', r => console.warn('⚠️  Hata (devam):', r?.message || r));
process.on('uncaughtException', e => console.warn('⚠️  Exception (devam):', e.message));

// ── Düzgün Kapanma ──────────────────────────────
// PM2 stop/restart veya Ctrl+C sinyallerinde Chrome'u düzgün kapat
let _kapaniyor = false;
async function gracefulShutdown(signal) {
  if (_kapaniyor) return;
  _kapaniyor = true;
  console.log(`\n🛑 ${signal} alındı, düzgün kapatılıyor...`);
  try {
    await client.destroy();
    console.log('✅ WhatsApp bağlantısı kapatıldı.');
  } catch (e) {
    console.warn('⚠️  Client kapatma hatası:', e.message);
  }
  temizleLockDosyalari();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // PM2 stop
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));  // Ctrl+C

// ── Lock Dosyası Temizleyici ─────────────────────
// Başlarken veya kapanırken SingletonLock kalıntılarını sil
function temizleLockDosyalari() {
  const fs       = require('fs');
  const path     = require('path');
  const sesyonDr = path.join(__dirname, '.wwebjs_auth', 'session-lojistik-bot');
  ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
    const dosya = path.join(sesyonDr, f);
    try { if (fs.existsSync(dosya)) { fs.unlinkSync(dosya); console.log(`🧹 ${f} temizlendi.`); } }
    catch (e) { /* sessizce geç */ }
  });
}

// Başlarken lock kalıntılarını temizle
temizleLockDosyalari();

// Web panelini başlat
startServer(store, CONFIG);

client.initialize();
