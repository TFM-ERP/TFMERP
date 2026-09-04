import { yearsToDays } from './era.util';
import { roundHalfAwayFromZero } from './era-days.util';

/**
 * ERA -> YEAR — what year a named period means, and when to refuse to say.
 *
 * `settingEra` can derive the build's present year only if the chosen period HAS a year. This file
 * is that map, and the standing rule applies: a constant that cannot say where it came from is a
 * constant nobody can audit, so every row carries the clause that fixes its boundary.
 *
 * TWO THINGS THIS FILE DELIBERATELY WILL NOT DO.
 *
 *   1. IT WILL NOT ANCHOR AN UNSOUND LABEL. 26 of the 118 rows name more than one polity, or name
 *      something whose identification is not established. "Ibadi Imamate" is eight discontinuous
 *      imamates over 1,200 years, and its midpoint — 1355 — falls inside the Nabhani gap, a year in
 *      which no imamate existed. Such a row returns NO year and a reason. Offsets are relative, so
 *      everything else still works; only the printed year waits for the user.
 *   2. IT WILL NOT BE READ BACKWARDS. The era list is a creative MENU of evocative periods, not a
 *      calendar: it has 33 gaps of more than 25 years (44 of any size, and 2,430 unlabelled years between the UAE's
 *      Bronze Age and its Islamic era) and 11 overlaps. So era -> year only. A year -> era lookup would be undefined
 *      across the gaps and ambiguous across the overlaps, and nothing in the design needs one.
 *      The overlaps are mostly the occupying-power rows, which NEST inside the civilisational ones on
 *      purpose: 1600 in Bahrain is both 'Islamic Bahrain' and 'Portuguese Bahrain', and which one a
 *      script means is a creative choice the writer makes, not one this file can compute.
 *
 * The keys are the exact option labels the form shows. A renamed label simply misses, and a miss is
 * a SUPPORTED STATE — the anchor falls through to the generic band and then to the current year.
 *
 * PURE. NEVER THROWS.
 */

/** '' = uncontroversial · 'disputed' = a boundary scholars move by more than ~50 years ·
 *  'unsound' = the LABEL will not carry an anchor at all. */
export type EraFlag = '' | 'disputed' | 'unsound';

export interface EraRow {
  country: string;
  /** The exact label string the form displays. */
  label: string;
  /** null where no start is sourced at all - the row is a period nobody dated the beginning of. */
  start: number | null;
  /** null means "the story's own present" — so a modern-era anchor never goes stale. */
  end: number | null;
  flag: EraFlag;
  basis: string;
  /**
   * A standing disclosure the row ALWAYS carries, whatever its flag says about dates. Empty on
   * almost every row. It is appended to EVERY verdict for the row - clean, disputed or refused -
   * because it states a fact about the place, not a confidence about a boundary, and those are
   * different axes. A writer who picks any present-day Palestinian era must be told the land is
   * occupied whether or not the dates of that era are in doubt.
   */
  standing?: string;
}

/** The nine generic bands, for a country with no deep timeline. Six state their own range in the
 *  label the user already reads, so those rows record what the UI has always claimed. */
export interface BandRow { id: string; start: number | null; end: number | null; offset?: number }
export const ERA_BANDS: BandRow[] = [
  { id: 'ancient', start: -3000, end: 500 },
  { id: 'medieval', start: 500, end: 1500 },
  { id: 'early-modern', start: 1500, end: 1800 },
  { id: '19c', start: 1800, end: 1900 },
  { id: 'early-20c', start: 1900, end: 1940 },
  { id: 'mid-20c', start: 1940, end: 1979 },
  { id: 'contemporary', start: null, end: null, offset: 0 },
  { id: 'near-future', start: null, end: null, offset: 25 },
  { id: 'far-future', start: null, end: null, offset: 150 },
];

export const COUNTRY_ERA_YEARS: EraRow[] = [
  { country: 'Egypt', label: 'Pharaonic', start: -3100, end: -332, flag: 'disputed', basis: 'Unification / 1st Dynasty to Alexander\'s conquest' },
  { country: 'Egypt', label: 'Ptolemaic / Greco-Roman', start: -332, end: 641, flag: 'unsound', basis: 'Alexander through Ptolemaic and Roman/Byzantine rule to the Arab conquest' },
  { country: 'Egypt', label: 'Coptic', start: 300, end: 641, flag: 'disputed', basis: 'Christianisation of Egypt to the Arab conquest' },
  { country: 'Egypt', label: 'Arab-Islamic', start: 641, end: 1517, flag: '', basis: 'Arab conquest 639–642 to Selim I\'s conquest 1517' },
  { country: 'Egypt', label: 'Ottoman', start: 1517, end: 1798, flag: 'disputed', basis: 'Ottoman conquest to Napoleon\'s invasion' },
  { country: 'Egypt', label: 'British occupation', start: 1882, end: 1922, flag: 'disputed', basis: 'Occupation after Tel el-Kebir, Sept 1882, through the 1914 protectorate to the unilateral declaration of independence, 28 Feb 1922; British troops remain until 1956' },
  { country: 'Egypt', label: 'Modern Egyptian', start: 1805, end: null, flag: '', basis: 'Accession of Muhammad Ali' },
  { country: 'Iraq', label: 'Sumer / Akkad / Babylon', start: -4000, end: -539, flag: 'unsound', basis: 'Uruk-period Sumer to Cyrus\'s capture of Babylon' },
  { country: 'Iraq', label: 'Abbasid Baghdad', start: 762, end: 1258, flag: '', basis: 'al-Manṣūr founds Baghdad to Hülegü\'s sack' },
  { country: 'Iraq', label: 'Ottoman Iraq', start: 1534, end: 1917, flag: 'disputed', basis: 'Süleyman I takes Baghdad 1534 to the British occupation of Baghdad, March 1917; the Safavids hold Baghdad 1623-1638' },
  { country: 'Iraq', label: 'British Mandate', start: 1920, end: 1932, flag: '', basis: 'San Remo assigns the mandate, April 1920, to Iraq\'s admission to the League of Nations, 3 Oct 1932' },
  { country: 'Iraq', label: 'Modern Iraq', start: 1920, end: null, flag: '', basis: 'British Mandate / creation of the Iraqi state' },
  { country: 'Greece', label: 'Classical', start: -480, end: -323, flag: '', basis: 'End of the Persian Wars to Alexander\'s death' },
  { country: 'Greece', label: 'Hellenistic / Koine', start: -323, end: -30, flag: 'disputed', basis: 'Alexander\'s death to Rome\'s conquest of Egypt' },
  { country: 'Greece', label: 'Modern Greece', start: 1821, end: null, flag: '', basis: 'War of Independence 1821, sovereignty 1830' },
  { country: 'Britain', label: 'Anglo-Saxon', start: 410, end: 1066, flag: '', basis: 'End of Roman Britain to the Norman Conquest' },
  { country: 'Britain', label: 'Norman / Medieval', start: 1066, end: 1485, flag: 'unsound', basis: 'Norman Conquest to Bosworth' },
  { country: 'Britain', label: 'Tudor / Early Modern', start: 1485, end: 1750, flag: 'unsound', basis: 'Accession of Henry VII to the conventional early-modern close' },
  { country: 'Britain', label: 'Modern Britain', start: 1750, end: null, flag: 'disputed', basis: 'Conventional early-modern / modern divide' },
  { country: 'Mexico', label: 'Mesoamerican (Aztec/Maya)', start: -1800, end: 1521, flag: 'unsound', basis: 'Earliest Maya Preclassic to the fall of Tenochtitlán' },
  { country: 'Mexico', label: 'New Spain (Colonial)', start: 1521, end: 1821, flag: '', basis: 'Fall of Tenochtitlán to the Treaty of Córdoba' },
  { country: 'Mexico', label: 'Modern Mexico', start: 1821, end: null, flag: '', basis: 'Independence under the Treaty of Córdoba' },
  { country: 'Japan', label: 'Heian', start: 794, end: 1185, flag: '', basis: 'Capital moved to Heian-kyō to the fall of the Taira' },
  { country: 'Japan', label: 'Edo / Tokugawa', start: 1603, end: 1867, flag: '', basis: 'Ieyasu made shogun to the shogunate\'s surrender of power' },
  { country: 'Japan', label: 'Modern Japan', start: 1868, end: null, flag: '', basis: 'Meiji Restoration' },
  { country: 'Saudi Arabia', label: 'Pre-Islamic Arabia (Jāhiliyya)', start: null, end: 610, flag: 'unsound', basis: 'Ends at the first Qur\'anic revelation; jahiliyya is defined only relative to it and has no sourced start' },
  { country: 'Saudi Arabia', label: 'Early Islamic Hijaz', start: 610, end: 661, flag: 'disputed', basis: 'Revelation / Hijra to the end of Rashidun rule from Medina' },
  { country: 'Saudi Arabia', label: 'Ottoman Hejaz & al-Hasa', start: 1517, end: 1918, flag: 'unsound', basis: 'The label names the two COASTS only - Najd was never held. Selim I takes the Hejaz 1517 and holds it to the Arab Revolt of 1916 and the collapse of 1918; al-Hasa is held 1550-1670 and again 1871 until Ibn Saud takes it in 1913. Two coasts, three spans, so no single year represents the label' },
  { country: 'Saudi Arabia', label: 'First Saudi State (Diriyah)', start: 1727, end: 1818, flag: 'disputed', basis: 'Muhammad bin Saud takes Diriyah 1727, though the 1744 pact with Ibn ʿAbd al-Wahhab is as often given as the founding, to Ibrahim Pasha razing Diriyah in 1818' },
  { country: 'Saudi Arabia', label: 'Second Saudi State (Nejd)', start: 1824, end: 1891, flag: '', basis: 'Turki bin Abdullah retakes Riyadh 1824 to the Rashidi victory at al-Mulayda, 1891' },
  { country: 'Saudi Arabia', label: 'Unification (Ibn Saud)', start: 1902, end: 1932, flag: '', basis: 'Ibn Saud retakes Riyadh 15 Jan 1902 to the proclamation of the Kingdom, 23 Sept 1932' },
  { country: 'Saudi Arabia', label: 'Modern Saudi Arabia', start: 1932, end: null, flag: '', basis: 'Royal decree of 23 Sept 1932 unifying Hejaz and Najd' },
  { country: 'Yemen', label: 'Sabaean / Himyarite', start: -800, end: 570, flag: 'unsound', basis: 'Saba to the Aksumite and Sasanian conquests' },
  { country: 'Yemen', label: 'Islamic Yemen (Rasulid / Zaydi)', start: 897, end: 1962, flag: 'unsound', basis: 'Zaydi imamate at Saʿda to the 1962 republic' },
  { country: 'Yemen', label: 'First Ottoman Yemen', start: 1538, end: 1636, flag: '', basis: 'Ottoman arrival 1538 to the Qasimid imams driving them out entirely in 1635-36' },
  { country: 'Yemen', label: 'Qasimid Yemen (independent Zaydi)', start: 1636, end: 1849, flag: '', basis: 'Two centuries in which the north answered to no outside power: the Qasimid imamate from the Ottoman expulsion of 1636 to the Ottoman return to the Tihamah in 1849' },
  { country: 'Yemen', label: 'Second Ottoman Yemen', start: 1849, end: 1918, flag: 'disputed', basis: 'The Ottomans return to the Tihamah coast in 1849 but do not retake Sanaʿa until 1872, a 23-year spread on the start, and hold to the end of the First World War' },
  { country: 'Yemen', label: 'British Aden', start: 1839, end: 1967, flag: '', basis: 'Britain takes Aden, Jan 1839, to the withdrawal of 30 Nov 1967' },
  { country: 'Yemen', label: 'Modern Yemen', start: 1990, end: null, flag: 'disputed', basis: 'North–South unification, 22 May 1990' },
  { country: 'UAE', label: 'Magan (Bronze Age)', start: -2500, end: -1800, flag: 'disputed', basis: 'Umm an-Nar period; Magan named in cuneiform from c. −2300' },
  { country: 'UAE', label: 'Islamic era', start: 630, end: 1820, flag: 'unsound', basis: 'Muhammad\'s envoys reach the region to the General Maritime Treaty' },
  { country: 'UAE', label: 'Portuguese era', start: 1507, end: 1650, flag: 'disputed', basis: 'Albuquerque takes Julfar and Khor Fakkan 1507; the Yaʿrubids oust the Portuguese from Julfar and Dibba 1633 and Muscat 1650. Gulf-wide accounts run it from da Gama\'s 1498 voyage, so the start moves by nine years' },
  { country: 'UAE', label: 'Trucial States (British protection)', start: 1820, end: 1971, flag: 'disputed', basis: 'General Maritime Treaty of 1820, exclusive agreement 1892, to federation on 2 Dec 1971; the status was a protected state rather than a formal protectorate, which is the disputed part' },
  { country: 'UAE', label: 'Modern UAE', start: 1971, end: null, flag: '', basis: 'Federation established 2 Dec 1971' },
  { country: 'Qatar', label: 'Pearling / Bedouin Qatar', start: 1766, end: 1939, flag: 'disputed', basis: 'Al-Zubārah founded to the discovery of oil' },
  { country: 'Qatar', label: 'Ottoman Qatar', start: 1871, end: 1915, flag: '', basis: 'Ottoman garrison lands at Bidda, Dec 1871; evacuated the night of 19-20 Aug 1915' },
  { country: 'Qatar', label: 'British protection', start: 1916, end: 1971, flag: '', basis: 'Anglo-Qatari treaty of 3 Nov 1916 to independence, 3 Sept 1971' },
  { country: 'Qatar', label: 'Modern Qatar', start: 1971, end: null, flag: '', basis: 'Independence declared 3 Sept 1971' },
  { country: 'Kuwait', label: 'Pre-oil Kuwait (Bani Utub, pearling/trade)', start: 1752, end: 1946, flag: 'disputed', basis: 'Bani Utub choose a Ṣabāḥ sheikh to the first crude export' },
  { country: 'Kuwait', label: 'British protection', start: 1899, end: 1961, flag: '', basis: 'Anglo-Kuwaiti Agreement of 23 Jan 1899 to Britain\'s recognition of independence, 19 June 1961' },
  { country: 'Kuwait', label: 'Modern Kuwait', start: 1961, end: null, flag: '', basis: 'Britain recognises independence, 19 June 1961' },
  { country: 'Bahrain', label: 'Dilmun (Bronze Age)', start: -2200, end: -1600, flag: 'disputed', basis: 'Early Dilmun; Qalʿat al-Bahrain occupied from c. −2300' },
  { country: 'Bahrain', label: 'Islamic Bahrain', start: 628, end: 1783, flag: 'unsound', basis: 'Conversion of al-Mundhir ibn Sāwā to Āl Khalīfah rule' },
  { country: 'Bahrain', label: 'Portuguese Bahrain', start: 1521, end: 1602, flag: '', basis: 'António Correia takes Bahrain from the Jabrids 1521 to the Safavid conquest 1602' },
  { country: 'Bahrain', label: 'Safavid / Persian Bahrain', start: 1602, end: 1783, flag: 'disputed', basis: 'Safavid conquest 1602 to the Bani Utbah invasion 1783; Persian control lapses after Isfahan falls in 1722 and the island passes between Omani, Persian and Huwala hands' },
  { country: 'Bahrain', label: 'British protection', start: 1861, end: 1971, flag: 'disputed', basis: 'Perpetual Treaty of Peace and Friendship 1861 to independence 15 Aug 1971. 1892 is the stricter legal anchor - the exclusive agreement that made the status match the Trucial States - so the start moves by 31 years. Begun at 1861 to match the UAE row, which likewise starts at the first maritime treaty rather than at 1892' },
  { country: 'Bahrain', label: 'Modern Bahrain', start: 1971, end: null, flag: '', basis: 'Independence declared 15 Aug 1971' },
  { country: 'Oman', label: 'Magan (copper kingdom)', start: -2500, end: -1800, flag: 'disputed', basis: 'Umm an-Nar period; Magan the principal copper source' },
  { country: 'Oman', label: 'Ibadi Imamate', start: 750, end: 1959, flag: 'unsound', basis: 'First imamate after the Umayyad fall to the 1959 surrender' },
  { country: 'Oman', label: 'Portuguese Muscat', start: 1507, end: 1650, flag: '', basis: 'Albuquerque captures Muscat 1507 to the Yaʿrubid recapture 1650; the last garrison leaves Khasab 1656' },
  { country: 'Oman', label: 'Omani Empire (Zanzibar)', start: 1650, end: 1856, flag: 'disputed', basis: 'Yaʿrubids retake Muscat to the split on Saʿīd\'s death' },
  { country: 'Oman', label: 'Modern Oman', start: 1970, end: null, flag: '', basis: 'Accession of Qaboos bin Said — Oman was never formally colonised' },
  { country: 'Syria', label: 'Aramean / Classical antiquity', start: -1200, end: 636, flag: 'unsound', basis: 'Aramean emergence to the Byzantine defeat at Yarmūk' },
  { country: 'Syria', label: 'Umayyad Damascus', start: 661, end: 750, flag: '', basis: 'The Umayyad caliphate ruled from Damascus' },
  { country: 'Syria', label: 'Ottoman Syria', start: 1516, end: 1918, flag: '', basis: 'Marj Dābiq to the Ottoman withdrawal from Damascus' },
  { country: 'Syria', label: 'Modern Syria', start: 1946, end: null, flag: '', basis: 'French withdrawal completed April 1946' },
  { country: 'Lebanon', label: 'Phoenician city-states', start: -1200, end: -332, flag: 'disputed', basis: 'Iron Age independence of Tyre / Sidon / Byblos to Alexander\'s siege' },
  { country: 'Lebanon', label: 'Mount Lebanon (Maronite / Druze)', start: 1516, end: 1918, flag: 'unsound', basis: 'Maʿnid emirate through the Mutasarrifate' },
  { country: 'Lebanon', label: 'French Mandate', start: 1920, end: 1943, flag: '', basis: 'Greater Lebanon proclaimed to independence, 22 Nov 1943' },
  { country: 'Lebanon', label: 'Modern Lebanon', start: 1943, end: null, flag: '', basis: 'Independence proclaimed 22 Nov 1943' },
  { country: 'Jordan', label: 'Nabataean (Petra)', start: -312, end: 106, flag: '', basis: 'Nabataeans attested to Trajan\'s annexation' },
  { country: 'Jordan', label: 'Islamic era', start: 636, end: 1918, flag: 'unsound', basis: 'Arab conquest to the end of Ottoman rule' },
  { country: 'Jordan', label: 'British Mandate (Transjordan)', start: 1921, end: 1946, flag: '', basis: 'Emirate of Transjordan established April 1921 to independence, 25 May 1946' },
  { country: 'Jordan', label: 'Modern Jordan', start: 1946, end: null, flag: '', basis: 'Treaty of London, independence 25 May 1946' },
  { country: 'Palestine', label: 'Canaanite / Philistine antiquity', start: -2000, end: -604, flag: 'unsound', basis: 'Middle Bronze city-states to the destruction of Philistia' },
  { country: 'Palestine', label: 'Roman Judea', start: -63, end: 135, flag: 'disputed', basis: 'Pompey takes Jerusalem 63 BC and the province of Iudaea is formed in AD 6 - the start moves by 69 years depending which you count - to Hadrian merging the provinces as Syria Palaestina after the Bar Kokhba revolt, 135. Rome did not call the region Palestine before that date' },
  { country: 'Palestine', label: 'Syria Palaestina / Byzantine', start: 135, end: 638, flag: 'disputed', basis: 'Hadrian\'s renaming in 135 through Constantine\'s Christianisation of the province to the Arab conquest of 638; pagan Rome and Christian Byzantium sit inside one label, so the midpoint represents the Byzantine half' },
  { country: 'Palestine', label: 'Islamic Palestine (Jund Filasṭīn)', start: 638, end: 1099, flag: 'disputed', basis: 'ʿUmar\'s capture of Jerusalem 638; the region is administered as Jund Filasṭīn, one of the ajnād of Bilād al-Shām, through Rashidun, Umayyad, Abbasid and Fatimid rule, to the Crusader capture of Jerusalem on 15 July 1099' },
  { country: 'Palestine', label: 'Crusader Kingdom of Jerusalem', start: 1099, end: 1291, flag: '', basis: 'First Crusade takes Jerusalem 15 July 1099 to the fall of Acre, 18 May 1291' },
  { country: 'Palestine', label: 'Mamluk Palestine', start: 1291, end: 1516, flag: '', basis: 'Mamluk rule from the fall of Acre 1291 to Marj Dābiq, 1516' },
  { country: 'Palestine', label: 'Ottoman Palestine', start: 1516, end: 1917, flag: 'disputed', basis: 'Marj Dābiq 1516 to Allenby entering Jerusalem, 11 Dec 1917; the four centuries between run through the Damascus and Beirut vilayets and the Sanjak of Jerusalem, so the administrative frame moves inside the label' },
  { country: 'Palestine', label: 'British Mandate', start: 1917, end: 1948, flag: 'disputed', basis: 'The start moves by six years depending on the instrument: OETA military rule from Dec 1917, civil administration 1 July 1920, League ratification 1922 and entry into force 1923. Ends with the Mandate\'s termination, 15 May 1948' },
  { country: 'Palestine', label: 'Nakba and after', start: 1948, end: 1967, flag: '', basis: 'The Mandate\'s termination and the Nakba, 15 May 1948, to the June 1967 war; the West Bank is administered by Jordan and Gaza by Egypt throughout' },
  { country: 'Palestine', label: 'Occupation (1967– )', start: 1967, end: null, flag: 'disputed', basis: 'The June 1967 war to THE STORY\'S OWN PRESENT - this row has no closing year because the occupation of the West Bank, Gaza and East Jerusalem has not ended. Oslo 1993 and the Palestinian Authority 1994 sit inside it, not after it', standing: 'The West Bank, Gaza and East Jerusalem remain under occupation, so this period has not closed.' },
  { country: 'Palestine', label: 'Modern Palestine', start: 1988, end: null, flag: 'disputed', basis: 'Declaration of Independence proclaimed at Algiers, 15 Nov 1988 - the founding act, as every other Modern row in this file uses one. 1948, 1964 and 1994 are all argued instead, a spread of 46 years, which is why this is flagged', standing: 'The West Bank, Gaza and East Jerusalem remain under occupation, so this period has not closed.' },
  { country: 'Morocco', label: 'Amazigh / Mauretania', start: -225, end: 44, flag: 'unsound', basis: 'Mauretanian kingdom to annexation by Claudius' },
  { country: 'Morocco', label: 'Idrisid (Islamization)', start: 788, end: 974, flag: 'disputed', basis: 'Idris I to the Idrisid expulsion' },
  { country: 'Morocco', label: 'Almoravid / Almohad', start: 1062, end: 1269, flag: 'unsound', basis: 'Almoravid rise to the fall of Almohad Marrakech' },
  { country: 'Morocco', label: 'French / Spanish Protectorate', start: 1912, end: 1956, flag: '', basis: 'Treaty of Fes, 30 March 1912, to independence, 2 March 1956' },
  { country: 'Morocco', label: 'Modern Morocco', start: 1956, end: null, flag: 'disputed', basis: 'End of the French and Spanish protectorates; the start is arguable at 1912 or 1666 because the list skips 1269-1956' },
  { country: 'Algeria', label: 'Numidia / Carthage-Rome', start: -814, end: 429, flag: 'unsound', basis: 'Traditional founding of Carthage to the Vandal crossing' },
  { country: 'Algeria', label: 'Ottoman Regency of Algiers', start: 1516, end: 1830, flag: '', basis: 'Aruj invited to Algiers to the French capture' },
  { country: 'Algeria', label: 'French Algeria', start: 1830, end: 1962, flag: '', basis: 'French conquest to independence' },
  { country: 'Algeria', label: 'Modern Algeria', start: 1962, end: null, flag: '', basis: 'Independence 1962' },
  { country: 'Tunisia', label: 'Carthage (Punic)', start: -814, end: -146, flag: '', basis: 'Founding to destruction in the Third Punic War' },
  { country: 'Tunisia', label: 'Ifriqiya (Aghlabid / Kairouan)', start: 800, end: 909, flag: '', basis: 'The Aghlabid dynasty at Kairouan' },
  { country: 'Tunisia', label: 'Ottoman / Husainid Beylik', start: 1574, end: 1881, flag: 'unsound', basis: 'Ottoman incorporation to the Treaty of Bardo' },
  { country: 'Tunisia', label: 'Modern Tunisia', start: 1956, end: null, flag: '', basis: 'Independence 1956, republic 1957' },
  { country: 'Libya', label: 'Garamantes / Greco-Roman', start: -1000, end: 700, flag: 'unsound', basis: 'Envelope of the Fazzan Garamantian and the coastal Greco-Roman sequences' },
  { country: 'Libya', label: 'Ottoman / Karamanli (Tripoli)', start: 1551, end: 1911, flag: 'unsound', basis: 'Ottoman capture of Tripoli to the Italian occupation' },
  { country: 'Libya', label: 'Italian Libya', start: 1911, end: 1943, flag: '', basis: 'Italian occupation to the Allied expulsion of the Axis' },
  { country: 'Libya', label: 'Modern Libya', start: 1951, end: null, flag: '', basis: 'Independence declared 24 Dec 1951' },
  { country: 'Mauritania', label: 'Sanhaja Berber / trans-Saharan', start: 700, end: 1040, flag: 'disputed', basis: 'Regular camel caravans to the start of the Sanhaja reform' },
  { country: 'Mauritania', label: 'Almoravid reform', start: 1040, end: 1147, flag: '', basis: 'Ibn Yasin\'s movement to the Almohad capture of Marrakesh' },
  { country: 'Mauritania', label: 'Modern Mauritania', start: 1960, end: null, flag: '', basis: 'Independence declared 28 Nov 1960' },
  { country: 'Sudan', label: 'Kush / Meroë (Nubian)', start: -780, end: 350, flag: 'disputed', basis: 'Napatan emergence at el-Kurru to the last Meroitic royal burials' },
  { country: 'Sudan', label: 'Christian Nubia (Makuria)', start: 569, end: 1317, flag: 'disputed', basis: 'Makuria\'s conversion to the mosque conversion at Dongola' },
  { country: 'Sudan', label: 'Funj Sultanate (Sennar)', start: 1504, end: 1821, flag: '', basis: 'Foundation under Amara Dunqas to the submission of Badi VII' },
  { country: 'Sudan', label: 'Modern Sudan', start: 1956, end: null, flag: '', basis: 'End of the Condominium, independence 1 Jan 1956' },
  { country: 'Somalia', label: 'Land of Punt / antiquity', start: -2500, end: -1160, flag: 'unsound', basis: 'Span of attested Egyptian contact with Punt — not a claim about Somali territory' },
  { country: 'Somalia', label: 'Islamic sultanates (Adal / Ajuran)', start: 1250, end: 1700, flag: 'unsound', basis: 'Ajuran attested to its collapse; Adal flourished 1415–1577' },
  { country: 'Somalia', label: 'Modern Somalia', start: 1960, end: null, flag: '', basis: 'Union as the Somali Republic, 1 July 1960' },
  { country: 'Djibouti', label: 'Adal / Afar-Somali sultanates', start: 1285, end: 1862, flag: 'unsound', basis: 'Walashma Ifat through Adal, Aussa and Tadjoura to the purchase of Obock' },
  { country: 'Djibouti', label: 'French Somaliland', start: 1896, end: 1967, flag: 'disputed', basis: 'Côte française des Somalis to its 1967 renaming' },
  { country: 'Djibouti', label: 'Modern Djibouti', start: 1977, end: null, flag: '', basis: 'Independence 27 June 1977' },
  { country: 'Comoros', label: 'Shirazi / Swahili sultanates', start: 1200, end: 1886, flag: 'unsound', basis: 'Attested sultanate towns to the French protectorate treaties' },
  { country: 'Comoros', label: 'French colonial', start: 1886, end: 1975, flag: '', basis: 'Protectorate treaties to independence, 6 July 1975' },
  { country: 'Comoros', label: 'Modern Comoros', start: 1975, end: null, flag: '', basis: 'Independence declared 6 July 1975' },
];

/** The same half-away-from-zero rule `yearsToDays` uses, so a boundary year cannot land on two
 *  different anchors depending on which code path computed it. */
/**
 * NON-FINITE INPUT NOW YIELDS 0, WHICH IS A CHANGE. Before the rounding rule was shared, this
 * function had no finiteness guard and propagated NaN; it now inherits roundHalfAwayFromZero's
 * guard and returns 0. Zero is year 0 — a confident answer — so this function is NOT the place
 * that refuses. `anchorYearForEra` screens `presentYear` with Number.isFinite before it ever gets
 * here, and start/end come from the typed table, so no caller can reach it with junk. Any FUTURE
 * caller must screen its own inputs rather than reading a 0 as an anchor.
 */
export function midpointYear(start: number, end: number): number {
  return roundHalfAwayFromZero((start + end) / 2);
}

export interface AnchorVerdict {
  /** The year to use, or null when this file refuses to name one. */
  year: number | null;
  /** Empty when nothing needs saying. Otherwise the sentence shown beside the Present year box. */
  note: string;
  /**
   * A refusal and a miss are NOT the same thing, and a caller must not treat them alike.
   *
   * 'missing' — this country/label is not in the map at all (an unrecognised or renamed label, or
   *   a non-finite `presentYear`). A SUPPORTED STATE: FALL THROUGH to the generic band and then the
   *   current year, exactly as a miss has always meant.
   * 'refused' — the row IS in the map, but this file will not anchor it (no sourced start, or an
   *   unsound label naming more than one period). STOP AND ASK THE USER for a year. Falling through
   *   here manufactures exactly the approximation those rows exist to refuse.
   * 'ok' — a year was named, disputed boundary or not.
   */
  status: 'ok' | 'missing' | 'refused';
}

const NOT_FOUND: AnchorVerdict = { year: null, note: '', status: 'missing' };

export function findEraRow(country: string, label: string): EraRow | null {
  const c = String(country == null ? '' : country).trim();
  const l = String(label == null ? '' : label).trim();
  if (!c || !l) return null;
  return COUNTRY_ERA_YEARS.find((r) => r.country === c && r.label === l) || null;
}

/**
 * The anchor year for a chosen country + era, or a refusal with its reason.
 * `presentYear` is the current calendar year, used only to close an open-ended modern row.
 */
/** Appends a row's standing disclosure to whatever the flag produced. PURE, NEVER THROWS. */
function withStanding(row: EraRow, note: string): string {
  const standing = row && typeof row.standing === 'string' ? row.standing.trim() : '';
  if (!standing) return note;
  return note ? note + ' ' + standing : standing;
}

export function anchorYearForEra(country: string, label: string, presentYear: number): AnchorVerdict {
  if (!Number.isFinite(presentYear)) return NOT_FOUND;
  const row = findEraRow(country, label);
  if (!row) return NOT_FOUND;
  if (row.start === null) {
    return {
      year: null,
      status: 'refused',
      note: withStanding(row, `"${row.label}" has no sourced start, so there is no midpoint to take. Set the year you mean.`),
    };
  }
  if (row.flag === 'unsound') {
    return {
      year: null,
      status: 'refused',
      note: withStanding(row, `"${row.label}" covers more than one period, so there is no typical year for it. `
        + `Set the year you mean. (${describeRange(row, presentYear)})`),
    };
  }
  const year = midpointYear(row.start, row.end === null ? presentYear : row.end);
  if (row.flag === 'disputed') {
    return { year, status: 'ok', note: withStanding(row, `Dated ${describeRange(row, presentYear)}; that boundary is disputed. Change it if you mean otherwise.`) };
  }
  return { year, status: 'ok', note: withStanding(row, '') };
}

/** The band fallback, for a country with no deep timeline. */
export function anchorYearForBand(bandId: string, presentYear: number): number | null {
  if (!Number.isFinite(presentYear)) return null;
  const b = ERA_BANDS.find((x) => x.id === String(bandId || '').trim());
  if (!b) return null;
  if (b.offset !== undefined) return presentYear + b.offset;
  if (b.start === null || b.end === null) return null;
  return midpointYear(b.start, b.end);
}

/** "1750-2026", with BC printed by `1 - astronomicalYear` because there is no year zero. */
export function describeRange(row: EraRow, presentYear: number): string {
  if (!row || typeof row !== 'object') return '';
  const one = (y: number) => (y <= 0 ? `${1 - y} BC` : String(y));
  const start = row.start === null || row.start === undefined ? '?' : one(row.start);
  const end = row.end === null || row.end === undefined ? String(presentYear) : one(row.end);
  return `${start}–${end}`;
}

/** An era offset in days for a scene dated by period rather than by phrase. Refused rows give null. */
export function eraOffsetForEra(country: string, label: string, storyYear: number, presentYear: number): number | null {
  const v = anchorYearForEra(country, label, presentYear);
  if (v.year === null || !Number.isFinite(storyYear)) return null;
  return yearsToDays(v.year - storyYear);
}
