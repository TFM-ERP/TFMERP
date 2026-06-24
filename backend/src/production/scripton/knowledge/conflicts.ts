/**
 * ScripON knowledge · CONFLICT & COLONIZATION SUBSTRATE
 * -----------------------------------------------------
 * War / colonial / resistance / political history per country, era-linked to eras.ts.
 * Drives authentic war, resistance, occupation and political stories: the sides, what was at
 * stake, the iconic theatres a film would use, and the protagonist ROLES a writer draws on
 * (archetypes — never named real individuals) + a per-conflict sensitivity guardrail.
 *
 * Guideline + sources: docs/knowledge-base/scripon/07-conflict-colonization.md
 *
 * ACTIVATION: only for war/conflict/political stories (see isConflictStory) — a rom-com set in
 * Beirut will NOT get war steering. Sensitivity: 'high' = ongoing and/or sectarian → strict
 * non-partisanship, give every side human motive, preserve civilian dignity, never glorify
 * violence, avoid sectarian/ethnic stereotyping. Extend with new rows; never branch the engine.
 */

export type ConflictType = 'colonization' | 'independence' | 'interstate' | 'civil' | 'insurgency' | 'revolution';
export type ConflictSensitivity = 'standard' | 'contested' | 'high';

export interface Conflict {
  id: string;
  label: string;
  ar?: string;
  eraKey?: string;        // soft link to the country's Era.key in eras.ts (prefers era-matching conflicts)
  span: string;
  type: ConflictType;
  sides: string;
  stakes: string;
  theatres: string[];
  heroArchetypes: string[];
  sensitivity: ConflictSensitivity;
}

export interface CountryConflicts { country: string; aliases: string[]; conflicts: Conflict[]; }

export const CONFLICTS: CountryConflicts[] = [
  // ── Nile Valley ──
  {
    country: 'Egypt', aliases: ['egypt', 'مصر', 'egyptian', 'cairo'],
    conflicts: [
      { id: 'urabi', label: 'Urabi Revolt & British occupation', ar: 'الثورة العرابية', eraKey: 'arab-islamic', span: '1881–82', type: 'colonization', sides: 'Urabi’s officers vs Britain (and the Khedive)', stakes: '"Egypt for the Egyptians" vs European financial control', theatres: ['Alexandria bombardment', 'Tel el-Kebir', 'Cairo'], heroArchetypes: ['nationalist colonel', 'fellah conscript', 'palace courtier caught between sides'], sensitivity: 'standard' },
      { id: '1919-revolution', label: '1919 Revolution', ar: 'ثورة 1919', eraKey: 'modern', span: '1919–22', type: 'independence', sides: 'Wafd-led nationalists vs British protectorate', stakes: 'end of British control', theatres: ['Cairo streets & Abdeen Palace', 'Nile Delta villages', 'railway stations'], heroArchetypes: ['lawyer-orator turned exile', 'student striker', 'woman demonstrator'], sensitivity: 'standard' },
      { id: '1952-revolution', label: 'Free Officers (1952)', ar: 'ثورة يوليو 1952', eraKey: 'modern', span: '1952', type: 'revolution', sides: 'Free Officers vs the monarchy', stakes: 'end of the monarchy & lingering British presence', theatres: ['officers’ barracks', 'Cairo', 'royal palace'], heroArchetypes: ['young colonel-conspirator', 'deposed courtier', 'idealist swept up in change'], sensitivity: 'standard' },
      { id: 'suez-1956', label: '1956 Suez Crisis', ar: 'أزمة السويس', eraKey: 'modern', span: '1956', type: 'interstate', sides: 'Egypt vs Britain, France & Israel', stakes: 'nationalization of the Suez Canal', theatres: ['Port Said', 'Suez Canal zone', 'Sinai', 'Gaza'], heroArchetypes: ['paratrooper', 'canal-zone civilian', 'junior officer', 'war correspondent'], sensitivity: 'contested' },
      { id: 'oct-1973', label: '1973 October War', ar: 'حرب أكتوبر 1973', eraKey: 'modern', span: '1973', type: 'interstate', sides: 'Egypt & Syria vs Israel', stakes: 'recovery of territory lost in 1967; national pride', theatres: ['Suez Canal crossing', 'Sinai tank battles', 'the Bar-Lev line'], heroArchetypes: ['assault/bridging engineer', 'tank commander', 'pilot', 'POW', 'frontline nurse'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Sudan', aliases: ['sudan', 'السودان', 'sudanese', 'khartoum', 'darfur', 'nubia'],
    conflicts: [
      { id: 'mahdist', label: 'Mahdist War', ar: 'الثورة المهدية', eraKey: 'funj', span: '1881–98', type: 'independence', sides: 'the Mahdi’s Ansar vs Anglo-Egyptian forces', stakes: 'a messianic Islamic state vs Turco-Egyptian/British rule', theatres: ['siege of Khartoum', 'Omdurman', 'the Nile & desert'], heroArchetypes: ['messianic preacher', 'dervish warrior', 'besieged garrison officer'], sensitivity: 'contested' },
      { id: 'south-civil-wars', label: 'North–South civil wars', ar: 'الحرب الأهلية', eraKey: 'modern', span: '1955–72; 1983–2005', type: 'civil', sides: 'Khartoum government vs southern SPLA/SPLM', stakes: 'autonomy, religion, oil — ended in South Sudan’s 2011 secession', theatres: ['southern bush & swamps', 'Nile garrison towns', 'refugee trails to Ethiopia'], heroArchetypes: ['child soldier ("Lost Boy")', 'rebel commander', 'displaced family', 'aid doctor'], sensitivity: 'high' },
      { id: 'darfur', label: 'Darfur war', ar: 'حرب دارفور', eraKey: 'modern', span: '2003–', type: 'civil', sides: 'government + Janjaweed militias vs SLA/JEM rebels', stakes: 'land, ethnicity (Arab/African framing), survival', theatres: ['Darfur villages', 'IDP camps', 'the road to Chad'], heroArchetypes: ['displaced mother', 'militiaman', 'aid worker', 'pastoralist between army and rebels'], sensitivity: 'high' },
    ],
  },
  // ── Levant ──
  {
    country: 'Syria', aliases: ['syria', 'سوريا', 'syrian', 'damascus', 'aleppo', 'levant', 'sham'],
    conflicts: [
      { id: 'great-revolt', label: 'Great Syrian Revolt', ar: 'الثورة السورية الكبرى', eraKey: 'modern', span: '1925–27', type: 'independence', sides: 'Druze & nationalist rebels (Sultan al-Atrash) vs French Mandate', stakes: 'end of French rule', theatres: ['Jabal al-Druze', 'Damascus old city (shelled)', 'orchards of the Ghouta'], heroArchetypes: ['warrior-leader', 'urban nationalist', 'colonial artillery officer'], sensitivity: 'contested' },
      { id: 'oct-1973', label: '1973 October War (Golan)', ar: 'حرب أكتوبر — الجولان', eraKey: 'modern', span: '1973', type: 'interstate', sides: 'Syria & Egypt vs Israel', stakes: 'recovery of the Golan Heights', theatres: ['the Golan plateau', 'the road toward Damascus', 'tank valleys'], heroArchetypes: ['tank crewman', 'conscript', 'pilot', 'field medic'], sensitivity: 'high' },
      { id: 'civil-war', label: 'Syrian Civil War', ar: 'الحرب الأهلية السورية', eraKey: 'modern', span: '2011–', type: 'civil', sides: 'regime + allies vs opposition/defectors, Kurdish SDF, Islamist factions', stakes: 'the state itself; 13M+ displaced', theatres: ['besieged Aleppo & Homs', 'Ghouta', 'refugee routes to Turkey/Lebanon/Jordan & the sea', 'prisons'], heroArchetypes: ['defector', 'rescue volunteer', 'underground doctor', 'refugee family', 'mother of the disappeared', 'child of the camps'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Lebanon', aliases: ['lebanon', 'لبنان', 'lebanese', 'beirut'],
    conflicts: [
      { id: 'independence-1943', label: 'Independence (1943)', ar: 'الاستقلال 1943', eraKey: 'mandate', span: '1943', type: 'independence', sides: 'cross-confessional nationalists vs French Mandate', stakes: 'sovereignty; the confessional National Pact', theatres: ['Beirut', 'Rashaya citadel (jailed leaders)'], heroArchetypes: ['imprisoned statesman', 'pact-making rivals', 'street crowd'], sensitivity: 'standard' },
      { id: 'civil-war', label: 'Lebanese Civil War', ar: 'الحرب الأهلية اللبنانية', eraKey: 'modern', span: '1975–90', type: 'civil', sides: 'Christian militias vs Muslim/leftist factions + PLO; later Amal, Hezbollah; Syrian & Israeli interventions', stakes: 'the confessional order; a state pulled apart', theatres: ['the Green Line (East/West Beirut)', 'gutted downtown souks', 'refugee camps', 'mountain villages'], heroArchetypes: ['checkpoint militiaman', 'civilian crossing the line', 'mother searching the divide', 'foreign correspondent', 'doctor in a shelled clinic'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Palestine', aliases: ['palestine', 'فلسطين', 'palestinian', 'gaza', 'jerusalem', 'holy land'],
    conflicts: [
      { id: 'arab-revolt-36', label: '1936–39 Arab Revolt', ar: 'الثورة العربية الكبرى 1936', eraKey: 'mandate', span: '1936–39', type: 'independence', sides: 'Palestinian Arab fighters vs British Mandate', stakes: 'self-rule and immigration limits', theatres: ['hill villages', 'Jerusalem old city', 'Jaffa port'], heroArchetypes: ['village fighter', 'organizer', 'exiled leader'], sensitivity: 'high' },
      { id: '1948', label: '1948 War / Nakba', ar: 'نكبة 1948', eraKey: 'modern', span: '1948–49', type: 'interstate', sides: 'newly declared Israel vs an Arab coalition; Palestinians displaced', stakes: 'control of former Mandatory Palestine; statehood; refuge', theatres: ['Galilee', 'coastal towns', 'the road into exile', 'refugee camps'], heroArchetypes: ['displaced family', 'village defender', 'child carrying a key', 'nurse'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Jordan', aliases: ['jordan', 'الأردن', 'jordanian', 'amman', 'transjordan'],
    conflicts: [
      { id: 'arab-revolt-1916', label: 'Great Arab Revolt', ar: 'الثورة العربية الكبرى', eraKey: 'islamic', span: '1916–18', type: 'independence', sides: 'Hashemite-led Arab forces vs the Ottomans (with British liaison)', stakes: 'an independent Arab kingdom', theatres: ['the Hejaz railway', 'desert raids', 'Aqaba'], heroArchetypes: ['desert raider', 'sharifian prince', 'liaison officer', 'tribal sheikh'], sensitivity: 'standard' },
      { id: 'independence-1946', label: 'Independence (1946)', ar: 'الاستقلال 1946', eraKey: 'modern', span: '1946', type: 'independence', sides: 'Emirate negotiated from the British Mandate', stakes: 'the Hashemite Kingdom', theatres: ['Amman', 'the desert frontier'], heroArchetypes: ['Hashemite monarch', 'Arab Legion officer'], sensitivity: 'standard' },
    ],
  },
  {
    country: 'Iraq', aliases: ['iraq', 'العراق', 'iraqi', 'baghdad', 'mesopotamia', 'basra'],
    conflicts: [
      { id: '1920-revolt', label: '1920 Iraqi Revolt', ar: 'ثورة العشرين', eraKey: 'modern', span: '1920', type: 'independence', sides: 'cross-sectarian tribes & city notables vs British Mandate', stakes: 'self-rule; birthed the Hashemite monarchy', theatres: ['mid-Euphrates towns', 'Najaf & Karbala', 'Baghdad'], heroArchetypes: ['ex-Ottoman officer', 'tribal sheikh', 'cleric organizer'], sensitivity: 'contested' },
      { id: 'iran-iraq', label: 'Iran–Iraq War', ar: 'الحرب العراقية الإيرانية', eraKey: 'modern', span: '1980–88', type: 'interstate', sides: 'Iraq vs Iran (Gulf states financing Iraq)', stakes: 'the Shatt al-Arab, oil, post-revolution ideology; ~1M+ dead', theatres: ['the Faw peninsula & marshes', 'Khorramshahr/Abadan', 'Basra approaches', 'the Gulf (Tanker War)'], heroArchetypes: ['conscript', 'volunteer', 'POW', 'pilot', 'marsh/trench infantryman', 'chemical-attack survivor'], sensitivity: 'high' },
      { id: 'gulf-1991', label: 'Gulf War (1990–91)', ar: 'حرب الخليج', eraKey: 'modern', span: '1990–91', type: 'interstate', sides: 'Iraq vs a US-led, Arab-joined coalition', stakes: 'reversing the invasion of Kuwait; Gulf oil security', theatres: ['occupied Kuwait City', 'burning oilfields', 'the desert', 'Basra "Highway of Death"'], heroArchetypes: ['conscript', 'occupied civilian / resistance', 'POW', 'medic', 'embedded correspondent'], sensitivity: 'contested' },
      { id: 'iraq-2003', label: '2003 Iraq War', ar: 'حرب العراق 2003', eraKey: 'modern', span: '2003–11', type: 'interstate', sides: 'a US/UK-led coalition vs Ba’athist Iraq, then insurgency', stakes: 'regime change (on a disputed WMD premise — flag explicitly); occupation', theatres: ['Basra', 'Nasiriyah', 'the Battle of Baghdad', 'Firdos Square', 'occupation checkpoints'], heroArchetypes: ['Iraqi conscript', 'civilian under invasion', 'interpreter/fixer', 'coalition junior officer', 'insurgent'], sensitivity: 'high' },
    ],
  },
  // ── Gulf & Arabian Peninsula ──
  {
    country: 'Saudi Arabia', aliases: ['saudi', 'السعودية', 'ksa', 'najd', 'hijaz', 'arabia'],
    conflicts: [
      { id: 'unification', label: 'Unification of Saudi Arabia', ar: 'توحيد المملكة', eraKey: 'saudi-states', span: '1902–32', type: 'independence', sides: 'Ibn Saud & the Ikhwan vs rival emirates (Rashidi, Sharifian)', stakes: 'a single kingdom out of Najd & the Hijaz', theatres: ['the Masmak fort raid (Riyadh)', 'Najd desert', 'Mecca/Hijaz'], heroArchetypes: ['warrior-founder', 'zealous Ikhwan raider', 'rival emir', 'caravan guide'], sensitivity: 'standard' },
      { id: 'gulf-1991', label: 'Gulf War coalition (1990–91)', ar: 'تحالف حرب الخليج', eraKey: 'modern', span: '1990–91', type: 'interstate', sides: 'Saudi Arabia hosts & joins the coalition vs Iraq', stakes: 'defence of the Kingdom; liberation of Kuwait', theatres: ['the eastern desert staging grounds', 'Scud strikes on the cities', 'the Khafji border battle'], heroArchetypes: ['frontline soldier', 'civilian under Scud alert', 'coalition liaison'], sensitivity: 'contested' },
    ],
  },
  {
    country: 'Kuwait', aliases: ['kuwait', 'الكويت', 'kuwaiti'],
    conflicts: [
      { id: 'invasion-occupation', label: 'Iraqi invasion & occupation', ar: 'الغزو العراقي', eraKey: 'modern', span: '1990–91', type: 'interstate', sides: 'Iraq vs Kuwait, then the liberating coalition', stakes: 'national survival; seven months under occupation', theatres: ['occupied Kuwait City', 'the resistance underground', 'torched oil wells', 'the border'], heroArchetypes: ['civilian resistance member', 'hidden family', 'returning exile', 'resistance radio operator'], sensitivity: 'contested' },
    ],
  },
  {
    country: 'United Arab Emirates', aliases: ['uae', 'emirates', 'الإمارات', 'abu dhabi', 'dubai', 'trucial', 'emirati'],
    conflicts: [
      { id: 'trucial-protectorate', label: 'Trucial States & British protectorate', ar: 'الإمارات المتصالحة', eraKey: 'trucial', span: '1820–1971', type: 'colonization', sides: 'coastal sheikhdoms under British "truce" treaties; maritime raiding suppressed', stakes: 'autonomy under British-controlled defence & foreign relations', theatres: ['pearling ports', 'desert forts', 'the pirate-coast sea-lanes'], heroArchetypes: ['treaty-bound sheikh', 'British political agent', 'pearl diver', 'coastal raider'], sensitivity: 'standard' },
      { id: 'federation-1971', label: 'Federation & independence', ar: 'قيام الاتحاد', eraKey: 'modern', span: '1971–72', type: 'independence', sides: 'seven emirates uniting as British protection ends', stakes: 'one federation out of rival emirates (the Buraimi oasis dispute as backdrop)', theatres: ['the founding talks', 'frontier oases', 'oil terminals'], heroArchetypes: ['founding ruler', 'unifying statesman', 'frontier guard'], sensitivity: 'standard' },
      { id: 'gulf-1991', label: 'Gulf War coalition (1990–91)', ar: 'تحالف حرب الخليج', eraKey: 'modern', span: '1990–91', type: 'interstate', sides: 'the UAE joins the coalition vs Iraq', stakes: 'Gulf security; liberation of Kuwait', theatres: ['the desert front', 'air bases'], heroArchetypes: ['coalition airman/soldier', 'volunteer'], sensitivity: 'contested' },
    ],
  },
  {
    country: 'Qatar', aliases: ['qatar', 'قطر', 'qatari', 'doha'],
    conflicts: [
      { id: 'protectorate', label: 'Ottoman then British protectorate', ar: 'الحماية', eraKey: 'pre-oil', span: '1871–1971', type: 'colonization', sides: 'Al Thani rule under successive Ottoman then British treaties', stakes: 'autonomy and the pearling economy under foreign protection', theatres: ['pearling ports', 'the Doha fort', 'desert camps'], heroArchetypes: ['treaty-making sheikh', 'pearl merchant', 'British agent'], sensitivity: 'standard' },
      { id: 'gulf-1991', label: 'Gulf War coalition (1990–91)', ar: 'تحالف حرب الخليج', eraKey: 'modern', span: '1990–91', type: 'interstate', sides: 'Qatar joins the coalition vs Iraq (the Battle of Khafji nearby)', stakes: 'Gulf security; liberation of Kuwait', theatres: ['the northern Gulf front', 'Khafji'], heroArchetypes: ['coalition soldier', 'volunteer'], sensitivity: 'contested' },
    ],
  },
  {
    country: 'Oman', aliases: ['oman', 'عمان', 'omani', 'muscat', 'dhofar'],
    conflicts: [
      { id: 'dhofar', label: 'Dhofar Rebellion', ar: 'حرب ظفار', eraKey: 'modern', span: '1965–75', type: 'insurgency', sides: 'Marxist PFLOAG rebels vs the Sultan (with British & Iranian support)', stakes: 'control of the south; a modernizing palace coup (1970)', theatres: ['the monsoon jebel of Dhofar', 'mountain caves', 'coastal Salalah'], heroArchetypes: ['jebali rebel', 'seconded adviser', 'reforming young sultan', 'tribal irregular'], sensitivity: 'contested' },
    ],
  },
  {
    country: 'Yemen', aliases: ['yemen', 'اليمن', 'yemeni', 'sanaa', 'aden', 'hadhramaut'],
    conflicts: [
      { id: 'aden-emergency', label: 'Aden Emergency', ar: 'ثورة عدن', eraKey: 'modern', span: '1963–67', type: 'independence', sides: 'NLF & FLOSY guerrillas vs Britain', stakes: 'end of British Aden → South Yemen', theatres: ['the Crater district of Aden', 'the Radfan mountains', 'the port'], heroArchetypes: ['Marxist guerrilla', 'trade-unionist', 'British squaddie', 'tribal raider'], sensitivity: 'contested' },
      { id: 'north-1962', label: 'North Yemen revolution & civil war', ar: 'ثورة 26 سبتمبر', eraKey: 'modern', span: '1962–70', type: 'civil', sides: 'republican officers vs the Zaydi Imamate (Egypt & Saudi proxy war)', stakes: 'monarchy vs republic', theatres: ['Sana’a', 'the northern highlands', 'mountain forts'], heroArchetypes: ['republican officer', 'deposed imam', 'highland tribesman'], sensitivity: 'contested' },
      { id: 'civil-war-2014', label: 'Yemeni Civil War', ar: 'الحرب الأهلية اليمنية', eraKey: 'modern', span: '2014–', type: 'civil', sides: 'Houthi movement vs the government & a Saudi-led coalition', stakes: 'the state; one of the worst humanitarian crises', theatres: ['Sana’a old city', 'besieged Taiz', 'the Aden front', 'Red Sea ports'], heroArchetypes: ['fighter on either side', 'starving family', 'doctor amid famine/cholera', 'blockade smuggler', 'journalist'], sensitivity: 'high' },
    ],
  },
  // ── (Gulf city-states share the Gulf War regional substrate via Kuwait/Saudi/Iraq) ──
  {
    country: 'Bahrain', aliases: ['bahrain', 'البحرين', 'bahraini'],
    conflicts: [
      { id: 'uprising-2011', label: '2011 uprising', ar: 'انتفاضة 2011', eraKey: 'modern', span: '2011', type: 'revolution', sides: 'majority-Shia protest movement vs the Sunni monarchy (GCC Peninsula Shield intervened)', stakes: 'political rights & representation', theatres: ['the Pearl Roundabout', 'Manama', 'villages'], heroArchetypes: ['young protester', 'doctor treating the wounded', 'family divided by politics'], sensitivity: 'high' },
    ],
  },
  // ── Maghreb ──
  {
    country: 'Algeria', aliases: ['algeria', 'الجزائر', 'algerian', 'algiers', 'kabyle'],
    conflicts: [
      { id: 'french-conquest', label: 'French conquest & "pacification"', ar: 'الاحتلال الفرنسي', eraKey: 'french', span: '1830–1900s', type: 'colonization', sides: 'French army vs Abd al-Qadir & tribal resistance', stakes: '132 years of settler-colonial rule; vast loss of life (contested figures)', theatres: ['the coast & interior', 'mountain strongholds', 'settler farmland'], heroArchetypes: ['resistance emir', 'dispossessed farmer', 'colonial column officer'], sensitivity: 'contested' },
      { id: 'war-of-independence', label: 'War of Independence', ar: 'حرب التحرير', eraKey: 'french', span: '1954–62', type: 'independence', sides: 'FLN/ALN vs the French army & settlers (pieds-noirs)', stakes: 'end of French rule', theatres: ['the Casbah of Algiers', 'the Aurès & Kabylie mountains', 'café-bombing cityscape', 'internment camps'], heroArchetypes: ['maquis fighter', 'female bomb-carrier', 'double agent', 'paratrooper interrogator', 'torn pied-noir'], sensitivity: 'high' },
      { id: 'black-decade', label: 'Civil War ("Black Decade")', ar: 'العشرية السوداء', eraKey: 'modern', span: '1991–2002', type: 'civil', sides: 'the military-backed state vs Islamist insurgents (GIA, AIS)', stakes: 'an annulled election; ~100,000+ dead', theatres: ['Algiers & the Casbah', 'the rural "triangle of death"', 'night-raid villages'], heroArchetypes: ['conscript', 'targeted journalist', 'villager', 'defector torn between sides'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Morocco', aliases: ['morocco', 'المغرب', 'moroccan', 'rif', 'fez', 'marrakesh'],
    conflicts: [
      { id: 'rif-war', label: 'Rif War', ar: 'حرب الريف', eraKey: 'modern', span: '1921–26', type: 'independence', sides: 'Abd el-Krim’s Rif Republic vs Spain, then France', stakes: 'an independent Rif; a stunning early defeat of a colonial army (Annual, 1921)', theatres: ['the Rif mountains', 'Spanish forts', 'Berber villages (chemical bombing — flag)'], heroArchetypes: ['Berber rebel-statesman', 'mountain insurgent', 'colonial conscript'], sensitivity: 'contested' },
      { id: 'independence-1956', label: 'Independence (1956)', ar: 'الاستقلال 1956', eraKey: 'modern', span: '1953–56', type: 'independence', sides: 'Istiqlal & the Sultan vs the French protectorate', stakes: 'end of the protectorate; the Sultan’s exile & return', theatres: ['Fez medina', 'the royal palace', 'protest cities'], heroArchetypes: ['exiled sultan', 'nationalist organizer', 'urban demonstrator'], sensitivity: 'standard' },
    ],
  },
  {
    country: 'Tunisia', aliases: ['tunisia', 'تونس', 'tunisian', 'carthage'],
    conflicts: [
      { id: 'independence', label: 'Independence struggle', ar: 'الكفاح الوطني', eraKey: 'modern', span: '1930s–1956', type: 'independence', sides: 'Neo-Destour & fellagha guerrillas vs the French protectorate', stakes: 'sovereignty', theatres: ['the Tunis medina', 'olive-country hills', 'colonial prisons'], heroArchetypes: ['charismatic lawyer-leader (jailed/exiled)', 'mountain fellagha', 'union organizer'], sensitivity: 'standard' },
      { id: 'jasmine', label: 'Jasmine Revolution', ar: 'ثورة الياسمين', eraKey: 'modern', span: '2010–11', type: 'revolution', sides: 'a mass protest movement vs Ben Ali’s regime', stakes: 'dignity & jobs — the spark of the Arab Spring', theatres: ['Sidi Bouzid', 'Habib Bourguiba Avenue (Tunis)', 'provincial towns'], heroArchetypes: ['desperate street vendor', 'youth organizer', 'blogger', 'riot-line conscript'], sensitivity: 'contested' },
    ],
  },
  {
    country: 'Libya', aliases: ['libya', 'ليبيا', 'libyan', 'tripoli', 'benghazi', 'cyrenaica'],
    conflicts: [
      { id: 'anti-italian', label: 'Anti-Italian resistance', ar: 'المقاومة ضد إيطاليا', eraKey: 'italian', span: '1911–31', type: 'colonization', sides: 'Senussi guerrillas (Omar al-Mukhtar) vs Italian colonization', stakes: 'survival against a brutal "reconquest" (camps in Cyrenaica — flag)', theatres: ['the Jebel Akhdar', 'open desert ambushes', 'Cyrenaica internment camps'], heroArchetypes: ['aging imam-guerrilla', 'mounted tribesman', 'camp internee'], sensitivity: 'contested' },
      { id: 'revolution-2011', label: '2011 revolution & civil war', ar: 'ثورة 17 فبراير', eraKey: 'modern', span: '2011–', type: 'revolution', sides: 'anti-Gaddafi rebels (NATO-backed) vs the regime; then rival governments from 2014', stakes: 'the fall of a 42-year rule; a state pulled into fragments', theatres: ['Benghazi', 'the siege of Sirte', 'Tripoli districts', 'the Mediterranean migrant coast'], heroArchetypes: ['revolutionary turned militiaman', 'defected officer', 'civilian under rival authorities', 'migrant/smuggler on the Europe route'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Mauritania', aliases: ['mauritania', 'موريتانيا', 'mauritanian', 'sanhaja'],
    conflicts: [
      { id: 'pacification', label: 'French "pacification" & independence', ar: 'المقاومة والاستقلال', eraKey: 'modern', span: '1900–1960', type: 'colonization', sides: 'Saharan tribes vs French expansion → negotiated independence (1960)', stakes: 'the desert frontier; a new nation', theatres: ['the Sahara', 'oasis towns', 'caravan routes'], heroArchetypes: ['veiled tribal warrior', 'founding statesman', 'nomad caught by borders'], sensitivity: 'standard' },
    ],
  },
  // ── Horn / Indian Ocean ──
  {
    country: 'Somalia', aliases: ['somalia', 'الصومال', 'somali', 'mogadishu', 'ogaden'],
    conflicts: [
      { id: 'dervish', label: 'Dervish movement', ar: 'حركة الدراويش', eraKey: 'sultanates', span: '1899–1920', type: 'colonization', sides: 'the Sayyid’s Dervishes vs Britain, Italy & Ethiopia', stakes: 'two decades of resistance to colonial partition', theatres: ['the Taleh forts', 'the Ogaden scrub', 'aerial bombardment (1920)'], heroArchetypes: ['poet-sheikh rebel', 'dervish fighter', 'colonial column'], sensitivity: 'contested' },
      { id: 'civil-war', label: 'Somali Civil War', ar: 'الحرب الأهلية الصومالية', eraKey: 'modern', span: '1991–', type: 'civil', sides: 'clan factions, warlords, then Islamist insurgents (Al-Shabaab) vs the federal government & AU forces', stakes: 'a collapsed state; clan and ideology', theatres: ['warlord-divided Mogadishu', 'famine zones', 'the pirate coast'], heroArchetypes: ['clan militiaman', 'warlord', 'family in famine', 'aid worker', 'child at the checkpoints'], sensitivity: 'high' },
    ],
  },
  {
    country: 'Djibouti', aliases: ['djibouti', 'جيبوتي', 'djiboutian', 'afar', 'issa'],
    conflicts: [
      { id: 'independence-1977', label: 'Road to independence', ar: 'طريق الاستقلال', eraKey: 'french', span: '1960s–77', type: 'independence', sides: 'Issa-led pro-independence movements vs France ("France’s last colony")', stakes: 'sovereignty for a strategic Red Sea port', theatres: ['the port of Djibouti', 'the Afar desert', 'colonial garrisons'], heroArchetypes: ['nationalist organizer', 'French legionnaire', 'dock worker'], sensitivity: 'standard' },
    ],
  },
  {
    country: 'Comoros', aliases: ['comoros', 'جزر القمر', 'comorian', 'moroni'],
    conflicts: [
      { id: 'independence-coups', label: 'Independence & the coup years', ar: 'الاستقلال وسنوات الانقلابات', eraKey: 'french', span: '1975–', type: 'independence', sides: 'island leaders vs France (Mayotte stayed French — disputed) and serial mercenary coups', stakes: 'a fragile island state; the Mayotte question', theatres: ['Moroni', 'the Indian-Ocean isles', 'palace coups'], heroArchetypes: ['island president', 'coup mercenary', 'fisherman-citizen'], sensitivity: 'contested' },
    ],
  },
];

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();

/** Does this brief want war/conflict/political steering? Keeps a rom-com set in Beirut war-free. */
export function isConflictStory(brief: any): boolean {
  if (!brief) return false;
  if (brief.conflict || brief.conflictId || brief.politicalArc) return true; // explicit opt-in (future intake)
  const hay = lc(([] as any[]).concat(
    brief.genres || [], brief.baseGenres || [], brief.blendLayers || [],
    brief.tones || [], [brief.baseGenre, brief.tone, brief.projectIntent, brief.logline, brief.premise],
  ).filter(Boolean).join(' '));
  return /\bwar\b|conflict|histor|political|militar|resist|revolution|insurgen|occupation|independence|colonial|partisan|guerr/.test(hay);
}

/** Find the country's conflict set. Story setting wins over audience market (same priority as eras). */
export function findCountryConflicts(brief: any): CountryConflicts | null {
  const fields = [brief && brief.settingCountry, brief && brief.settingPlace, brief && brief.cultureEra, brief && brief.settingEra, brief && brief.country, brief && brief.market];
  for (const fld of fields) {
    const h = lc(Array.isArray(fld) ? fld.join(' ') : (fld || ''));
    if (!h) continue;
    for (const c of CONFLICTS) { if (c.aliases.some((a) => h.includes(a))) return c; }
  }
  return null;
}

/** Pick the conflicts most relevant to the chosen era; else return all for the country. */
export function relevantConflicts(c: CountryConflicts, brief: any): Conflict[] {
  if (!c) return [];
  const hay = lc([brief && brief.settingEra, brief && brief.cultureEra, brief && brief.eraKey].filter(Boolean).join(' '));
  if (hay) {
    const hit = c.conflicts.filter((x) => (x.eraKey && hay.includes(lc(x.eraKey))) || hay.includes(lc(x.label.split(' ')[0])) || (x.span && hay.includes(lc(x.span))));
    if (hit.length) return hit;
  }
  return c.conflicts;
}

/** The conflict steering directive — only for war/conflict/political stories. Carries the sensitivity guardrail. */
export function conflictDirective(brief: any): string {
  if (!isConflictStory(brief)) return '';
  const c = findCountryConflicts(brief);
  if (!c) return '';
  const list = relevantConflicts(c, brief);
  if (!list.length) return '';
  const bits: string[] = [];
  bits.push('CONFLICT SUBSTRATE: ' + c.country + ' — anchor the war/resistance/political dimension in real history (use as texture & truth, not a lecture).');
  for (const x of list.slice(0, 3)) {
    bits.push('• ' + x.label + ' (' + x.span + ', ' + x.type + '): ' + x.sides + '. At stake: ' + x.stakes + '. Theatres: ' + x.theatres.join('; ') + '. Protagonist roles to draw on: ' + x.heroArchetypes.join(', ') + '.');
  }
  const maxSens = list.reduce((m, x) => (x.sensitivity === 'high' ? 'high' : (x.sensitivity === 'contested' && m !== 'high' ? 'contested' : m)), 'standard' as ConflictSensitivity);
  if (maxSens === 'high') bits.push('SENSITIVITY HIGH (ongoing and/or sectarian): stay strictly non-partisan — give every side human motive, never assign collective guilt, preserve civilian dignity and agency, do not glorify or aestheticise violence, and avoid sectarian/ethnic stereotyping. Prefer "inspired by" over depicting real living figures.');
  else if (maxSens === 'contested') bits.push('SENSITIVITY: this history is contested — keep factions factual and even-handed; casualty/blame claims stay neutral.');
  return bits.join(' ');
}

/** Compact summary for UI/debug. */
export function conflictSummary(brief: any): string {
  const c = findCountryConflicts(brief);
  if (!c || !isConflictStory(brief)) return '';
  return c.country + ': ' + relevantConflicts(c, brief).map((x) => x.label).join(' · ');
}
