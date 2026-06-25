/**
 * ScriptON intake taxonomy — the UI mirror of backend/src/production/scripton/knowledge/genres.ts.
 * Ids/labels are kept in sync so the Brief UI and the generation steering speak the same vocabulary.
 * Each item carries an Arabic label for the RTL interface. Guideline:
 * docs/knowledge-base/scripon/00-format-engine.md
 */

export interface Tx { id: string; label: string; ar: string }
export interface GenreTx extends Tx { subgenres: string[] }

/** Base genre — pick ONE. The noun the story is. (mirror of knowledge BASE_GENRES) */
export const BASE_GENRES: GenreTx[] = [
  { id: 'action', label: 'Action', ar: 'أكشن', subgenres: ['Spy', 'Heist', 'Martial arts', 'Disaster', 'Survival', 'Military'] },
  { id: 'adventure', label: 'Adventure', ar: 'مغامرة', subgenres: ['Quest', 'Swashbuckler', 'Lost world', 'Treasure hunt'] },
  { id: 'comedy', label: 'Comedy', ar: 'كوميديا', subgenres: ['Rom-com', 'Satire', 'Farce', 'Black comedy', 'Buddy', 'Mockumentary', 'Sitcom'] },
  { id: 'crime', label: 'Crime', ar: 'جريمة', subgenres: ['Heist', 'Mob / organised', 'Procedural', 'Caper', 'Noir', 'Courtroom'] },
  { id: 'drama', label: 'Drama', ar: 'دراما', subgenres: ['Family', 'Social-realist', 'Coming-of-age', 'Melodrama', 'Legal', 'Medical', 'Political'] },
  { id: 'fantasy', label: 'Fantasy', ar: 'فانتازيا', subgenres: ['High / epic', 'Urban', 'Fairy-tale', 'Sword & sorcery', 'Mythic', 'Portal'] },
  { id: 'historical', label: 'Historical', ar: 'تاريخي', subgenres: ['Epic / period', 'Biopic', 'War', 'Costume', 'Alt-history'] },
  { id: 'horror', label: 'Horror', ar: 'رعب', subgenres: ['Supernatural', 'Slasher', 'Psychological', 'Folk', 'Body', 'Found-footage'] },
  { id: 'musical', label: 'Musical', ar: 'موسيقي', subgenres: ['Book musical', 'Jukebox', 'Backstage', 'Dance'] },
  { id: 'mystery', label: 'Mystery', ar: 'غموض', subgenres: ['Whodunit', 'Cozy', 'Hardboiled', 'Conspiracy', 'Cold-case'] },
  { id: 'romance', label: 'Romance', ar: 'رومانسي', subgenres: ['Rom-com', 'Period romance', 'Forbidden', 'Second-chance', 'Tragic'] },
  { id: 'scifi', label: 'Sci-Fi', ar: 'خيال علمي', subgenres: ['Space opera', 'Cyberpunk', 'Dystopian', 'Time travel', 'First contact', 'Hard SF'] },
  { id: 'thriller', label: 'Thriller', ar: 'إثارة', subgenres: ['Psychological', 'Techno', 'Political', 'Legal', 'Espionage', 'Domestic'] },
  { id: 'war', label: 'War', ar: 'حرب', subgenres: ['Combat', 'Home-front', 'Resistance', 'POW', 'Anti-war'] },
  { id: 'western', label: 'Western', ar: 'غربي', subgenres: ['Classic', 'Revisionist', 'Spaghetti', 'Acid', 'Neo-western'] },
];

export const BLEND_LAYERS: Tx[] = [
  { id: 'war', label: 'War', ar: 'حرب' }, { id: 'romance', label: 'Romance', ar: 'رومانسي' },
  { id: 'fantasy', label: 'Fantasy', ar: 'فانتازيا' }, { id: 'noir', label: 'Noir', ar: 'نوار' },
  { id: 'satire', label: 'Satire', ar: 'سخرية' }, { id: 'mystery', label: 'Mystery', ar: 'غموض' },
  { id: 'coming-of-age', label: 'Coming-of-age', ar: 'بلوغ' }, { id: 'political', label: 'Political', ar: 'سياسي' },
  { id: 'supernatural', label: 'Supernatural', ar: 'خارق' }, { id: 'survival', label: 'Survival', ar: 'نجاة' },
];

export const TONES: Tx[] = [
  { id: 'epic', label: 'Epic', ar: 'ملحمي' }, { id: 'grounded', label: 'Grounded', ar: 'واقعي' },
  { id: 'tragic', label: 'Tragic', ar: 'مأساوي' }, { id: 'ironic', label: 'Ironic', ar: 'ساخر' },
  { id: 'comic', label: 'Comic', ar: 'كوميدي' }, { id: 'romantic', label: 'Romantic', ar: 'رومانسي' },
  { id: 'satirical', label: 'Satirical', ar: 'تهكمي' }, { id: 'pulpy', label: 'Pulpy', ar: 'مثير' },
  { id: 'lyrical', label: 'Lyrical', ar: 'شاعري' },
];

export const MOODS: Tx[] = [
  { id: 'foreboding', label: 'Foreboding', ar: 'منذر' }, { id: 'bittersweet', label: 'Bittersweet', ar: 'حلو مرّ' },
  { id: 'hopeful', label: 'Hopeful', ar: 'مفعم بالأمل' }, { id: 'tense', label: 'Tense', ar: 'متوتر' },
  { id: 'melancholic', label: 'Melancholic', ar: 'كئيب' }, { id: 'whimsical', label: 'Whimsical', ar: 'غريب الأطوار' },
  { id: 'dread', label: 'Dread', ar: 'رهبة' }, { id: 'warm', label: 'Warm', ar: 'دافئ' },
];

export const TREATMENTS: Tx[] = [
  { id: 'linear', label: 'Linear', ar: 'خطي' }, { id: 'nonlinear', label: 'Non-linear', ar: 'غير خطي' },
  { id: 'multi-pov', label: 'Multi-POV', ar: 'وجهات نظر متعددة' }, { id: 'frame', label: 'Frame / story-within', ar: 'إطار قصصي' },
  { id: 'anthology', label: 'Anthology', ar: 'مجموعة قصص' }, { id: 'real-time', label: 'Real-time', ar: 'زمن حقيقي' },
  { id: 'epistolary', label: 'Epistolary / found', ar: 'وثائقي/مكتوب' }, { id: 'unreliable', label: 'Unreliable narrator', ar: 'راوٍ غير موثوق' },
];

/** Broad era bands for the story's SETTING (distinct from the audience market). */
export const SETTING_ERAS: Tx[] = [
  { id: 'ancient', label: 'Ancient (pre-500 AD)', ar: 'العصور القديمة' },
  { id: 'medieval', label: 'Medieval (500–1500)', ar: 'العصور الوسطى' },
  { id: 'early-modern', label: 'Early modern (1500–1800)', ar: 'بداية العصر الحديث' },
  { id: '19c', label: '19th century', ar: 'القرن التاسع عشر' },
  { id: 'early-20c', label: 'Early 20th century', ar: 'بداية القرن العشرين' },
  { id: 'mid-20c', label: 'Mid-century (1940s–70s)', ar: 'منتصف القرن' },
  { id: 'contemporary', label: 'Contemporary', ar: 'معاصر' },
  { id: 'near-future', label: 'Near future', ar: 'مستقبل قريب' },
  { id: 'far-future', label: 'Far future', ar: 'مستقبل بعيد' },
];

/** Story-setting countries. The first six have deep era timelines in the knowledge engine. */
export const SETTING_COUNTRIES = [
  'Egypt', 'Saudi Arabia', 'UAE', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Yemen',
  'Iraq', 'Syria', 'Lebanon', 'Jordan', 'Palestine',
  'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Mauritania', 'Sudan', 'Somalia', 'Djibouti', 'Comoros',
  'Greece', 'Britain', 'Mexico', 'Japan', 'Turkey', 'Iran / Persia',
  'United States', 'France', 'Italy', 'Spain', 'Germany', 'Russia',
  'India', 'China', 'Korea', 'Nigeria', 'Brazil',
  'Mesopotamia (ancient)', 'Andalusia (historical)', 'Other / fictional',
];

export const PROJECT_INTENTS: Tx[] = [
  { id: 'festival', label: 'Festival / arthouse', ar: 'مهرجانات / فني' },
  { id: 'theatrical', label: 'Commercial theatrical', ar: 'تجاري / دور العرض' },
  { id: 'streaming', label: 'Streaming / platform', ar: 'منصات البث' },
  { id: 'broadcast', label: 'Broadcast / TV', ar: 'تلفزيون' },
  { id: 'branded', label: 'Branded / commercial', ar: 'إعلاني / تجاري' },
  { id: 'passion', label: 'Personal / passion', ar: 'مشروع شخصي' },
];

export const BUDGET_TIERS: { id: string; label: string; ar: string; hint: string; arHint: string }[] = [
  { id: 'micro', label: 'Micro (<$1M)', ar: 'محدود جدًا', hint: '≤4 locations, tiny cast', arHint: '≤4 مواقع، فريق تمثيل صغير' },
  { id: 'low', label: 'Low ($1–5M)', ar: 'منخفض', hint: '≤8 locations, modest cast', arHint: '≤8 مواقع، فريق متواضع' },
  { id: 'mid', label: 'Mid ($5–20M)', ar: 'متوسط', hint: '≤12 locations, some scale', arHint: '≤12 موقعًا، بعض الضخامة' },
  { id: 'high', label: 'High ($20–60M)', ar: 'مرتفع', hint: 'set-pieces, VFX, large cast', arHint: 'مَشاهد كبرى، مؤثرات بصرية، فريق ضخم' },
  { id: 'tentpole', label: 'Tentpole ($60M+)', ar: 'ضخم', hint: 'epic scale, heavy VFX', arHint: 'ضخامة ملحمية، مؤثرات كثيفة' },
];

/** Accents (beyond Arabic — Arabic uses the dedicated dialect engine). Mirror of knowledge accents.ts. */
export const ACCENTS: { id: string; label: string; ar: string; language: string }[] = [
  { id: 'rp', label: 'Received Pronunciation', ar: 'إنجليزية معيارية', language: 'English' },
  { id: 'cockney', label: 'Cockney', ar: 'كوكني', language: 'English' },
  { id: 'glaswegian', label: 'Glaswegian', ar: 'غلاسكوية', language: 'English' },
  { id: 'hiberno', label: 'Hiberno-Irish', ar: 'أيرلندية', language: 'English' },
  { id: 'us-southern', label: 'US Southern', ar: 'جنوب أمريكي', language: 'English' },
  { id: 'aave', label: 'AAVE', ar: 'إنجليزية أفروأمريكية', language: 'English' },
  { id: 'castilian', label: 'Castilian Spanish', ar: 'إسبانية قشتالية', language: 'Spanish' },
  { id: 'rioplatense', label: 'Rioplatense Spanish', ar: 'إسبانية ريوبلاتية', language: 'Spanish' },
  { id: 'mexican', label: 'Mexican Spanish', ar: 'إسبانية مكسيكية', language: 'Spanish' },
  { id: 'kansai', label: 'Kansai-ben', ar: 'لهجة كانساي', language: 'Japanese' },
];

/** Per-country civilisation timelines (the six with deep knowledge-engine support). Labels match knowledge eras.ts. */
export const COUNTRY_ERA_TIMELINES: Record<string, { label: string; ar: string }[]> = {
  Egypt: [
    { label: 'Pharaonic', ar: 'فرعوني' }, { label: 'Ptolemaic / Greco-Roman', ar: 'بطلمي/يوناني-روماني' },
    { label: 'Coptic', ar: 'قبطي' }, { label: 'Arab-Islamic', ar: 'عربي-إسلامي' },
    { label: 'Ottoman', ar: 'عثماني' }, { label: 'Modern Egyptian', ar: 'مصري حديث' },
  ],
  Iraq: [
    { label: 'Sumer / Akkad / Babylon', ar: 'سومر/أكد/بابل' }, { label: 'Abbasid Baghdad', ar: 'بغداد العباسية' },
    { label: 'Modern Iraq', ar: 'العراق الحديث' },
  ],
  Greece: [
    { label: 'Classical', ar: 'كلاسيكي' }, { label: 'Hellenistic / Koine', ar: 'هلنستي' }, { label: 'Modern Greece', ar: 'اليونان الحديثة' },
  ],
  Britain: [
    { label: 'Anglo-Saxon', ar: 'أنجلوسكسوني' }, { label: 'Norman / Medieval', ar: 'نورماندي/وسيط' },
    { label: 'Tudor / Early Modern', ar: 'تيودور/بداية الحداثة' }, { label: 'Modern Britain', ar: 'بريطانيا الحديثة' },
  ],
  Mexico: [
    { label: 'Mesoamerican (Aztec/Maya)', ar: 'حضارات أمريكا الوسطى' }, { label: 'New Spain (Colonial)', ar: 'إسبانيا الجديدة (استعماري)' },
    { label: 'Modern Mexico', ar: 'المكسيك الحديثة' },
  ],
  Japan: [
    { label: 'Heian', ar: 'هييآن' }, { label: 'Edo / Tokugawa', ar: 'إيدو/توكوغاوا' }, { label: 'Modern Japan', ar: 'اليابان الحديثة' },
  ],
  'Saudi Arabia': [
    { label: 'Pre-Islamic Arabia (Jāhiliyya)', ar: 'الجاهلية' }, { label: 'Early Islamic Hijaz', ar: 'الحجاز الإسلامي المبكر' },
    { label: 'Saudi states (Diriyah onward)', ar: 'الدولة السعودية' }, { label: 'Modern Saudi Arabia', ar: 'السعودية الحديثة' },
  ],
  Yemen: [
    { label: 'Sabaean / Himyarite', ar: 'سبأ وحِمْيَر' }, { label: 'Islamic Yemen (Rasulid / Zaydi)', ar: 'اليمن الإسلامي' }, { label: 'Modern Yemen', ar: 'اليمن الحديث' },
  ],
  UAE: [
    { label: 'Magan (Bronze Age)', ar: 'مَجان' }, { label: 'Islamic era', ar: 'العصر الإسلامي' },
    { label: 'Trucial States (pearling)', ar: 'الإمارات المتصالحة' }, { label: 'Modern UAE', ar: 'الإمارات الحديثة' },
  ],
  Qatar: [
    { label: 'Pearling / Bedouin Qatar', ar: 'قطر قبل النفط' }, { label: 'Modern Qatar', ar: 'قطر الحديثة' },
  ],
  Kuwait: [
    { label: 'Pre-oil Kuwait (Bani Utub, pearling/trade)', ar: 'الكويت قبل النفط' }, { label: 'Modern Kuwait', ar: 'الكويت الحديثة' },
  ],
  Bahrain: [
    { label: 'Dilmun (Bronze Age)', ar: 'دلمون' }, { label: 'Islamic Bahrain', ar: 'البحرين الإسلامية' }, { label: 'Modern Bahrain', ar: 'البحرين الحديثة' },
  ],
  Oman: [
    { label: 'Magan (copper kingdom)', ar: 'مَجان' }, { label: 'Ibadi Imamate', ar: 'الإمامة الإباضية' },
    { label: 'Omani Empire (Zanzibar)', ar: 'الإمبراطورية العُمانية' }, { label: 'Modern Oman', ar: 'عُمان الحديثة' },
  ],
  Syria: [
    { label: 'Aramean / Classical antiquity', ar: 'الآراميون' }, { label: 'Umayyad Damascus', ar: 'دمشق الأموية' },
    { label: 'Ottoman Syria', ar: 'سوريا العثمانية' }, { label: 'Modern Syria', ar: 'سوريا الحديثة' },
  ],
  Lebanon: [
    { label: 'Phoenician city-states', ar: 'الفينيقيون' }, { label: 'Mount Lebanon (Maronite / Druze)', ar: 'جبل لبنان' },
    { label: 'French Mandate', ar: 'الانتداب الفرنسي' }, { label: 'Modern Lebanon', ar: 'لبنان الحديث' },
  ],
  Jordan: [
    { label: 'Nabataean (Petra)', ar: 'الأنباط' }, { label: 'Islamic era', ar: 'العصر الإسلامي' }, { label: 'Modern Jordan', ar: 'الأردن الحديث' },
  ],
  Palestine: [
    { label: 'Canaanite / Philistine antiquity', ar: 'كنعان' }, { label: 'Islamic Jerusalem', ar: 'القدس الإسلامية' },
    { label: 'Ottoman / British Mandate', ar: 'الانتداب' }, { label: 'Modern Palestine', ar: 'فلسطين الحديثة' },
  ],
  Morocco: [
    { label: 'Amazigh / Mauretania', ar: 'موريطنية الأمازيغية' }, { label: 'Idrisid (Islamization)', ar: 'الأدارسة' },
    { label: 'Almoravid / Almohad', ar: 'المرابطون والموحدون' }, { label: 'Modern Morocco', ar: 'المغرب الحديث' },
  ],
  Algeria: [
    { label: 'Numidia / Carthage-Rome', ar: 'نوميديا' }, { label: 'Ottoman Regency of Algiers', ar: 'الإيالة العثمانية' },
    { label: 'French Algeria', ar: 'الجزائر الفرنسية' }, { label: 'Modern Algeria', ar: 'الجزائر الحديثة' },
  ],
  Tunisia: [
    { label: 'Carthage (Punic)', ar: 'قرطاج' }, { label: 'Ifriqiya (Aghlabid / Kairouan)', ar: 'إفريقية' },
    { label: 'Ottoman / Husainid Beylik', ar: 'البايات الحسينيون' }, { label: 'Modern Tunisia', ar: 'تونس الحديثة' },
  ],
  Libya: [
    { label: 'Garamantes / Greco-Roman', ar: 'الجرمنت' }, { label: 'Ottoman / Karamanli (Tripoli)', ar: 'القرمانليون' },
    { label: 'Italian Libya', ar: 'ليبيا الإيطالية' }, { label: 'Modern Libya', ar: 'ليبيا الحديثة' },
  ],
  Mauritania: [
    { label: 'Sanhaja Berber / trans-Saharan', ar: 'صنهاجة' }, { label: 'Almoravid reform', ar: 'أصل المرابطين' }, { label: 'Modern Mauritania', ar: 'موريتانيا الحديثة' },
  ],
  Sudan: [
    { label: 'Kush / Meroë (Nubian)', ar: 'كوش ومروي' }, { label: 'Christian Nubia (Makuria)', ar: 'النوبة المسيحية' },
    { label: 'Funj Sultanate (Sennar)', ar: 'سلطنة الفونج' }, { label: 'Modern Sudan', ar: 'السودان الحديث' },
  ],
  Somalia: [
    { label: 'Land of Punt / antiquity', ar: 'بلاد بونت' }, { label: 'Islamic sultanates (Adal / Ajuran)', ar: 'سلطنات الصومال' }, { label: 'Modern Somalia', ar: 'الصومال الحديث' },
  ],
  Djibouti: [
    { label: 'Adal / Afar-Somali sultanates', ar: 'سلطنات عفر والصومال' }, { label: 'French Somaliland', ar: 'الصومال الفرنسي' }, { label: 'Modern Djibouti', ar: 'جيبوتي الحديثة' },
  ],
  Comoros: [
    { label: 'Shirazi / Swahili sultanates', ar: 'السلطنات الشيرازية' }, { label: 'French colonial', ar: 'الاستعمار الفرنسي' }, { label: 'Modern Comoros', ar: 'جزر القمر الحديثة' },
  ],
};
/** Era options for a setting country — the deep timeline when we have it, else the broad bands. */
export const eraOptionsFor = (country: string): { label: string; ar: string }[] => COUNTRY_ERA_TIMELINES[country] || SETTING_ERAS.map((e) => ({ label: e.label, ar: e.ar }));

/** Pick label by locale; falls back to English. */
export const tx = (item: { label: string; ar?: string }, locale?: string): string => (locale === 'ar' && item.ar ? item.ar : item.label);
/** Resolve subgenres for a chosen base-genre label. */
export const subgenresForLabel = (baseLabel: string): string[] => {
  const g = BASE_GENRES.find((x) => x.label === baseLabel || x.id === baseLabel);
  return g ? g.subgenres : [];
};

/** Arabic names for the SETTING_COUNTRIES (country names aren't stored with an ar field). */
export const COUNTRY_AR: Record<string, string> = {
  'Egypt': 'مصر', 'Saudi Arabia': 'السعودية', 'UAE': 'الإمارات', 'Qatar': 'قطر', 'Kuwait': 'الكويت',
  'Bahrain': 'البحرين', 'Oman': 'عُمان', 'Yemen': 'اليمن', 'Iraq': 'العراق', 'Syria': 'سوريا',
  'Lebanon': 'لبنان', 'Jordan': 'الأردن', 'Palestine': 'فلسطين', 'Morocco': 'المغرب', 'Algeria': 'الجزائر',
  'Tunisia': 'تونس', 'Libya': 'ليبيا', 'Mauritania': 'موريتانيا', 'Sudan': 'السودان', 'Somalia': 'الصومال',
  'Djibouti': 'جيبوتي', 'Comoros': 'جزر القمر', 'Greece': 'اليونان', 'Britain': 'بريطانيا', 'Mexico': 'المكسيك',
  'Japan': 'اليابان', 'Turkey': 'تركيا', 'Iran / Persia': 'إيران / فارس', 'United States': 'الولايات المتحدة',
  'France': 'فرنسا', 'Italy': 'إيطاليا', 'Spain': 'إسبانيا', 'Germany': 'ألمانيا', 'Russia': 'روسيا',
  'India': 'الهند', 'China': 'الصين', 'Korea': 'كوريا', 'Nigeria': 'نيجيريا', 'Brazil': 'البرازيل',
  'Mesopotamia (ancient)': 'بلاد الرافدين (قديمًا)', 'Andalusia (historical)': 'الأندلس (تاريخيًا)', 'Other / fictional': 'أخرى / خيالية',
};

/** Reverse English-label → Arabic index across every taxonomy list (so the live brief can localise stored labels). */
const AR_INDEX: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  const add = (list: { label: string; ar?: string }[]) => list.forEach((x) => { if (x && x.ar) m[x.label] = x.ar; });
  add(BASE_GENRES); add(BLEND_LAYERS); add(TONES); add(MOODS); add(TREATMENTS); add(ACCENTS); add(BUDGET_TIERS); add(PROJECT_INTENTS); add(SETTING_ERAS);
  Object.values(COUNTRY_ERA_TIMELINES).forEach((arr) => add(arr));
  Object.keys(COUNTRY_AR).forEach((k) => { m[k] = COUNTRY_AR[k]; });
  return m;
})();

/** Localise a stored English label to Arabic when locale === 'ar'; falls back to the label as-is. */
export const arLabel = (label: string, locale?: string): string => (locale === 'ar' && label && AR_INDEX[label]) ? AR_INDEX[label] : label;

/** Style & Voice packs — the "HOW it's written" axis (mirror of knowledge styles.ts). Technique-only, generic names. */
export const STYLE_PACKS: { id: string; label: string; ar: string; blurb: string; arBlurb: string; bestFor: string[] }[] = [
  { id: 'fast-ensemble', label: 'Fast Ensemble Dialogue', ar: 'حوار جماعي سريع', blurb: 'Overlapping, rapid-fire, walk-and-talks.', arBlurb: 'حوار متداخل سريع، مشيٌ وحديث.', bestFor: ['any'] },
  { id: 'slow-burn', label: 'Slow-Burn Naturalism', ar: 'واقعية بطيئة الإيقاع', blurb: 'Long quiet scenes, silence and subtext.', arBlurb: 'مشاهد طويلة هادئة، صمتٌ ومعنى ضمني.', bestFor: ['any'] },
  { id: 'mythic-quest', label: 'Mythic Quest', ar: 'ملحمة أسطورية', blurb: 'Elevated, archetypal, big emotional swings.', arBlurb: 'لغة رفيعة، نماذج أصيلة، مشاعر كبيرة.', bestFor: ['any'] },
  { id: 'hyperlink-mosaic', label: 'Hyperlink Mosaic', ar: 'فسيفساء متشابكة', blurb: 'Interwoven strands, thematic resonance, non-linear.', arBlurb: 'خيوط متشابكة، رنين موضوعي، غير خطي.', bestFor: ['any'] },
  { id: 'noir-voice', label: 'Hardboiled Noir Voice', ar: 'صوت النوار القاسي', blurb: 'Terse, fatalistic, shadow-and-rain.', arBlurb: 'مقتضب، قدري، ظلالٌ ومطر.', bestFor: ['any'] },
  { id: 'genre-pastiche', label: 'Genre-Pastiche Nonlinear', ar: 'مزيج أنواع غير خطي', blurb: 'Chaptered, tonal whiplash, stylized.', arBlurb: 'فصول، تقلّب نبرة، أسلوبية.', bestFor: ['any'] },
  { id: 'maximalist-spectacle', label: 'Maximalist Spectacle', ar: 'مشهدية فخمة', blurb: 'Escalating set-pieces, loud scale.', arBlurb: 'مَشاهد متصاعدة، ضخامة صاخبة.', bestFor: ['any'] },
  { id: 'deadpan-absurd', label: 'Deadpan Absurd', ar: 'عبث بوجهٍ جامد', blurb: 'Flat affect, symmetrical, dry comedy.', arBlurb: 'انفعال محايد، تناظر، كوميديا جافة.', bestFor: ['any'] },
  { id: 'verite-handheld', label: 'Vérité Handheld', ar: 'واقعية محمولة', blurb: 'Documentary feel, improvisational.', arBlurb: 'إحساس وثائقي، ارتجالي.', bestFor: ['any'] },
  { id: 'lyrical-memory', label: 'Lyrical Memory', ar: 'ذاكرة شاعرية', blurb: 'Poetic, time-fluid, elegiac.', arBlurb: 'شاعري، زمنٌ سائل، رثائي.', bestFor: ['any'] },
  { id: 'chamber-intimate', label: 'Chamber Intimacy', ar: 'حميمية الغرفة المغلقة', blurb: 'Few characters, one space, pressure-cooker.', arBlurb: 'شخصيات قليلة، مكان واحد، ضغطٌ محتدم.', bestFor: ['any'] },
  { id: 'bingeable-cliff', label: 'Bingeable Cliff-Engine', ar: 'محرّك تشويق متسلسل', blurb: 'Chapter-end hooks, propulsive (episodic).', arBlurb: 'خطافات نهاية الحلقة، دافعة (للمسلسلات).', bestFor: ['SERIES', 'VERTICAL'] },
  { id: 'punchy-spot', label: 'Punchy Single-Idea Spot', ar: 'إعلان بفكرة واحدة', blurb: 'One idea, set-up to logo (commercials).', arBlurb: 'فكرة واحدة، من التأسيس للشعار (إعلانات).', bestFor: ['TVC'] },
  { id: 'investigative-build', label: 'Investigative Build', ar: 'بناء استقصائي', blurb: 'Evidence-led reveals (documentary).', arBlurb: 'كشوفٌ يقودها الدليل (وثائقي).', bestFor: ['DOCUMENTARY'] },
];
export const STYLE_STRENGTH = ['Whisper', 'Light', 'Balanced', 'Strong', 'Defining'];
