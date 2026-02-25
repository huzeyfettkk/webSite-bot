/**
 * Türkiye İl → İlçe Haritası
 * İl aratıldığında tüm ilçeleri de kapsar.
 */

const IL_ILCE = {
  'adana':          ['seyhan','çukurova','yüreğir','sarıçam','ceyhan','kozan','feke','imamoglu','imamoğlu','karaisalı','karataş','pozantı','saimbeyli','tufanbeyli','yumurtalık','aladağ','akyatan'],
  'adıyaman':       ['besni','çelikhan','gerger','gölbaşı','kahta','samsat','sincik','tut'],
  'afyon':          ['başmakçı','bayat','bolvadin','çay','çobanlar','dazkırı','dinar','emirdağ','evciler','hocalar','ihsaniye','iscehisar','kızılören','sandıklı','sinanpaşa','sultandağı','şuhut'],
  'ağrı':           ['diyadin','doğubayazıt','eleşkirt','hamur','patnos','taşlıçay','tutak'],
  'aksaray':        ['ağaçören','eskil','gülağaç','güzelyurt','ortaköy','sarıyahşi','sultanhanı'],
  'amasya':         ['göynücek','gümüşhacıköy','hamamözü','merzifon','suluova','taşova'],
  'ankara':         ['altındağ','çankaya','etimesgut','keçiören','mamak','sincan','yenimahalle','pursaklar','gölbaşı','polatlı','beypazarı','nallıhan','güdül','kızılcahamam','çamlıdere','ayaş','bala','çubuk','elmadağ','evren','haymana','kahramankazan','kalecik','şereflikoçhisar'],
  'antalya':        ['aksu','alanya','demre','döşemealtı','elmalı','finike','gazipaşa','gündoğmuş','ibradı','kaş','kemer','kepez','konyaaltı','korkuteli','kumluca','manavgat','muratpaşa','akseki','serik'],
  'ardahan':        ['çıldır','damal','göle','hanak','posof'],
  'artvin':         ['ardanuç','arhavi','borçka','hopa','kemalpaşa','murgul','şavşat','yusufeli'],
  'aydın':          ['efeler','bozdoğan','buharkent','çine','didim','germencik','incirliova','karacasu','karpuzlu','koçarlı','köşk','kuşadası','kuyucak','nazilli','söke','sultanhisar','yenipazar'],
  'balıkesir':      ['altıeylül','karesi','ayvalık','balya','bandırma','bigadiç','burhaniye','dursunbey','edremit','erdek','gömeç','gönen','havran','ivrindi','kepsut','manyas','marmara','pamukçu','savaştepe','sındırgı','susurluk'],
  'bartın':         ['amasra','kurucaşile','ulus'],
  'batman':         ['beşiri','gercüş','hasankeyf','kozluk','sason'],
  'bayburt':        ['aydıntepe','demirözü'],
  'bilecik':        ['bozüyük','gölpazarı','inhisar','osmaneli','pazaryeri','söğüt','yenipazar'],
  'bingöl':         ['adaklı','genç','karlıova','kiğı','solhan','yayladere','yedisu'],
  'bitlis':         ['adilcevaz','ahlat','güroymak','hizan','mutki','tatvan'],
  'bolu':           ['dörtdivan','gerede','göynük','kıbrıscık','mengen','mudurnu','seben','yeniçağa'],
  'burdur':         ['ağlasun','altınyayla','bucak','çavdır','çeltikçi','gölhisar','karamanlı','kemer','tefenni','yeşilova'],
  'bursa':          ['nilüfer','osmangazi','yıldırım','büyükorhan','gemlik','gürsu','harmancık','inegöl','iznik','karacabey','keles','kestel','mudanya','mustafakemalpaşa','orhaneli','orhangazi','yenişehir'],
  'çanakkale':      ['ayvacık','bayramiç','biga','bozcaada','çan','eceabat','ezine','gelibolu','gökçeada','lapseki','yenice'],
  'çankırı':        ['atkaracalar','bayramören','çerkeş','eldivan','hanönü','ilgaz','kızılırmak','korgun','kurşunlu','orta','şabanözü','yapraklı'],
  'çorum':          ['alaca','bayat','boğazkale','dodurga','iskilip','kargı','laçin','mecitözü','oğuzlar','ortaköy','osmancık','sungurlu','uğurludağ'],
  'denizli':        ['pamukkale','merkezefendi','acıpayam','babadağ','baklan','bekilli','beyağaç','bozkurt','buldan','çal','çameli','çardak','çivril','güney','honaz','kale','sarayköy','serinhisar','tavas'],
  'diyarbakır':     ['bağlar','kayapınar','sur','yenişehir','bismil','çermik','çınar','çüngüş','dicle','eğil','ergani','hani','hazro','kocaköy','kulp','lice','silvan'],
  'düzce':          ['akçakoca','cumayeri','çilimli','gölyaka','gümüşova','kaynaşlı','yığılca'],
  'edirne':         ['enez','havsa','ipsala','keşan','lalapaşa','meriç','süloğlu','uzunköprü'],
  'elazığ':         ['ağın','alacakaya','arıcak','baskil','karakoçan','keban','kovancılar','maden','palu','sivrice'],
  'erzincan':       ['çayırlı','iliç','kemah','kemaliye','otlukbeli','refahiye','tercan','üzümlü'],
  'erzurum':        ['yakutiye','aziziye','palandöken','aşkale','çat','hınıs','horasan','karayazı','karaçoban','narman','oltu','olur','pasinler','pazaryolu','şenkaya','tekman','tortum','uzundere'],
  'eskişehir':      ['odunpazarı','tepebaşı','alpu','beylikova','çifteler','günyüzü','han','inönü','mahmudiye','mihalgazi','mihaliççık','sarıcakaya','seyitgazi','sivrihisar'],
  'gaziantep':      ['şahinbey','şehitkamil','araban','islahiye','karkamış','nizip','nurdağı','oğuzeli','yavuzeli'],
  'giresun':        ['alucra','bulancak','çamoluk','çanakçı','dereli','doğankent','espiye','eynesil','görele','güce','keşap','piraziz','şebinkarahisar','tirebolu','yağlıdere'],
  'gümüşhane':      ['kelkit','köse','kürtün','şiran','torul'],
  'hakkari':        ['çukurca','şemdinli','yüksekova'],
  'hatay':          ['antakya','arsuz','belen','defne','dörtyol','erzin','hassa','iskenderun','kırıkhan','kumlu','payas','reyhanlı','samandağ','yayladağı','altınözü'],
  'ısparta':        ['aksu','atabey','eğirdir','gelendost','gönen','keçiborlu','senirkent','sütçüler','şarkikaraağaç','uluborlu','yalvaç','yenişarbademli'],
  'iğdır':          ['aralık','karakoyunlu','tuzluca'],
  'istanbul':       ['adalar','arnavutköy','ataşehir','avcılar','bağcılar','bahçelievler','bakırköy','başakşehir','bayrampaşa','beşiktaş','beykoz','beylikdüzü','beyoğlu','büyükçekmece','çatalca','çekmeköy','esenler','esenyurt','eyüpsultan','fatih','gaziosmanpaşa','güngören','kadıköy','kağıthane','kartal','küçükçekmece','maltepe','pendik','sancaktepe','sarıyer','silivri','sultanbeyli','sultangazi','şile','şişli','tuzla','ümraniye','üsküdar','zeytinburnu','ikitelli'],
  'izmir':          ['balçova','bayındır','bayraklı','bergama','beydağ','bornova','buca','çeşme','çiğli','dikili','foça','gaziemir','güzelbahçe','karabağlar','karaburun','karşıyaka','kemalpaşa','kiraz','konak','kınık','menderes','menemen','narlıdere','ödemiş','seferihisar','selçuk','tire','torbalı','urla'],
  'kahramanmaraş':  ['dulkadiroğlu','onikişubat','afşin','andırın','çağlayancerit','ekinözü','elbistan','göksun','nurhak','pazarcık','türkoğlu'],
  'karabük':        ['eflani','eskipazar','ovacık','safranbolu','yenice'],
  'karaman':        ['ayrancı','başyayla','ermenek','kazımkarabekir','sarıveliler'],
  'kars':           ['akyaka','arpaçay','digor','kağızman','sarıkamış','selim','susuz'],
  'kastamonu':      ['abana','ağlı','araç','azdavay','bozkurt','cide','çatalzeytin','daday','devrekani','doğanyurt','hanönü','ihsangazi','inebolu','küre','pınarbaşı','seydiler','şenpazar','taşköprü','tosya'],
  'kayseri':        ['kocasinan','melikgazi','akkışla','bünyan','develi','felahiye','hacılar','incesu','özvatan','pınarbaşı','sarıoğlan','sarız','talas','tomarza','yahyalı','yeşilhisar'],
  'kilis':          ['elbeyli','musabeyli','polateli'],
  'kırıkkale':      ['bahşili','balışeyh','çelebi','delice','karakeçili','keskin','sulakyurt','yahşihan'],
  'kırklareli':     ['babaeski','demirköy','kofçaz','lüleburgaz','pehlivanköy','pınarhisar','vize'],
  'kırşehir':       ['akçakent','akpınar','boztepe','çiçekdağı','kaman','mucur'],
  'kilis':          ['elbeyli','musabeyli','polateli'],
  'kocaeli':        ['başiskele','çayırova','darıca','derince','dilovası','gebze','gölcük','izmit','kandıra','karamürsel','kartepe','körfez'],
  'konya':          ['karatay','meram','selçuklu','ahırlı','akören','akşehir','altınekin','beyşehir','bozkır','cihanbeyli','çeltik','çumra','derbent','derebucak','doğanhisar','emirgazi','ereğli','güneysınır','hadim','halkapınar','hüyük','ilgın','kadınhanı','karapınar','kulu','sarayönü','seydişehir','taşkent','tuzlukçu','yalıhüyük','yunak'],
  'kütahya':        ['altıntaş','aslanapa','çavdarhisar','domaniç','dumlupınar','emet','gediz','hisarcık','pazarlar','şaphane','simav','tavşanlı'],
  'malatya':        ['battalgazi','yeşilyurt','akçadağ','arapgir','arguvan','darende','doğanşehir','doğanyol','hekimhan','kale','kuluncak','pütürge','yazıhan'],
  'manisa':         ['şehzadeler','yunusemre','ahmetli','akhisar','alaşehir','demirci','gölmarmara','gördes','kula','köprübaşı','kırkağaç','salihli','sarıgöl','saruhanlı','selendi','soma','turgutlu'],
  'mardin':         ['artuklu','dargeçit','derik','kızıltepe','mazıdağı','midyat','nusaybin','ömerli','savur','yeşilli'],
  'mersin':         ['akdeniz','mezitli','silifke','toroslar','yenişehir','anamur','aydıncık','bozyazı','çamlıyayla','erdemli','gülnar','mut','tarsus'],
  'muğla':          ['bodrum','dalaman','datça','fethiye','kavaklıdere','köyceğiz','marmaris','menteşe','milas','ortaca','seydikemer','ula','yatağan'],
  'muş':            ['bulanık','hasköy','korkut','malazgirt','varto'],
  'nevşehir':       ['acıgöl','avanos','derinkuyu','gülşehir','hacıbektaş','kozaklı','ürgüp'],
  'niğde':          ['altunhisar','bor','çamardı','çiftlik','ulukışla'],
  'ordu':           ['altınordu','akkuş','aybastı','çamaş','çatalpınar','çaybaşı','fatsa','gölköy','gülyalı','gürgentepe','ikizce','kabadüz','kabataş','korgan','kumru','mesudiye','perşembe','ulubey','ünye'],
  'osmaniye':       ['bahçe','düziçi','hasanbeyli','kadirli','sumbas','toprakkale'],
  'rize':           ['ardeşen','çamlıhemşin','çayeli','derepazarı','fındıklı','güneysu','hemşin','ikizdere','iyidere','kalkandere','pazar'],
  'sakarya':        ['adapazarı','akyazı','arifiye','erenler','ferizli','geyve','hendek','karapürçek','karasu','kaynarca','kocaali','pamukova','sapanca','serdivan','söğütlü','taraklı'],
  'samsun':         ['atakum','canik','ilkadım','tekkeköy','19mayıs','alaçam','asarcık','ayvacık','bafra','çarşamba','havza','kavak','ladik','salıpazarı','terme','vezirköprü','yakakent','ondokuzmayıs'],
  'siirt':          ['baykan','eruh','kurtalan','pervari','şirvan','tillo'],
  'sinop':          ['ayancık','boyabat','dikmen','durağan','erfelek','gerze','saraydüzü','türkeli'],
  'sivas':          ['akıncılar','altınyayla','divriği','doğanşar','gemerek','gölova','hafik','imranlı','kangal','koyulhisar','şarkışla','suşehri','ulaş','yıldızeli','zara'],
  'şanlıurfa':      ['karaköprü','eyyübiye','haliliye','akçakale','birecik','bozova','ceylanpınar','halfeti','harran','hilvan','siverek','suruç','viranşehir'],
  'şırnak':         ['beytüşşebap','cizre','güçlükonak','idil','silopi','uludere'],
  'tekirdağ':       ['süleymanpaşa','çerkezköy','çorlu','ergene','hayrabolu','malkara','marmara ereğlisi','muratlı','saray','şarköy','kapaklı'],
  'tokat':          ['almus','artova','başçiftlik','erbaa','niksar','pazar','reşadiye','sulusaray','turhal','yeşilyurt','zile'],
  'trabzon':        ['ortahisar','akçaabat','araklı','arsin','beşikdüzü','çarşıbaşı','çaykara','çakırgöl','dernekpazarı','düzköy','hayrat','köprübaşı','maçka','of','sürmene','şalpazarı','tonya','vakfıkebir','yomra'],
  'tunceli':        ['çemişgezek','hozat','mazgirt','nazimiye','ovacık','pertek','pülümür'],
  'uşak':           ['banaz','eşme','karahallı','sivaslı','ulubey'],
  'van':            ['ipekyolu','tusba','edremit','bahçesaray','başkale','çaldıran','çatak','erciş','gevaş','gürpınar','muradiye','özalp','saray'],
  'yalova':         ['altınova','armutlu','çınarcık','çiftlikköy','termal'],
  'yozgat':         ['akdağmadeni','aydıncık','boğazlıyan','çandır','çayıralan','çekerek','kadışehri','saraykent','sarıkaya','sorgun','şefaatli','yenifakılı','yerköy'],
  'zonguldak':      ['alaplı','çaycuma','devrek','ere','gökçebey','kilimli','kozlu'],
};

const normStr = s => s.toLowerCase()
  .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
  .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
  .replace(/İ/g,'i').replace(/Ğ/g,'g').replace(/Ü/g,'u')
  .replace(/Ş/g,'s').replace(/Ö/g,'o').replace(/Ç/g,'c').trim();

/**
 * Verilen şehir/il adının hangi ile ait olduğunu döndürür.
 * İl girilmişse: { il, ilceler: [il, ...tümİlçeler] }
 * İlçe girilmişse: { il: 'bağlıOlduğuİl', ilceler: [ilçe] }
 * Bulunamazsa: { il: null, ilceler: [sehir] }
 */
function getIlBilgisi(sehir) {
  const ns = normStr(sehir);
  // İl mi?
  for (const [il, ilceler] of Object.entries(IL_ILCE)) {
    if (normStr(il) === ns) {
      return { il, ilceler: [il, ...ilceler] };
    }
  }
  // İlçe mi? Hangi ile bağlı?
  for (const [il, ilceler] of Object.entries(IL_ILCE)) {
    if (ilceler.some(i => normStr(i) === ns)) {
      return { il, ilceler: [sehir] };
    }
  }
  return { il: null, ilceler: [sehir] };
}

/**
 * Verilen şehir/il adının tüm ilçelerini döndürür.
 */
function getIlVeIlceleri(sehir) {
  return getIlBilgisi(sehir).ilceler;
}

/**
 * İki şehrin aynı ile mi ait olduğunu kontrol eder.
 * "İzmir - Buca" doğru, "Burdur - Buca" yanlış.
 */
function ayniIlMi(sehir1, sehir2) {
  const b1 = getIlBilgisi(sehir1);
  const b2 = getIlBilgisi(sehir2);
  // İkisi de il ise zaten ayrı
  const ns1 = normStr(sehir1), ns2 = normStr(sehir2);
  const il1 = b1.il, il2 = b2.il;
  if (!il1 || !il2) return false;
  return il1 === il2;
}

module.exports = { IL_ILCE, getIlVeIlceleri, getIlBilgisi, ayniIlMi, normStr };
