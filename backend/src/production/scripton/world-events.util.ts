import { yearsToDays } from './era-days.util';
import type { DatedEvent } from './era.util';
import type { EraFlag } from './era-map.util';

/**
 * WORLD EVENTS — the crises a story happens AROUND, as opposed to the periods it is set IN.
 *
 * The era map answers "what year is Edo Japan". This file answers "what year is the pandemic", and
 * they are different SHAPES of question. An era is a contiguous period keyed by country; a world
 * event is a dated episode that crossed borders, and the same one belongs to many countries at
 * once. Putting these in the era map as a 27th country called "World" was considered and rejected:
 * it would have broken the map's own shape, polluted its gap and overlap counts, and claimed that a
 * pandemic is a period you set a film in the way Edo Japan is.
 *
 * WHAT IT IS FOR. `resolveEventAnchored` in era.util.ts already resolves a phrase measured from a
 * named event — "three years before the fire" — but the caller has to supply the events. Nothing
 * supplied them, so "before the pandemic" or "after the crash" resolved to nothing. `datedWorldEvents`
 * is that missing list.
 *
 * THREE RULES THIS FILE KEEPS.
 *
 *   1. AN EVENT ANCHORS AT ITS START, not at its midpoint. This is the opposite of the era map, and
 *      deliberately so. "Three years before the war" means before it BEGAN; the start is the moment
 *      the world changed and the year everyone names. A midpoint would put "before the Second World
 *      War" in 1942, in the middle of it.
 *   2. IT WILL NOT ANCHOR AN UNSOUND LABEL, exactly as the era map will not. A label naming two
 *      separated episodes has no single year, so it yields no dated event at all rather than a
 *      confident wrong one.
 *   3. EVERY ALIAS IS A PHRASE A SCRIPT WOULD ACTUALLY USE, and none is a phrase that commonly means
 *      something else. "lockdown" was cut for that reason — a prison drama says it constantly.
 *      A bad alias is worse than a missing one: it silently dates a scene from an unrelated word.
 *
 * Dates are astronomical, matching the tokenizer and the era map: 1 BC is 0. `end: null` means the
 * event is still running at the story's own present.
 *
 * PURE. NEVER THROWS.
 */

export type WorldEventKind = 'pandemic' | 'economic' | 'war' | 'political' | 'disaster' | 'technological';
/** 'global' crossed continents; 'regional' is named by `regions`. */
export type WorldEventScope = 'global' | 'regional';

export interface WorldEvent {
  id: string;
  /** What the writer reads. */
  label: string;
  ar: string;
  start: number;
  /** null means it is still running at the story's present. */
  end: number | null;
  kind: WorldEventKind;
  scope: WorldEventScope;
  /** Empty for a global event; otherwise the regions it actually reached. */
  regions: string[];
  /** Other names a script may use. Each becomes its own entry in `datedWorldEvents`. */
  aliases: string[];
  /** Same semantics as the era map: 'unsound' means this label will not carry an anchor at all. */
  flag: EraFlag;
  basis: string;
}

export const WORLD_EVENTS: WorldEvent[] = [
  { id: 'plague-of-justinian', label: 'The Plague of Justinian', ar: 'طاعون جستنيان', start: 541, end: 549, kind: 'pandemic', scope: 'global', regions: [], aliases: ['Justinianic plague', 'the first plague pandemic', 'Justinian\'s plague'], flag: 'disputed',
    basis: 'First outbreak in Constantinople begins 541 and eases by 549, but the same First Plague Pandemic recurs in waves across the Mediterranean world, Persia and beyond until roughly 750. Death toll estimates run from 15 to 100 million, and revisionist scholars now dispute whether it caused any lasting demographic collapse at all.' },
  { id: 'black-death', label: 'The Black Death', ar: 'الموت الأسود', start: 1347, end: 1351, kind: 'pandemic', scope: 'global', regions: [], aliases: ['the Black Plague', 'the Great Mortality', 'the Great Pestilence'], flag: '',
    basis: 'Reaches Sicily via Genoese ships fleeing Caffa in October 1347 and burns through Europe, the Middle East and North Africa; by 1351 the first wave has passed, though plague recurs as the Second Pandemic for the next four centuries. An estimated 75-200 million died.' },
  { id: 'columbian-exchange-epidemics', label: 'The Columbian-exchange epidemics', ar: 'أوبئة التبادل الكولومبي', start: 1520, end: 1620, kind: 'pandemic', scope: 'regional', regions: ['North America', 'South America'], aliases: ['the Great Dying', 'the Columbian exchange plagues', 'post-contact epidemics'], flag: 'unsound',
    basis: 'Smallpox reaches Hispaniola by 1518 and Mexico in 1520; further smallpox, measles and typhus epidemics recur across the hemisphere in separate waves (the Andes in 1524-27, New England in the 1610s-20s) into the 1600s. This label spans dozens of distinct outbreaks a century and thousands of miles apart, so no single midpoint year represents what any one population actually experienced.' },
  { id: 'thirty-years-war', label: 'The Thirty Years\' War', ar: 'حرب الثلاثين عاماً', start: 1618, end: 1648, kind: 'war', scope: 'regional', regions: ['Europe'], aliases: ['the Thirty Years War'], flag: '',
    basis: 'Begins with the Defenestration of Prague, 23 May 1618, and ends with the Peace of Westphalia, signed 24 October 1648, after devastating the Holy Roman Empire and drawing in Sweden, France, Spain and the Dutch Republic.' },
  { id: 'mississippi-bubble', label: 'The Mississippi Bubble', ar: 'فقاعة المسيسيبي', start: 1719, end: 1720, kind: 'economic', scope: 'regional', regions: ['Europe'], aliases: ['Mississippi Company collapse', 'John Law\'s bubble'], flag: '',
    basis: 'John Law\'s Mississippi Company shares peak in France in late 1719 and collapse through 1720, wiping out the paper-money experiment and much of the French financial system alongside the concurrent South Sea Bubble in London.' },
  { id: 'south-sea-bubble', label: 'The South Sea Bubble', ar: 'فقاعة بحر الجنوب', start: 1720, end: 1720, kind: 'economic', scope: 'regional', regions: ['Europe'], aliases: ['South Sea Company collapse'], flag: '',
    basis: 'South Sea Company stock rises roughly tenfold between January and August 1720, then collapses to about £150 by the end of September and under £100 before the year is out — the entire rise and crash occurs within 1720. Parliament\'s Committee of Secrecy investigates through 1721 and secures the expulsion and imprisonment of Chancellor John Aislabie, but that inquiry is a subsequent political reckoning, not a continuation of the bubble itself.' },
  { id: 'napoleonic-wars', label: 'The Napoleonic Wars', ar: 'الحروب النابليونية', start: 1803, end: 1815, kind: 'war', scope: 'global', regions: [], aliases: ['the Napoleonic era', 'the war against Napoleon'], flag: 'disputed',
    basis: 'Britain\'s declaration of war on France, 18 May 1803, is the conventional START, but historians disagree on whether to date from Bonaparte\'s coup of November 1799 or even the French Revolutionary Wars of 1792, a shift of up to eleven years. The wars end with Napoleon\'s defeat at Waterloo, 18 June 1815, and his final exile that November.' },
  { id: 'tambora-year-without-summer', label: 'Tambora and the Year Without a Summer', ar: 'ثوران تامبورا وسنة بلا صيف', start: 1815, end: 1816, kind: 'disaster', scope: 'global', regions: [], aliases: ['the Year Without a Summer', 'the Tambora eruption', 'the 1816 famine'], flag: '',
    basis: 'Mount Tambora erupts in the Dutch East Indies 10 April 1815, the largest eruption in recorded history; the resulting volcanic winter causes crop failures and famine across the Northern Hemisphere through 1816, remembered as the Year Without a Summer.' },
  { id: 'cholera-pandemics', label: 'The 19th-century cholera pandemics', ar: 'أوبئة الكوليرا في القرن التاسع عشر', start: 1817, end: 1923, kind: 'pandemic', scope: 'global', regions: [], aliases: ['the cholera pandemic', 'the cholera years', 'the cholera outbreaks'], flag: 'unsound',
    basis: 'Seven separate cholera pandemics radiate outward from the Ganges delta between 1817 and 1923, each with its own start, route and death toll; the third (1846-1860) was the deadliest of the century. The label spans over a hundred years of distinct events, so no single year anchors it.' },
  { id: 'revolutions-of-1848', label: 'The Revolutions of 1848', ar: 'ثورات 1848', start: 1848, end: 1849, kind: 'political', scope: 'regional', regions: ['Europe'], aliases: ['the Springtime of Nations', 'the 1848 revolutions', 'the Springtime of the Peoples'], flag: '',
    basis: 'Revolution breaks out in Sicily in January 1848 and in Paris that February, spreading to over 50 states and territories across Europe; the last uprisings are suppressed with the fall of the Hungarian and Roman republics in 1849.' },
  { id: 'long-depression', label: 'The Long Depression', ar: 'الكساد الطويل', start: 1873, end: 1896, kind: 'economic', scope: 'global', regions: [], aliases: ['the Panic of 1873', 'the depression of the 1870s'], flag: 'disputed',
    basis: 'Triggered by the Panic of 1873 (the Vienna stock crash, May 1873, and the Jay Cooke failure, September 1873); the NBER dates the core US contraction to March 1879, but the British experience of continuous depression is conventionally run to 1896. Most modern reviews reject a single unbroken 23-year slump, so both the END date and the depression\'s coherence as one event are disputed by up to 17 years.' },
  { id: 'krakatoa-eruption', label: 'The eruption of Krakatoa', ar: 'ثوران بركان كراكاتوا', start: 1883, end: 1883, kind: 'disaster', scope: 'global', regions: [], aliases: ['Krakatoa', 'the Krakatoa eruption', 'the 1883 eruption'], flag: '',
    basis: 'Krakatoa erupts catastrophically 26-27 August 1883 in the Sunda Strait, killing over 36,000 people mostly by tsunami, the entire eruption occurring within two days. The ash cloud circles the globe and produces vivid red sunsets and measurable global cooling for several years afterward, into 1886, but those atmospheric aftereffects are a lingering consequence, not a continuation of the eruption itself.' },
  { id: 'world-war-one', label: 'The First World War', ar: 'الحرب العالمية الأولى', start: 1914, end: 1918, kind: 'war', scope: 'global', regions: [], aliases: ['World War I', 'WWI', 'the Great War', 'the First World War', 'the war'], flag: '',
    basis: 'Begins with Austria-Hungary\'s declaration of war on Serbia, 28 July 1914, following the assassination of Archduke Franz Ferdinand; ends with the Armistice of 11 November 1918.' },
  { id: 'spanish-flu', label: 'The 1918 influenza pandemic', ar: 'جائحة الإنفلونزا 1918', start: 1918, end: 1920, kind: 'pandemic', scope: 'global', regions: [], aliases: ['Spanish flu', 'the 1918 flu', 'the influenza pandemic', 'the great flu', 'the pandemic', 'the flu pandemic'], flag: 'disputed',
    basis: 'First recorded cases March 1918; the third and final wave subsides through 1920. Death toll estimates run from 17 to 50 million (some put it as high as 100 million), so the SCALE is disputed even though the dates are not.' },
  { id: 'great-depression', label: 'The Great Depression', ar: 'الكساد الكبير', start: 1929, end: 1939, kind: 'economic', scope: 'global', regions: [], aliases: ['the Depression', 'the Great Slump', 'the crash of \'29', 'the 1929 crash', 'Black Tuesday', 'the Wall Street Crash', 'the crash'], flag: 'disputed',
    basis: 'Share prices collapse over Black Thursday (24 October) and Black Tuesday (29 October) 1929; unemployment peaks near 25% in 1933. Most economies begin recovering after 1933\'s New Deal and gold-standard exits, but the depression\'s END is dated as late as 1939, when war mobilization restores full employment, so the CLOSING year moves by up to six years depending on the metric used.' },
  { id: 'world-war-two', label: 'The Second World War', ar: 'الحرب العالمية الثانية', start: 1939, end: 1945, kind: 'war', scope: 'global', regions: [], aliases: ['World War II', 'WWII', 'the Second World War', 'the war'], flag: '',
    basis: 'Begins with Germany\'s invasion of Poland, 1 September 1939; ends with Japan\'s surrender, 2 September 1945, following the atomic bombings of Hiroshima and Nagasaki.' },
  { id: 'decolonization-wave', label: 'The wave of decolonization', ar: 'موجة إنهاء الاستعمار', start: 1945, end: 1975, kind: 'political', scope: 'global', regions: [], aliases: ['decolonization', 'the end of empire', 'the decolonization era'], flag: 'disputed',
    basis: 'India and Pakistan gain independence in August 1947 and the wave crests in 1960, the \'Year of Africa\', when 17 nations become independent; the core wave is generally closed by the independence of Portugal\'s African colonies in 1974-75, though holdouts like Rhodesia (1980), Hong Kong (1997) and East Timor (2002) push the closing date decades later depending on which territory anchors it.' },
  { id: 'cold-war', label: 'The Cold War', ar: 'الحرب الباردة', start: 1947, end: 1991, kind: 'war', scope: 'global', regions: [], aliases: ['the Cold War era', 'the Iron Curtain'], flag: 'disputed',
    basis: 'No single start is agreed: some date it from the end of WWII in 1945, others from Truman\'s doctrine speech in March 1947 and the Marshall Plan that June, the year Bernard Baruch coined the term. The END is dated either to the fall of the Berlin Wall, November 1989, or the Soviet Union\'s dissolution, 26 December 1991 — a spread of up to two years on the START and two years on the END.' },
  { id: 'partition-of-india', label: 'The Partition of India', ar: 'تقسيم الهند', start: 1947, end: 1948, kind: 'political', scope: 'regional', regions: ['South Asia'], aliases: ['the partition of British India', 'Independence and Partition', 'the Radcliffe Line'], flag: 'disputed',
    basis: 'British India is partitioned into India and Pakistan at midnight on 14-15 August 1947 along the Radcliffe Line, displacing an estimated 10-20 million people; the resulting refugee crisis and communal violence continue well into 1948, and the First Kashmir War, which breaks out that October, drags into 1949.' },
  { id: 'korean-war', label: 'The Korean War', ar: 'الحرب الكورية', start: 1950, end: 1953, kind: 'war', scope: 'regional', regions: ['East Asia'], aliases: ['the Korean conflict'], flag: '',
    basis: 'North Korea invades South Korea 25 June 1950; an armistice is signed 27 July 1953 at Panmunjom, though no peace treaty has ever formally ended the war.' },
  { id: 'vietnam-war', label: 'The Vietnam War', ar: 'حرب فيتنام', start: 1955, end: 1975, kind: 'war', scope: 'regional', regions: ['East Asia'], aliases: ['the Vietnam conflict', 'the American War'], flag: 'disputed',
    basis: 'US military advisers are dated from 1 November 1955, though direct US combat troops arrive only in 1965 and some historians prefer the 1954 Geneva Accords partitioning Vietnam as the true start, a shift of up to ten years. The war ends with the Fall of Saigon, 30 April 1975.' },
  { id: 'suez-crisis', label: 'The Suez Crisis', ar: 'أزمة السويس', start: 1956, end: 1956, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the Suez War', 'the Tripartite Aggression', 'the 1956 war'], flag: '',
    basis: 'Egypt nationalizes the Suez Canal 26 July 1956; Israel, Britain and France invade 29 October-5 November 1956, and a UN-brokered ceasefire is followed by British and French withdrawal within weeks, by December 1956. Israeli forces remain in Sinai and Gaza until March 1957, but that continued occupation is a separate, subsequent dispute over withdrawal terms — the crisis itself, as conventionally dated, runs from the canal\'s nationalization to the November 1956 ceasefire, entirely within 1956.' },
  { id: 'six-day-war', label: 'The Six-Day War', ar: 'حرب الأيام الستة', start: 1967, end: 1967, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the 1967 war', 'the June War', 'the Naksa'], flag: '',
    basis: 'Israel launches pre-emptive strikes against Egypt, Jordan and Syria on 5 June 1967; a UN-brokered ceasefire ends the fighting by 10 June 1967, with Israel occupying the Sinai, Golan Heights, West Bank and Gaza. The war lasted six days, entirely within 1967. The Jarring Mission, the UN peace effort mandated by Resolution 242 that November, begins its shuttle diplomacy only in 1968, but that diplomatic aftermath is a separate process from the war itself, which was over in a week.' },
  { id: 'oil-crisis-1973', label: 'The 1973 oil crisis', ar: 'أزمة النفط 1973', start: 1973, end: 1974, kind: 'economic', scope: 'global', regions: [], aliases: ['the oil embargo', 'the first oil shock', 'the 1973 oil embargo'], flag: '',
    basis: 'OAPEC declares an oil embargo on 17 October 1973 in response to Western support for Israel in the October War; the embargo is lifted in March 1974, but the price shock, which roughly quadruples crude prices, reshapes the global economy through the mid-1970s.' },
  { id: 'yom-kippur-war', label: 'The Yom Kippur War', ar: 'حرب أكتوبر', start: 1973, end: 1973, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the October War', 'the Ramadan War', 'the 1973 war'], flag: '',
    basis: 'Egypt and Syria launch a coordinated surprise attack on Israeli-held Sinai and the Golan Heights on 6 October 1973; a UN ceasefire takes effect 25 October 1973, ending the fighting within the year. The formal Sinai and Golan disengagement agreements that follow are not signed until January and May 1974, but those are subsequent diplomatic negotiations, not a continuation of the fighting, which lasted 19 days in October 1973.' },
  { id: 'iranian-revolution', label: 'The Iranian Revolution', ar: 'الثورة الإيرانية', start: 1978, end: 1979, kind: 'political', scope: 'regional', regions: ['Middle East'], aliases: ['the 1979 revolution', 'the fall of the Shah', 'the Islamic Revolution'], flag: '',
    basis: 'Mass protests against the Shah begin in January 1978; he flees Iran 16 January 1979, Ayatollah Khomeini returns 1 February 1979, and a referendum establishes the Islamic Republic on 1 April 1979.' },
  { id: 'oil-crisis-1979', label: 'The 1979 oil crisis', ar: 'أزمة النفط 1979', start: 1979, end: 1980, kind: 'economic', scope: 'global', regions: [], aliases: ['the second oil shock', 'the 1979 oil shock'], flag: '',
    basis: 'Oil production collapses during the Iranian Revolution of 1978-79, and the outbreak of the Iran-Iraq War in September 1980 pushes prices higher still; global crude prices roughly double between 1979 and 1980.' },
  { id: 'soviet-afghan-war', label: 'The Soviet-Afghan War', ar: 'الحرب السوفيتية الأفغانية', start: 1979, end: 1989, kind: 'war', scope: 'regional', regions: ['South Asia'], aliases: ['the Soviet invasion of Afghanistan', 'the Soviet war in Afghanistan'], flag: '',
    basis: 'Soviet forces invade Afghanistan 24 December 1979 to prop up the communist government; the last Soviet troops withdraw 15 February 1989 under the Geneva Accords, after a war that drew in US-backed mujahideen from across the Muslim world.' },
  { id: 'iran-iraq-war', label: 'The Iran-Iraq War', ar: 'الحرب العراقية الإيرانية', start: 1980, end: 1988, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the First Gulf War', 'the Iraq-Iran War'], flag: '',
    basis: 'Iraq invades Iran 22 September 1980; a UN-brokered ceasefire, Security Council Resolution 598, takes effect 20 August 1988, after roughly half a million deaths on both sides.' },
  { id: 'hiv-aids-pandemic', label: 'The HIV/AIDS pandemic', ar: 'جائحة الإيدز', start: 1981, end: null, kind: 'pandemic', scope: 'global', regions: [], aliases: ['the AIDS crisis', 'the AIDS epidemic', 'HIV epidemic'], flag: 'disputed',
    basis: 'The CDC\'s first published report of what became known as AIDS appears 5 June 1981, though retrospective cases and the virus\'s zoonotic origin in Central Africa are dated to the early-to-mid 20th century. UNAIDS still counts it a global pandemic today, with no declared end.' },
  { id: 'chernobyl-disaster', label: 'The Chernobyl disaster', ar: 'كارثة تشيرنوبيل', start: 1986, end: 1986, kind: 'disaster', scope: 'regional', regions: ['Europe'], aliases: ['Chernobyl', 'the Chernobyl meltdown'], flag: '',
    basis: 'Reactor 4 at the Chernobyl plant in Soviet Ukraine explodes 26 April 1986, releasing radioactive fallout across Ukraine, Belarus and much of Europe; the reactor is entombed in a concrete sarcophagus by November 1986, containing the immediate crisis within the year. The criminal trial of the plant\'s managers, held in July 1987, is a subsequent legal reckoning, not part of the disaster itself.' },
  { id: 'black-monday-1987', label: 'Black Monday, 1987', ar: 'الاثنين الأسود 1987', start: 1987, end: 1987, kind: 'economic', scope: 'global', regions: [], aliases: ['the 1987 crash', 'Black Monday', 'the crash of \'87', 'the crash'], flag: '',
    basis: 'Global stock markets crash on 19 October 1987; the Dow Jones Industrial Average falls 22.6% in a single day, the largest one-day percentage drop in its history, with equivalent falls across Europe, Asia and Australia. The Dow does not regain its pre-crash high until 26 July 1989, but that recovery is the market\'s subsequent healing, not a continuation of the crash itself, which occurred entirely on 19 October 1987.' },
  { id: 'fall-of-berlin-wall', label: 'The Fall of the Berlin Wall', ar: 'سقوط جدار برلين', start: 1989, end: 1989, kind: 'political', scope: 'global', regions: [], aliases: ['the fall of the Wall', 'the Berlin Wall coming down', 'the opening of the Wall'], flag: '',
    basis: 'The Berlin Wall opens on the night of 9 November 1989 after East Germany\'s government misannounces new travel rules, the culmination of the Revolutions of 1989 that topple communist governments across the Eastern Bloc that same year. German reunification, completed 3 October 1990, is a distinct subsequent political process, not the fall of the Wall itself, which was effectively complete by the end of 1989.' },
  { id: 'gulf-war', label: 'The Gulf War', ar: 'حرب الخليج', start: 1990, end: 1991, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the 1991 Gulf War', 'Desert Storm', 'the liberation of Kuwait', 'the Second Gulf War'], flag: '',
    basis: 'Iraq invades Kuwait 2 August 1990; a US-led coalition launches Operation Desert Storm 17 January 1991, and Iraq\'s forces are expelled by the ceasefire of 28 February 1991.' },
  { id: 'soviet-collapse', label: 'The collapse of the Soviet Union', ar: 'انهيار الاتحاد السوفيتي', start: 1991, end: 1991, kind: 'political', scope: 'global', regions: [], aliases: ['the fall of the USSR', 'the end of the USSR', 'the August coup'], flag: '',
    basis: 'Hardliners\' August coup against Gorbachev fails 19-21 August 1991; Gorbachev resigns and the Soviet Union is formally dissolved 26 December 1991, ending the Cold War order and creating 15 new states, all within the same year. Russia\'s \'shock therapy\' price liberalization, beginning 2 January 1992, marks the start of the post-Soviet order that follows the collapse, not a continuation of the collapse itself.' },
  { id: 'world-wide-web-arrival', label: 'The arrival of the World Wide Web', ar: 'ظهور الشبكة العنكبوتية العالمية', start: 1991, end: 1995, kind: 'technological', scope: 'global', regions: [], aliases: ['the internet age', 'the dawn of the internet', 'the World Wide Web'], flag: 'disputed',
    basis: 'Tim Berners-Lee proposes the web at CERN in March 1989 and releases it to the whole internet on 23 August 1991; it does not become a mass phenomenon until the Mosaic browser (1993) and Netscape\'s 1995 IPO ignite the dot-com boom, so \'when the web arrived\' moves by several years depending on invention versus adoption.' },
  { id: 'asian-financial-crisis', label: 'The Asian financial crisis', ar: 'الأزمة المالية الآسيوية', start: 1997, end: 1998, kind: 'economic', scope: 'regional', regions: ['East Asia'], aliases: ['the 1997 crisis', 'the Asian crisis', 'the IMF crisis'], flag: 'disputed',
    basis: 'Begins with the floating and collapse of the Thai baht on 2 July 1997 and spreads to Indonesia, South Korea and beyond through 1998; recovery timelines diverge sharply by country, with Indonesia and South Korea still contracting into 1998-99 while Thailand does not fully recover until 2001, so the CLOSING year is genuinely country-dependent.' },
  { id: 'y2k', label: 'The Y2K millennium bug', ar: 'علة الألفية Y2K', start: 1999, end: 2000, kind: 'technological', scope: 'global', regions: [], aliases: ['the Y2K bug', 'the millennium bug', 'the Y2K scare', 'Y2K'], flag: '',
    basis: 'Fear that two-digit year fields in legacy software would fail at the century rollover drives a global remediation effort through 1999; the non-event of 1 January 2000 closes the episode, though a handful of minor glitches were reported that day.' },
  { id: 'dot-com-crash', label: 'The dot-com crash', ar: 'انهيار فقاعة الإنترنت', start: 2000, end: 2002, kind: 'economic', scope: 'global', regions: [], aliases: ['the dot-com bubble', 'the tech crash', 'the dot-com bust', 'the crash'], flag: '',
    basis: 'The NASDAQ Composite peaks at 5,048.62 on 10 March 2000 and bottoms at 1,114 on 9 October 2002, a 78% fall that wipes out most internet-era startups and roughly $5 trillion in market value.' },
  { id: 'afghanistan-war-2001', label: 'The war in Afghanistan, 2001-2021', ar: 'الحرب في أفغانستان', start: 2001, end: 2021, kind: 'war', scope: 'regional', regions: ['South Asia'], aliases: ['the war on terror in Afghanistan', 'America\'s longest war', 'the Afghan war'], flag: '',
    basis: 'A US-led coalition invades Afghanistan 7 October 2001 after the September 11 attacks; the last US forces withdraw 30 August 2021, days after the Taliban retake Kabul.' },
  { id: 'september-11-attacks', label: 'The September 11 attacks', ar: 'هجمات 11 سبتمبر', start: 2001, end: 2001, kind: 'political', scope: 'global', regions: [], aliases: ['9/11', 'September 11', 'the Twin Towers attack'], flag: '',
    basis: 'Al-Qaeda hijackers crash four airliners into the World Trade Center, the Pentagon and a Pennsylvania field on 11 September 2001, killing nearly 3,000 people in a single coordinated attack. Debris removal at the World Trade Center site continues until 30 May 2002, but that cleanup is a subsequent recovery operation, not part of the attack itself.' },
  { id: 'sars-outbreak', label: 'The SARS outbreak', ar: 'تفشي سارس', start: 2002, end: 2003, kind: 'pandemic', scope: 'global', regions: [], aliases: ['SARS epidemic', 'the SARS crisis', 'SARS'], flag: '',
    basis: 'First atypical-pneumonia cases identified in Guangdong, China, in November 2002; spreads to 29 countries before the WHO declares the outbreak contained on 5 July 2003.' },
  { id: 'iraq-war', label: 'The Iraq War', ar: 'حرب العراق', start: 2003, end: 2011, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the invasion of Iraq', 'the Third Gulf War', 'the occupation of Iraq'], flag: 'disputed',
    basis: 'A US-led coalition invades Iraq 20 March 2003; the last US combat troops withdraw 18 December 2011. Washington\'s renewed military engagement against ISIS from 2014 is generally treated as a separate conflict, but some usage folds it back into \'the Iraq War\', pushing the END as late as 2017, a six-year spread.' },
  { id: 'indian-ocean-tsunami-2004', label: 'The 2004 Indian Ocean tsunami', ar: 'تسونامي المحيط الهندي 2004', start: 2004, end: 2004, kind: 'disaster', scope: 'regional', regions: ['South Asia', 'East Asia', 'Africa'], aliases: ['the Boxing Day tsunami', 'the 2004 tsunami', 'the Asian tsunami'], flag: '',
    basis: 'A magnitude-9.1 undersea earthquake off Sumatra on 26 December 2004 triggers tsunamis that kill roughly 230,000 people across 14 countries, from Indonesia and Thailand to Sri Lanka, India and as far as Somalia, all within hours on the same day. The international relief and reconstruction effort, including the Jakarta donors\' conference, continues into 2005, but that recovery effort is a subsequent response, not the disaster itself.' },
  { id: 'global-financial-crisis-2008', label: 'The 2008 financial crisis', ar: 'الأزمة المالية العالمية 2008', start: 2007, end: 2009, kind: 'economic', scope: 'global', regions: [], aliases: ['the 2008 crash', 'the financial crisis', 'the credit crunch', 'the Great Recession', 'the subprime crisis', 'the crash'], flag: 'disputed',
    basis: 'US subprime mortgage defaults trigger a credit crunch from mid-2007; Lehman Brothers collapses 15 September 2008, precipitating a worldwide banking crisis. The NBER dates the US recession itself to December 2007-June 2009, but the global recovery drags on for years afterward, so how far \'the crisis\' extends is a matter of definition.' },
  { id: 'h1n1-swine-flu', label: 'The 2009 H1N1 swine flu pandemic', ar: 'جائحة إنفلونزا الخنازير 2009', start: 2009, end: 2010, kind: 'pandemic', scope: 'global', regions: [], aliases: ['swine flu', 'the swine flu pandemic', 'H1N1 pandemic'], flag: '',
    basis: 'Identified in Mexico and the United States in April 2009; the WHO declares the pandemic over on 10 August 2010, after it had reached more than 200 countries.' },
  { id: 'eurozone-debt-crisis', label: 'The eurozone debt crisis', ar: 'أزمة الديون الأوروبية', start: 2009, end: 2015, kind: 'economic', scope: 'regional', regions: ['Europe'], aliases: ['the Greek debt crisis', 'the euro crisis', 'the sovereign debt crisis'], flag: 'disputed',
    basis: 'Greece discloses understated deficits in late 2009, triggering bailouts of Greece, Ireland, Portugal and Cyprus; Ireland and Portugal exit their programmes in 2014, but Greece\'s third bailout runs until 2018. Sources give the crisis\'s END anywhere from 2012 to 2018 depending on which country anchors the label, a six-year spread.' },
  { id: 'eyjafjallajokull-ash-crisis', label: 'The Eyjafjallajökull ash crisis', ar: 'أزمة رماد بركان أيافيالايوكل', start: 2010, end: 2010, kind: 'disaster', scope: 'regional', regions: ['Europe'], aliases: ['the Icelandic ash cloud', 'the 2010 flight ban', 'the volcanic ash crisis'], flag: '',
    basis: 'Eyjafjallajökull erupts in Iceland from 14 April 2010, and its ash cloud shuts down most of European airspace for six days, stranding millions of travelers and grounding roughly 100,000 flights across more than 20 countries, with normal air traffic restored within weeks. New EU-wide volcanic-ash safety thresholds, prompted by the chaos, are not adopted until 2011, but that regulatory response follows the crisis rather than extending it.' },
  { id: 'arab-spring', label: 'The Arab Spring', ar: 'الربيع العربي', start: 2010, end: 2012, kind: 'political', scope: 'regional', regions: ['Middle East', 'Africa'], aliases: ['the Arab uprisings', 'the 2011 uprisings', 'the Jasmine Revolution'], flag: 'disputed',
    basis: 'Mohamed Bouazizi\'s self-immolation in Tunisia on 17 December 2010 sets off protests that topple rulers in Tunisia, Egypt, Libya and Yemen by 2012; but Syria\'s and Libya\'s uprisings curdle into long civil wars, and a \'second Arab Spring\' wave hits Sudan, Algeria, Iraq and Lebanon from 2018-19, so how far the label\'s effects extend is genuinely contested.' },
  { id: 'syrian-civil-war', label: 'The Syrian Civil War', ar: 'الحرب الأهلية السورية', start: 2011, end: 2024, kind: 'war', scope: 'regional', regions: ['Middle East'], aliases: ['the Syrian uprising', 'the Syrian conflict', 'the war in Syria'], flag: 'disputed',
    basis: 'Protests against Assad begin in Daraa in March 2011 and escalate into civil war by mid-2011; the Assad regime falls to a rebel offensive on 8 December 2024. Whether the CIVIL WAR itself ended with the regime\'s collapse, or continues amid post-Assad instability and ongoing insurgent violence, is actively contested.' },
  { id: 'fukushima-disaster', label: 'The Fukushima nuclear disaster', ar: 'كارثة فوكوشيما النووية', start: 2011, end: 2011, kind: 'disaster', scope: 'regional', regions: ['East Asia'], aliases: ['Fukushima', 'the Fukushima meltdown', 'the Tohoku disaster'], flag: '',
    basis: 'The magnitude-9.0 Tohoku earthquake and tsunami strike Japan 11 March 2011, causing meltdowns at three reactors of the Fukushima Daiichi plant within days. Japan takes its last operating reactor offline by May 2012, going fully nuclear-free for the first time since 1970, but that is a subsequent national policy shift, not a continuation of the disaster itself, which is dated to the March 2011 meltdowns.' },
  { id: 'west-africa-ebola-epidemic', label: 'The West African Ebola epidemic', ar: 'وباء الإيبولا في غرب أفريقيا', start: 2014, end: 2016, kind: 'pandemic', scope: 'regional', regions: ['Africa'], aliases: ['the Ebola crisis', 'the Ebola outbreak'], flag: 'disputed',
    basis: 'Retrospectively traced to a single case in Guinea in December 2013, but not recognized as a regional emergency until spring 2014; the WHO declares West Africa Ebola-free on 9 June 2016, after roughly 11,300 deaths in Guinea, Liberia and Sierra Leone. The START moves by several months depending on first case versus recognized outbreak.' },
  { id: 'european-migrant-crisis', label: 'The European migrant crisis', ar: 'أزمة اللاجئين الأوروبية', start: 2015, end: 2016, kind: 'political', scope: 'regional', regions: ['Europe', 'Middle East'], aliases: ['the refugee crisis', 'the migrant crisis', 'the Syrian refugee crisis'], flag: 'disputed',
    basis: 'Mediterranean crossings surge through 2015, peaking with over a million asylum claims in the EU that year and the drowning of Alan Kurdi in September 2015; the EU-Turkey deal of March 2016 sharply cuts crossings, though irregular arrivals and political fallout, including the UK\'s 2016 Brexit vote, continue for years, so where the \'crisis\' phase properly ends is contested.' },
  { id: 'covid-19-pandemic', label: 'The COVID-19 pandemic', ar: 'جائحة كوفيد-19', start: 2019, end: 2023, kind: 'pandemic', scope: 'global', regions: [], aliases: ['the coronavirus pandemic', 'COVID', 'the COVID lockdowns', 'the pandemic'], flag: 'disputed',
    basis: 'First cases in Wuhan traced to December 2019; the WHO declares a Public Health Emergency 30 January 2020 and a pandemic 11 March 2020. The WHO ends the global health emergency 5 May 2023, but individual countries\' own end-of-emergency declarations range from 2022 to mid-2023, so the CLOSING year moves by up to a year depending on the authority cited.' },
  { id: 'post-covid-inflation-shock', label: 'The post-pandemic inflation shock', ar: 'صدمة التضخم بعد الجائحة', start: 2021, end: 2023, kind: 'economic', scope: 'global', regions: [], aliases: ['the cost-of-living crisis', 'the inflation crisis', 'the 2022 inflation surge'], flag: 'disputed',
    basis: 'Consumer prices accelerate globally from 2021 as pandemic stimulus, supply-chain shocks and the 2022 Russian invasion of Ukraine\'s effect on energy and grain prices combine; US and eurozone inflation peaks in 2022 and returns near central-bank targets by late 2023, though several economies were still calling the \'cost-of-living crisis\' ongoing well past that date.' },
];

/** Lower-cased name -> the ids that answer to it. Built once; the table is a frozen constant. */
const CLAIMS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const e of WORLD_EVENTS) {
    for (const n of [e.label, ...e.aliases]) {
      const k = String(n).trim().toLowerCase();
      if (!k) continue;
      const cur = m.get(k);
      if (cur) { if (!cur.includes(e.id)) cur.push(e.id); } else m.set(k, [e.id]);
    }
  }
  return m;
})();

/**
 * Names MORE THAN ONE event answers to. "the crash" is 1929, 1987, 2000 and 2008; "the pandemic" is
 * 1918 and 2020; "the war" is either world war. These deliberately DATE NOTHING — picking the
 * longest match or the first in the table would be a coin toss dressed as an answer — but they are
 * reported here so the app can ASK the writer which one they mean, exactly as an unsound era row
 * refuses and says why. Refusing silently would be a worse product than refusing out loud.
 *
 * This is also a GUARD: add an event tomorrow whose alias collides with an existing one and that
 * name stops dating by itself, rather than quietly dating to whichever row sorted first.
 */
export function ambiguousEventNames(): { name: string; ids: string[] }[] {
  const out: { name: string; ids: string[] }[] = [];
  for (const [name, ids] of CLAIMS) if (ids.length > 1) out.push({ name, ids: ids.slice() });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every name a script might use for a datable world event, with its offset in DAYS from the story's
 * present — the shape `resolveEventAnchored` consumes. One entry per label AND per alias, because
 * that function matches on the name.
 *
 * TWO KINDS OF NAME ARE LEFT OUT, both because a wrong base is worse than an unresolved phrase:
 *   - an `unsound` event, which names more than one episode and so has no year to measure from;
 *   - a name more than one event answers to (see `ambiguousEventNames`).
 *
 * PURE. NEVER THROWS — a non-finite present year yields an empty list rather than a list of zeroes,
 * because an offset of zero would silently mean "this event is happening now".
 */
export function datedWorldEvents(presentYear: number): DatedEvent[] {
  if (!Number.isFinite(presentYear)) return [];
  const out: DatedEvent[] = [];
  for (const e of WORLD_EVENTS) {
    if (!e || e.flag === 'unsound' || !Number.isFinite(e.start)) continue;
    const offset = yearsToDays(e.start - presentYear);
    for (const raw of [e.label, ...(Array.isArray(e.aliases) ? e.aliases : [])]) {
      const name = typeof raw === 'string' ? raw.trim() : '';
      if (!name) continue;
      const ids = CLAIMS.get(name.toLowerCase());
      if (ids && ids.length > 1) continue;   // ambiguous: refuse rather than choose
      out.push({ name, offset });
    }
  }
  return out;
}

/** The event a name refers to, label or alias, case-insensitively. Null when nothing matches, and
 *  null when the name is ambiguous - there is no single right answer to return. */
export function findWorldEvent(name: string): WorldEvent | null {
  const want = String(name == null ? '' : name).trim().toLowerCase();
  if (!want) return null;
  const ids = CLAIMS.get(want);
  if (!ids || ids.length !== 1) return null;
  return WORLD_EVENTS.find((e) => e.id === ids[0]) || null;
}

/**
 * Which world events were running in a given year — so the app can tell a writer what their setting
 * was living through. A story set in 1919 Egypt was in the influenza pandemic whether or not the
 * writer thought of it.
 *
 * `presentYear` closes any event still running. An unsound event IS listed here: it cannot supply an
 * anchor, but it is still true that it was going on, and naming it costs the writer nothing.
 */
export function worldEventsInYear(year: number, presentYear: number): WorldEvent[] {
  if (!Number.isFinite(year) || !Number.isFinite(presentYear)) return [];
  return WORLD_EVENTS.filter((e) => {
    const end = e.end === null ? presentYear : e.end;
    return Number.isFinite(e.start) && year >= e.start && year <= end;
  });
}
