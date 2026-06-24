/**
 * ScripON knowledge · COUNTRY → ERA SUBSTRATE
 * -------------------------------------------
 * A country isn't a tag — it's an ordered timeline of the civilisations that lived there, each
 * with its own language register, script, accent/dialect, naming, dress and sacred sensitivity.
 * The era a story sits in drives how characters speak, are named, and what is off-limits.
 * Guideline + sources: docs/knowledge-base/scripon/04-country-era-language.md
 *
 * Worked timelines are intentionally finite (the ones we sourced). Unknown countries return no
 * era directive rather than guessing — extend this file with new rows, never branch the engine.
 */

export interface Era {
  key: string;
  label: string;
  ar?: string;
  span: string;
  highRegister: string;   // formal / literary language
  lowRegister: string;    // everyday speech
  script?: string;
  diglossia?: boolean;    // is the high/low gap wide enough to write to?
  accentNotes?: string;
  naming?: string;
  dress?: string;
  sacred?: 'none' | 'aware' | 'high';
}

export interface CountryTimeline { country: string; aliases: string[]; eras: Era[]; }

export const COUNTRY_ERAS: CountryTimeline[] = [
  {
    country: 'Egypt', aliases: ['egypt', 'مصر', 'egyptian'],
    eras: [
      { key: 'pharaonic', label: 'Pharaonic', span: 'c.3100–664 BC', highRegister: 'Middle Egyptian (literary)', lowRegister: 'Late Egyptian vernacular', script: 'Hieroglyphic / hieratic', naming: 'theophoric (Ramesses "Ra bore him")', dress: 'linen kalasiris; thread-count = status', sacred: 'aware' },
      { key: 'ptolemaic', label: 'Ptolemaic / Greco-Roman', span: '305 BC–395 AD', highRegister: 'Koine Greek (court)', lowRegister: 'Demotic Egyptian', script: 'Greek + Demotic', naming: 'Greek + Egyptian blends', sacred: 'aware' },
      { key: 'coptic', label: 'Coptic', span: '1st–7th c. AD', highRegister: 'Liturgical Coptic', lowRegister: 'spoken Coptic', script: 'Coptic', sacred: 'high' },
      { key: 'arab-islamic', label: 'Arab-Islamic', span: '639 AD onward', highRegister: 'Classical/MSA Arabic (فصحى)', lowRegister: 'Egyptian Cairene colloquial', script: 'Arabic', diglossia: true, accentNotes: 'Cairene gīm = hard /g/; distinctive intonation', naming: 'Arab-Muslim + Coptic Christian names', sacred: 'high' },
      { key: 'modern', label: 'Modern Egyptian', span: '1952–present', highRegister: 'MSA (news/print)', lowRegister: 'Egyptian Arabic (pan-Arab media prestige)', script: 'Arabic', diglossia: true, accentNotes: 'Cairene is the most widely understood Arabic dialect', sacred: 'high' },
    ],
  },
  {
    country: 'Iraq', aliases: ['iraq', 'العراق', 'mesopotamia', 'iraqi'],
    eras: [
      { key: 'sumer-akkad', label: 'Sumer / Akkad / Babylon', span: 'c.3000–539 BC', highRegister: 'Akkadian (literary)', lowRegister: 'Sumerian/Akkadian vernacular', script: 'Cuneiform', naming: 'theophoric (Nebuchadnezzar)', sacred: 'aware' },
      { key: 'abbasid', label: 'Abbasid Baghdad', span: '762–1258 AD', highRegister: 'Classical Arabic (golden-age literary)', lowRegister: 'Baghdadi colloquial', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Iraq', span: '1932–present', highRegister: 'MSA', lowRegister: 'Iraqi (Mesopotamian) Arabic; "aku/maku" for there-is/there-isn\'t', script: 'Arabic', diglossia: true, accentNotes: 'qāf often → /g/; distinct from Gulf and Levantine', sacred: 'high' },
    ],
  },
  {
    country: 'Greece', aliases: ['greece', 'ελλάδα', 'greek', 'hellas'],
    eras: [
      { key: 'classical', label: 'Classical', span: '5th–4th c. BC', highRegister: 'Attic Greek (literary)', lowRegister: 'regional dialects (Doric, Ionic)', script: 'Greek', naming: 'patronymic + deme', dress: 'chiton/himation; dye = status', sacred: 'aware' },
      { key: 'koine', label: 'Hellenistic / Koine', span: '323 BC–', highRegister: 'Koine (common Greek)', lowRegister: 'Koine vernacular', script: 'Greek', sacred: 'aware' },
      { key: 'modern', label: 'Modern Greece', span: '1830–present', highRegister: 'Standard Modern Greek (formerly Katharevousa)', lowRegister: 'Demotic Greek', script: 'Greek', diglossia: true, accentNotes: 'the Katharevousa/Demotic split was a real diglossia resolved late 20th c.', sacred: 'aware' },
    ],
  },
  {
    country: 'Britain', aliases: ['britain', 'england', 'uk', 'british', 'english'],
    eras: [
      { key: 'anglo-saxon', label: 'Anglo-Saxon', span: '5th c.–1066', highRegister: 'Old English (literary)', lowRegister: 'regional Old English', naming: 'Æthel-/-wulf compounds', sacred: 'aware' },
      { key: 'norman', label: 'Norman / Medieval', span: '1066–1485', highRegister: 'Anglo-Norman French (court) + Latin (church)', lowRegister: 'Middle English', accentNotes: 'class = language: French above, English below (HARD ANCHOR: 1066)', naming: 'Norman names displace Anglo-Saxon', sacred: 'aware' },
      { key: 'early-modern', label: 'Tudor / Early Modern', span: '1485–1700', highRegister: 'Early Modern English (court/print)', lowRegister: 'regional dialects', accentNotes: 'thee/thou intimacy vs you formality', sacred: 'aware' },
      { key: 'modern', label: 'Modern Britain', span: '1900–present', highRegister: 'Received Pronunciation / Standard English', lowRegister: 'Cockney, Geordie, Scouse, Glaswegian, Brummie…', accentNotes: 'accent still signals class/region sharply', sacred: 'none' },
    ],
  },
  {
    country: 'Mexico', aliases: ['mexico', 'méxico', 'mexican'],
    eras: [
      { key: 'mesoamerican', label: 'Mesoamerican (Aztec/Maya)', span: 'pre-1519', highRegister: 'Classical Nahuatl (tecpillahtolli, "lordly speech")', lowRegister: 'macehuallahtolli (commoner speech)', script: 'Nahuatl glyphs / Maya script', naming: 'calendar + nature names', sacred: 'aware' },
      { key: 'colonial', label: 'New Spain (Colonial)', span: '1521–1821', highRegister: 'Peninsular Spanish (court/church)', lowRegister: 'emerging Mexican Spanish + Nahuatl loanwords', script: 'Latin', accentNotes: 'HARD ANCHOR: conquest 1519–1521', sacred: 'high' },
      { key: 'modern', label: 'Modern Mexico', span: '1821–present', highRegister: 'Standard Mexican Spanish', lowRegister: 'regional (chilango, norteño, yucateco)', accentNotes: 'seseo (no /θ/); "ustedes" only, no "vosotros"; Nahuatl loanwords (cuate, elote)', sacred: 'aware' },
    ],
  },
  {
    country: 'Japan', aliases: ['japan', '日本', 'japanese', 'nippon'],
    eras: [
      { key: 'heian', label: 'Heian', span: '794–1185', highRegister: 'Classical Japanese (court, kanbun)', lowRegister: 'spoken Heian Japanese', script: 'kana + kanji', naming: 'court ranks; -no- nobility', dress: 'jūnihitoe (layered colour = rank)', sacred: 'aware' },
      { key: 'edo', label: 'Edo / Tokugawa', span: '1603–1868', highRegister: 'samurai/bushi formal register', lowRegister: 'Edo townspeople (shitamachi)', accentNotes: 'rigid keigo by class; samurai vs merchant speech', naming: 'family-first; clan markers', sacred: 'aware' },
      { key: 'modern', label: 'Modern Japan', span: '1868–present', highRegister: 'Standard Japanese (hyōjungo) + keigo', lowRegister: 'regional (Kansai-ben, Tōhoku-ben)', accentNotes: 'Kansai-ben reads as warm/comic; keigo encodes hierarchy in every line', sacred: 'none' },
    ],
  },
  // ── Arab League states (the engine records each era's language, names and customs) ──
  {
    country: 'Saudi Arabia', aliases: ['saudi', 'السعودية', 'ksa', 'najd', 'hijaz', 'hejaz', 'arabia', 'mecca', 'medina'],
    eras: [
      { key: 'jahiliyya', label: 'Pre-Islamic Arabia (Jāhiliyya)', ar: 'الجاهلية', span: 'pre-610 AD', highRegister: 'Classical Arabic of the odes (Muʿallaqāt)', lowRegister: 'tribal Bedouin dialects', script: 'early Arabic / Nabataean', naming: 'tribal — "X ibn Y al-[tribe]", Banū lineage', dress: 'thawb, ʿabāya, tribal headcloth', sacred: 'aware' },
      { key: 'early-islamic', label: 'Early Islamic Hijaz', ar: 'الحجاز الإسلامي المبكر', span: '610–750 AD', highRegister: 'Qurʾanic / Classical Arabic (فصحى)', lowRegister: 'Hijazi colloquial', script: 'Arabic', diglossia: true, naming: 'Arab-Muslim (ʿAbd-, Abū-, bint-)', sacred: 'high' },
      { key: 'saudi-states', label: 'Saudi states (Diriyah onward)', ar: 'الدولة السعودية', span: '1744–1932', highRegister: 'Classical Arabic + Najdi religious register', lowRegister: 'Najdi Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Saudi Arabia', ar: 'السعودية الحديثة', span: '1932–present', highRegister: 'MSA (فصحى)', lowRegister: 'Najdi / Hijazi Arabic', script: 'Arabic', diglossia: true, accentNotes: 'Najdi qāf → /g/; Hijazi softer urban register', naming: 'Arab-Muslim; tribal surnames (Al-)', sacred: 'high' },
    ],
  },
  {
    country: 'Yemen', aliases: ['yemen', 'اليمن', 'saba', 'sheba', 'himyar', 'hadhramaut', 'sanaa', 'yemeni'],
    eras: [
      { key: 'sabaean', label: 'Sabaean / Himyarite', ar: 'سبأ وحِمْيَر', span: 'c.800 BC–525 AD', highRegister: 'Old South Arabian (Sabaic, Musnad script)', lowRegister: 'South Arabian vernaculars', script: 'Musnad (Old South Arabian)', naming: 'theophoric (dhū-, ʾīl-); queens of Sabaʾ', dress: 'woven wraps, jambiya from antiquity', sacred: 'aware' },
      { key: 'islamic', label: 'Islamic Yemen (Rasulid / Zaydi)', ar: 'اليمن الإسلامي', span: '630–1918', highRegister: 'Classical Arabic', lowRegister: 'Yemeni Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Yemen', ar: 'اليمن الحديث', span: '1918–present', highRegister: 'MSA', lowRegister: 'Yemeni (Sanʿani / Hadhrami) Arabic', script: 'Arabic', diglossia: true, accentNotes: 'Yemeni keeps archaic features; qāf → /g/ in many areas', sacred: 'high' },
    ],
  },
  {
    country: 'United Arab Emirates', aliases: ['uae', 'emirates', 'الإمارات', 'abu dhabi', 'dubai', 'sharjah', 'trucial', 'magan', 'emirati'],
    eras: [
      { key: 'magan', label: 'Magan (Bronze Age)', ar: 'مَجان', span: 'c.3000–2000 BC', highRegister: '—', lowRegister: 'proto-Semitic trade tongues', naming: 'pre-literate; copper & pearl traders', sacred: 'aware' },
      { key: 'islamic', label: 'Islamic era', ar: 'العصر الإسلامي', span: '630–1820', highRegister: 'Classical Arabic', lowRegister: 'Gulf coastal Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'trucial', label: 'Trucial States (pearling)', ar: 'الإمارات المتصالحة', span: '1820–1971', highRegister: 'Classical Arabic', lowRegister: 'Gulf (Khaleeji) Arabic', script: 'Arabic', diglossia: true, accentNotes: 'pearling-era maritime idiom; British protectorate admin', sacred: 'high' },
      { key: 'modern', label: 'Modern UAE', ar: 'الإمارات الحديثة', span: '1971–present', highRegister: 'MSA', lowRegister: 'Emirati Gulf (Khaleeji) Arabic', script: 'Arabic', diglossia: true, accentNotes: 'qāf → /g/; cosmopolitan English code-switch in cities', naming: 'Arab-Muslim; tribal (Al Nahyan, Al Maktoum)', sacred: 'high' },
    ],
  },
  {
    country: 'Qatar', aliases: ['qatar', 'قطر', 'doha', 'qatari'],
    eras: [
      { key: 'pre-oil', label: 'Pearling / Bedouin Qatar', ar: 'قطر قبل النفط', span: 'pre-1939', highRegister: 'Classical Arabic', lowRegister: 'Gulf (Khaleeji) Arabic', script: 'Arabic', diglossia: true, naming: 'tribal (Al Thani)', sacred: 'high' },
      { key: 'modern', label: 'Modern Qatar', ar: 'قطر الحديثة', span: '1971–present', highRegister: 'MSA', lowRegister: 'Qatari Gulf Arabic', script: 'Arabic', diglossia: true, accentNotes: 'Khaleeji; qāf → /g/', sacred: 'high' },
    ],
  },
  {
    country: 'Kuwait', aliases: ['kuwait', 'الكويت', 'kuwaiti'],
    eras: [
      { key: 'pre-oil', label: 'Pre-oil Kuwait (Bani Utub, pearling/trade)', ar: 'الكويت قبل النفط', span: '1716–1946', highRegister: 'Classical Arabic', lowRegister: 'Kuwaiti Gulf Arabic', script: 'Arabic', diglossia: true, naming: 'tribal/merchant (Al Sabah)', sacred: 'high' },
      { key: 'modern', label: 'Modern Kuwait', ar: 'الكويت الحديثة', span: '1961–present', highRegister: 'MSA', lowRegister: 'Kuwaiti Gulf Arabic', script: 'Arabic', diglossia: true, accentNotes: 'seafaring loanwords; qāf → /g/', sacred: 'high' },
    ],
  },
  {
    country: 'Bahrain', aliases: ['bahrain', 'البحرين', 'dilmun', 'tylos', 'bahraini'],
    eras: [
      { key: 'dilmun', label: 'Dilmun (Bronze Age)', ar: 'دلمون', span: 'c.3000–600 BC', highRegister: 'Mesopotamian contact (Akkadian trade)', lowRegister: 'Dilmunite vernacular', script: 'cuneiform contact', naming: 'land-of-immortality myths; trade hub', sacred: 'aware' },
      { key: 'islamic', label: 'Islamic Bahrain', ar: 'البحرين الإسلامية', span: '630–1820', highRegister: 'Classical Arabic', lowRegister: 'Bahrani / Gulf Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Bahrain', ar: 'البحرين الحديثة', span: '1971–present', highRegister: 'MSA', lowRegister: 'Bahraini Gulf Arabic (Bahrani / ʿArab split)', script: 'Arabic', diglossia: true, sacred: 'high' },
    ],
  },
  {
    country: 'Oman', aliases: ['oman', 'عُمان', 'muscat', 'magan', 'ibadi', 'zanzibar', 'omani'],
    eras: [
      { key: 'magan', label: 'Magan (copper kingdom)', ar: 'مَجان', span: 'c.3000–2000 BC', highRegister: '—', lowRegister: 'proto-Semitic trade tongues', naming: 'pre-literate copper traders', sacred: 'aware' },
      { key: 'ibadi-imamate', label: 'Ibadi Imamate', ar: 'الإمامة الإباضية', span: '751–1959', highRegister: 'Classical Arabic + Ibadi religious register', lowRegister: 'Omani Arabic', script: 'Arabic', diglossia: true, naming: 'Ibadi piety; tribal', sacred: 'high' },
      { key: 'empire', label: 'Omani Empire (Zanzibar)', ar: 'الإمبراطورية العُمانية', span: '1698–1856', highRegister: 'Classical Arabic', lowRegister: 'Omani Arabic + Swahili contact', script: 'Arabic', accentNotes: 'Indian-Ocean maritime; Swahili loanwords', sacred: 'high' },
      { key: 'modern', label: 'Modern Oman', ar: 'عُمان الحديثة', span: '1970–present', highRegister: 'MSA', lowRegister: 'Omani Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
    ],
  },
  {
    country: 'Syria', aliases: ['syria', 'سوريا', 'levant', 'sham', 'damascus', 'aleppo', 'aram', 'umayyad', 'syrian'],
    eras: [
      { key: 'aramean', label: 'Aramean / Classical antiquity', ar: 'الآراميون', span: 'c.1200 BC–630 AD', highRegister: 'Aramaic (lingua franca), later Greek', lowRegister: 'Aramaic vernaculars', script: 'Aramaic / Greek', naming: 'theophoric (Hadad-, Bar-)', sacred: 'aware' },
      { key: 'umayyad', label: 'Umayyad Damascus', ar: 'دمشق الأموية', span: '661–750 AD', highRegister: 'Classical Arabic (caliphal court)', lowRegister: 'early Levantine Arabic', script: 'Arabic', diglossia: true, naming: 'Arab-Muslim; the first Arab dynasty', sacred: 'high' },
      { key: 'ottoman', label: 'Ottoman Syria', ar: 'سوريا العثمانية', span: '1516–1918', highRegister: 'Ottoman Turkish (admin) + Classical Arabic', lowRegister: 'Levantine Arabic', script: 'Arabic / Ottoman', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Syria', ar: 'سوريا الحديثة', span: '1946–present', highRegister: 'MSA', lowRegister: 'Levantine (Damascene / Aleppine) Arabic', script: 'Arabic', diglossia: true, accentNotes: 'qāf → glottal /ʾ/ in cities; soft Levantine cadence', sacred: 'high' },
    ],
  },
  {
    country: 'Lebanon', aliases: ['lebanon', 'لبنان', 'phoenicia', 'beirut', 'tyre', 'sidon', 'byblos', 'lebanese'],
    eras: [
      { key: 'phoenician', label: 'Phoenician city-states', ar: 'الفينيقيون', span: 'c.1500–300 BC', highRegister: 'Phoenician (Canaanite)', lowRegister: 'Phoenician vernacular', script: 'Phoenician alphabet', naming: 'theophoric (Baal-, Eshmun-, -melek)', dress: 'Tyrian-purple dye = rank', sacred: 'aware' },
      { key: 'mount-lebanon', label: 'Mount Lebanon (Maronite / Druze)', ar: 'جبل لبنان', span: '7th c.–1918', highRegister: 'Classical Arabic + Syriac liturgy', lowRegister: 'Lebanese Arabic', script: 'Arabic / Syriac', diglossia: true, sacred: 'high' },
      { key: 'mandate', label: 'French Mandate', ar: 'الانتداب الفرنسي', span: '1920–1943', highRegister: 'French + Classical Arabic (bilingual prestige)', lowRegister: 'Lebanese Arabic', script: 'Arabic / Latin', diglossia: true, accentNotes: 'French code-switch enters the bourgeoisie', sacred: 'aware' },
      { key: 'modern', label: 'Modern Lebanon', ar: 'لبنان الحديث', span: '1943–present', highRegister: 'MSA', lowRegister: 'Lebanese Levantine Arabic (French/English code-switch)', script: 'Arabic', diglossia: true, accentNotes: '"bonjour/merci/hi" tri-lingual mix is signature Beiruti', sacred: 'high' },
    ],
  },
  {
    country: 'Jordan', aliases: ['jordan', 'الأردن', 'nabataean', 'petra', 'transjordan', 'amman', 'jordanian'],
    eras: [
      { key: 'nabataean', label: 'Nabataean (Petra)', ar: 'الأنباط', span: '4th c. BC–106 AD', highRegister: 'Nabataean Aramaic', lowRegister: 'Old Arabic / Aramaic', script: 'Nabataean (ancestor of Arabic script)', naming: 'Aretas, Obodas; caravan dynasts', sacred: 'aware' },
      { key: 'islamic', label: 'Islamic era', ar: 'العصر الإسلامي', span: '630–1918', highRegister: 'Classical Arabic', lowRegister: 'Levantine / Bedouin Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Jordan', ar: 'الأردن الحديث', span: '1946–present', highRegister: 'MSA', lowRegister: 'Jordanian Arabic (urban Levantine + Bedouin)', script: 'Arabic', diglossia: true, accentNotes: 'Bedouin qāf → /g/ vs urban /ʾ/ marks origin', sacred: 'high' },
    ],
  },
  {
    country: 'Palestine', aliases: ['palestine', 'فلسطين', 'canaan', 'jerusalem', 'gaza', 'palestinian', 'holy land'],
    eras: [
      { key: 'canaanite', label: 'Canaanite / Philistine antiquity', ar: 'كنعان', span: 'c.2000–500 BC', highRegister: 'Canaanite / Aramaic', lowRegister: 'Canaanite vernaculars', script: 'Canaanite alphabet', naming: 'theophoric (-el, -baal)', sacred: 'high' },
      { key: 'islamic', label: 'Islamic Jerusalem', ar: 'القدس الإسلامية', span: '637–1917', highRegister: 'Classical Arabic', lowRegister: 'Palestinian Levantine Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'mandate', label: 'Ottoman / British Mandate', ar: 'الانتداب', span: '1517–1948', highRegister: 'Ottoman/English admin + Classical Arabic', lowRegister: 'Palestinian Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Palestine', ar: 'فلسطين الحديثة', span: '1948–present', highRegister: 'MSA', lowRegister: 'Palestinian Levantine Arabic', script: 'Arabic', diglossia: true, accentNotes: 'fellahin /k/→/tʃ/ vs urban; place-bound identity', sacred: 'high' },
    ],
  },
  {
    country: 'Morocco', aliases: ['morocco', 'المغرب', 'maghreb', 'amazigh', 'berber', 'fez', 'marrakesh', 'moroccan', 'idrisid'],
    eras: [
      { key: 'amazigh-antiquity', label: 'Amazigh / Mauretania', ar: 'موريطنية الأمازيغية', span: 'pre-788 AD', highRegister: 'Tamazight; Punic / Latin contact', lowRegister: 'Berber (Tamazight) dialects', script: 'Tifinagh / Latin', naming: 'Amazigh (Massinissa-type), Berber kings', sacred: 'aware' },
      { key: 'idrisid', label: 'Idrisid (Islamization)', ar: 'الأدارسة', span: '788–974', highRegister: 'Classical Arabic', lowRegister: 'Tamazight + early Moroccan Arabic', script: 'Arabic', diglossia: true, naming: 'Sharifian (descent from the Prophet); Fez founded', sacred: 'high' },
      { key: 'almoravid-almohad', label: 'Almoravid / Almohad', ar: 'المرابطون والموحدون', span: '1050s–1269', highRegister: 'Classical Arabic (Maliki)', lowRegister: 'Tamazight + Moroccan Arabic', script: 'Arabic', diglossia: true, accentNotes: 'Berber empires ruling al-Andalus + Maghreb', sacred: 'high' },
      { key: 'modern', label: 'Modern Morocco', ar: 'المغرب الحديث', span: '1956–present', highRegister: 'MSA + Tamazight (official)', lowRegister: 'Darija (Moroccan Arabic), heavy French', script: 'Arabic / Tifinagh / Latin', diglossia: true, accentNotes: 'Darija is hard for other Arabs; French code-switch', sacred: 'high' },
    ],
  },
  {
    country: 'Algeria', aliases: ['algeria', 'الجزائر', 'numidia', 'algiers', 'kabyle', 'algerian'],
    eras: [
      { key: 'numidia', label: 'Numidia / Carthage-Rome', ar: 'نوميديا', span: 'pre-647 AD', highRegister: 'Numidian/Berber; Punic / Latin', lowRegister: 'Berber dialects', script: 'Libyco-Berber / Latin', naming: 'Massinissa, Jugurtha; Berber kings', sacred: 'aware' },
      { key: 'regency', label: 'Ottoman Regency of Algiers', ar: 'الإيالة العثمانية', span: '1516–1830', highRegister: 'Ottoman Turkish + Classical Arabic', lowRegister: 'Algerian Arabic + Tamazight', script: 'Arabic', diglossia: true, accentNotes: 'corsair / privateer port culture', sacred: 'high' },
      { key: 'french', label: 'French Algeria', ar: 'الجزائر الفرنسية', span: '1830–1962', highRegister: 'French (colon/settler) — administrative power', lowRegister: 'Algerian Arabic + Tamazight', script: 'Arabic / Latin', diglossia: true, accentNotes: 'HARD ANCHOR 1830; French vs Arabic is the colonial fault-line', sacred: 'high' },
      { key: 'modern', label: 'Modern Algeria', ar: 'الجزائر الحديثة', span: '1962–present', highRegister: 'MSA + Tamazight (official)', lowRegister: 'Darja (Algerian Arabic), French loanwords', script: 'Arabic / Tifinagh', diglossia: true, sacred: 'high' },
    ],
  },
  {
    country: 'Tunisia', aliases: ['tunisia', 'تونس', 'carthage', 'ifriqiya', 'kairouan', 'punic', 'tunisian'],
    eras: [
      { key: 'carthage', label: 'Carthage (Punic)', ar: 'قرطاج', span: '814–146 BC', highRegister: 'Punic (Phoenician)', lowRegister: 'Punic vernacular + Berber', script: 'Punic alphabet', naming: 'Hannibal, Hamilcar ("grace of Baal")', dress: 'Tyrian purple, maritime', sacred: 'aware' },
      { key: 'aghlabid', label: 'Ifriqiya (Aghlabid / Kairouan)', ar: 'إفريقية', span: '670–1230', highRegister: 'Classical Arabic (Maliki centre)', lowRegister: 'early Tunisian Arabic + Berber', script: 'Arabic', diglossia: true, naming: 'Kairouan as a centre of learning', sacred: 'high' },
      { key: 'husainid', label: 'Ottoman / Husainid Beylik', ar: 'البايات الحسينيون', span: '1574–1881', highRegister: 'Ottoman Turkish + Classical Arabic', lowRegister: 'Tunisian Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Tunisia', ar: 'تونس الحديثة', span: '1956–present', highRegister: 'MSA', lowRegister: 'Tunisian Derja, French loanwords', script: 'Arabic', diglossia: true, accentNotes: 'Derja with strong French/Italian borrowing', sacred: 'high' },
    ],
  },
  {
    country: 'Libya', aliases: ['libya', 'ليبيا', 'tripoli', 'cyrenaica', 'garamantes', 'benghazi', 'libyan'],
    eras: [
      { key: 'ancient', label: 'Garamantes / Greco-Roman', ar: 'الجرمنت', span: 'pre-643 AD', highRegister: 'Berber; Greek (Cyrene) / Latin (Leptis Magna)', lowRegister: 'Berber dialects', script: 'Libyco-Berber / Greek / Latin', naming: 'Saharan caravan kingdoms', sacred: 'aware' },
      { key: 'karamanli', label: 'Ottoman / Karamanli (Tripoli)', ar: 'القرمانليون', span: '1551–1911', highRegister: 'Ottoman Turkish + Classical Arabic', lowRegister: 'Libyan Arabic', script: 'Arabic', diglossia: true, accentNotes: 'Barbary-coast corsair port', sacred: 'high' },
      { key: 'italian', label: 'Italian Libya', ar: 'ليبيا الإيطالية', span: '1911–1943', highRegister: 'Italian (colonial)', lowRegister: 'Libyan Arabic', script: 'Arabic / Latin', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Libya', ar: 'ليبيا الحديثة', span: '1951–present', highRegister: 'MSA', lowRegister: 'Libyan Arabic', script: 'Arabic', diglossia: true, sacred: 'high' },
    ],
  },
  {
    country: 'Mauritania', aliases: ['mauritania', 'موريتانيا', 'sanhaja', 'bidan', 'hassaniya', 'nouakchott', 'mauritanian'],
    eras: [
      { key: 'sanhaja', label: 'Sanhaja Berber / trans-Saharan', ar: 'صنهاجة', span: 'pre-1040', highRegister: 'Berber; Arabic of trade caravans', lowRegister: 'Sanhaja Berber', script: 'Tifinagh / Arabic', naming: 'veiled Sanhaja; Ghana-route traders', sacred: 'aware' },
      { key: 'almoravid-origin', label: 'Almoravid reform', ar: 'أصل المرابطين', span: '1040–1147', highRegister: 'Classical Arabic (religious reform)', lowRegister: 'Berber + early Hassaniya', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Mauritania', ar: 'موريتانيا الحديثة', span: '1960–present', highRegister: 'MSA (official)', lowRegister: 'Hassaniya Arabic; Pulaar / Soninke / Wolof', script: 'Arabic', diglossia: true, accentNotes: 'Hassaniya — Bedouin Arabic with Berber substrate', sacred: 'high' },
    ],
  },
  {
    country: 'Sudan', aliases: ['sudan', 'السودان', 'nubia', 'kush', 'meroe', 'funj', 'khartoum', 'sudanese'],
    eras: [
      { key: 'kush-meroe', label: 'Kush / Meroë (Nubian)', ar: 'كوش ومروي', span: 'c.1069 BC–350 AD', highRegister: 'Meroitic; Egyptian contact', lowRegister: 'Nubian vernaculars', script: 'Meroitic / Egyptian', naming: 'kandakes (queen-mothers); pyramids of Meroë', sacred: 'aware' },
      { key: 'christian-nubia', label: 'Christian Nubia (Makuria)', ar: 'النوبة المسيحية', span: '6th–14th c.', highRegister: 'Old Nubian + Coptic/Greek liturgy', lowRegister: 'Nubian', script: 'Old Nubian / Coptic', sacred: 'high' },
      { key: 'funj', label: 'Funj Sultanate (Sennar)', ar: 'سلطنة الفونج', span: '1504–1821', highRegister: 'Classical Arabic (Islamization)', lowRegister: 'Sudanese Arabic + Nubian', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Sudan', ar: 'السودان الحديث', span: '1956–present', highRegister: 'MSA', lowRegister: 'Sudanese Arabic', script: 'Arabic', diglossia: true, accentNotes: 'Sudanese Arabic; soft, distinct from Egyptian', sacred: 'high' },
    ],
  },
  {
    country: 'Somalia', aliases: ['somalia', 'الصومال', 'somali', 'ajuran', 'adal', 'punt', 'mogadishu'],
    eras: [
      { key: 'punt', label: 'Land of Punt / antiquity', ar: 'بلاد بونت', span: 'antiquity', highRegister: '—', lowRegister: 'early Cushitic / Somali', naming: 'incense & gold trade with Egypt', sacred: 'aware' },
      { key: 'sultanates', label: 'Islamic sultanates (Adal / Ajuran)', ar: 'سلطنات الصومال', span: '9th–17th c.', highRegister: 'Arabic (religion/trade) + Somali', lowRegister: 'Somali', script: 'Arabic', diglossia: true, naming: 'clan lineages; Indian-Ocean trade', sacred: 'high' },
      { key: 'modern', label: 'Modern Somalia', ar: 'الصومال الحديث', span: '1960–present', highRegister: 'Somali (official) + Arabic', lowRegister: 'Somali dialects', script: 'Latin (Somali) / Arabic', accentNotes: 'Somali is the daily tongue; Arabic is religious/official', sacred: 'high' },
    ],
  },
  {
    country: 'Djibouti', aliases: ['djibouti', 'جيبوتي', 'afar', 'issa', 'djiboutian'],
    eras: [
      { key: 'adal', label: 'Adal / Afar-Somali sultanates', ar: 'سلطنات عفر والصومال', span: 'medieval–1888', highRegister: 'Arabic (religion) + Afar / Somali', lowRegister: 'Afar / Somali', script: 'Arabic', diglossia: true, sacred: 'high' },
      { key: 'french', label: 'French Somaliland', ar: 'الصومال الفرنسي', span: '1888–1977', highRegister: 'French (colonial)', lowRegister: 'Afar / Somali / Arabic', script: 'Latin / Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Djibouti', ar: 'جيبوتي الحديثة', span: '1977–present', highRegister: 'French + Arabic (official)', lowRegister: 'Somali / Afar', script: 'Latin / Arabic', sacred: 'high' },
    ],
  },
  {
    country: 'Comoros', aliases: ['comoros', 'جزر القمر', 'comorian', 'shikomori', 'shirazi', 'moroni'],
    eras: [
      { key: 'sultanates', label: 'Shirazi / Swahili sultanates', ar: 'السلطنات الشيرازية', span: '10th–19th c.', highRegister: 'Arabic (religion/trade)', lowRegister: 'Shikomori (Comorian) + Swahili', script: 'Arabic', diglossia: true, naming: 'Indian-Ocean Swahili-Arab trade', sacred: 'high' },
      { key: 'french', label: 'French colonial', ar: 'الاستعمار الفرنسي', span: '1886–1975', highRegister: 'French (colonial) + Arabic', lowRegister: 'Shikomori', script: 'Latin / Arabic', diglossia: true, sacred: 'high' },
      { key: 'modern', label: 'Modern Comoros', ar: 'جزر القمر الحديثة', span: '1975–present', highRegister: 'Arabic + French (official)', lowRegister: 'Shikomori (Comorian)', script: 'Arabic / Latin', sacred: 'high' },
    ],
  },
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();

/** Find the country timeline. The STORY's setting wins over the audience market — checked in priority order. */
export function findCountry(brief: any): CountryTimeline | null {
  const fields = [brief && brief.settingCountry, brief && brief.settingPlace, brief && brief.cultureEra, brief && brief.settingEra, brief && brief.country, brief && brief.market];
  for (const fld of fields) {
    const h = lc(Array.isArray(fld) ? fld.join(' ') : (fld || ''));
    if (!h) continue;
    for (const c of COUNTRY_ERAS) { if (c.aliases.some((a) => h.includes(a))) return c; }
  }
  return null;
}

/** Find the era within a timeline from era/culture hints, else default to the latest (modern). */
export function findEra(c: CountryTimeline, brief: any): Era | null {
  if (!c) return null;
  const hay = lc([brief && brief.settingEra, brief && brief.cultureEra, brief && brief.eraKey].filter(Boolean).join(' '));
  if (hay) { const m = c.eras.find((e) => hay.includes(e.key) || hay.includes(lc(e.label.split(' ')[0]))); if (m) return m; }
  return c.eras[c.eras.length - 1] || null;
}

/** The era steering directive — language register, naming, dress, sacred. */
export function eraDirective(brief: any): string {
  const c = findCountry(brief);
  if (!c) return '';
  const e = findEra(c, brief);
  if (!e) return '';
  const bits: string[] = [];
  bits.push('PERIOD & PLACE: ' + c.country + ' — ' + e.label + ' (' + e.span + ').');
  bits.push('Language register: formal/high = ' + e.highRegister + '; everyday/low = ' + e.lowRegister + (e.diglossia ? ' (write to this diglossia: narration high, dialogue colloquial)' : '') + '.');
  if (e.accentNotes) bits.push('Accent/dialect: ' + e.accentNotes + ' — convey via idiom and a capitalized parenthetical, NEVER phonetic eye-dialect.');
  if (e.naming) bits.push('Naming: ' + e.naming + '.');
  if (e.dress) bits.push('Dress/texture cue: ' + e.dress + '.');
  if (e.sacred === 'high') bits.push('Sacred sensitivity HIGH for this era — apply the sacred-content guardrails.');
  else if (e.sacred === 'aware') bits.push('Sacred sensitivity: treat religious/mythic material of the era with care.');
  return bits.join(' ');
}
